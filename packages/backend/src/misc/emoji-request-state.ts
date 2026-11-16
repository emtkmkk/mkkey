/**
 * @packageDocumentation
 *
 * 絵文字の追加申請・インポート申請の「状態の遷移表」と、表に沿って状態を書き換える関数。
 *
 * @remarks
 * - どの操作が、どの状態から、どの状態へ移すかを、この表だけで読めるようにする。
 *   各 API はここを参照し、`request.status !== ...` のような判定を自分で書かない。
 * - 状態の書き換えは「今の状態が表の from に入っているときだけ UPDATE する」形で行う
 *   （{@link transitionEmojiAddRequest} / {@link transitionEmojiImportRequest}）。
 *   読んで確かめてから書く形だと、承認と取り下げが同時に通ったときに
 *   「絵文字は登録済みなのに状態は取り下げ」のような食い違いが起きるため。
 * - 表の中身は、まとめる前の各 API の判定をそのまま写したもの。遷移を増やす・減らすときは
 *   クライアントの写し（`packages/client/src/scripts/emoji-request.ts` の
 *   `emojiAddRequestActions`）も合わせて直す。
 * - NOTE: インポート申請は「却下 → 承認」を許している。却下時に拒否リスト（EmojiImportDenieds）へ入れ、
 *   承認時に消す作りなので、管理者が判断を取り消す道として残している。
 *
 * @internal
 */
import { In, type EntityManager } from "typeorm";
import { db } from "@/db/postgre.js";
import {
	EmojiAddRequest,
	type EmojiAddRequestStatus,
} from "@/models/entities/emoji-add-request.js";
import { EmojiImportRequest } from "@/models/entities/emoji-import-request.js";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity.js";

// #region 型

/**
 * 1 つの操作による遷移。
 *
 * @typeParam S - 状態の文字列の合併型
 * @internal
 */
type Transition<S extends string> = {
	/** この操作ができる状態 */
	readonly from: readonly S[];
	/** 操作したあとの状態 */
	readonly to: S;
};

/** インポート申請の状態 */
export type EmojiImportRequestStatus = EmojiImportRequest["status"];

// #endregion

// #region 遷移表

/**
 * 追加申請の遷移表。
 *
 * @remarks
 * ```text
 *  create ─▶ pending ──requestChanges──▶ changesRequested
 *              ▲                               │
 *              └───────────resubmit────────────┘
 *
 *  pending / changesRequested ──approve───▶ approved（終わり）
 *                             ──reject────▶ rejected（終わり）
 *                             ──withdraw──▶ withdrawn（終わり）
 * ```
 * approved / rejected / withdrawn からは、どの操作もできない。
 *
 * @internal
 */
export const emojiAddRequestTransitions = {
	/** 管理者の「修正のお願い」 */
	requestChanges: { from: ["pending"], to: "changesRequested" },
	/** 申請者の出し直し */
	resubmit: { from: ["changesRequested"], to: "pending" },
	/** 管理者の承認（直して承認を含む） */
	approve: { from: ["pending", "changesRequested"], to: "approved" },
	/** 管理者の却下 */
	reject: { from: ["pending", "changesRequested"], to: "rejected" },
	/** 申請者の取り下げ */
	withdraw: { from: ["pending", "changesRequested"], to: "withdrawn" },
} as const satisfies Record<string, Transition<EmojiAddRequestStatus>>;

/** 追加申請に対する操作の名前 */
export type EmojiAddRequestAction = keyof typeof emojiAddRequestTransitions;

/**
 * インポート申請の遷移表。
 *
 * @remarks
 * 承認は「承認済み以外」から、却下は「審査待ち」からだけできる（モジュール先頭の NOTE を参照）。
 *
 * @internal
 */
export const emojiImportRequestTransitions = {
	approve: { from: ["pending", "rejected"], to: "approved" },
	reject: { from: ["pending"], to: "rejected" },
} as const satisfies Record<string, Transition<EmojiImportRequestStatus>>;

/** インポート申請に対する操作の名前 */
export type EmojiImportRequestAction = keyof typeof emojiImportRequestTransitions;

// #endregion

// #region 判定

/**
 * 追加申請が、今の状態でその操作をできるかを返す。
 *
 * @remarks
 * 重い処理（画像の複製など）の前に早く断るために使う。
 * 最終的な判定は {@link transitionEmojiAddRequest} の UPDATE で行うので、これが true でも書き換えに失敗することはある。
 *
 * @param action - 操作の名前
 * @param status - 申請の今の状態
 * @returns できるなら true
 * @internal
 */
export function canEmojiAddRequest(
	action: EmojiAddRequestAction,
	status: EmojiAddRequestStatus,
): boolean {
	return (emojiAddRequestTransitions[action].from as readonly string[]).includes(status);
}

/**
 * インポート申請が、今の状態でその操作をできるかを返す。
 *
 * @remarks
 * {@link canEmojiAddRequest} と同じく、早く断るための確認。
 *
 * @param action - 操作の名前
 * @param status - 申請の今の状態
 * @returns できるなら true
 * @internal
 */
export function canEmojiImportRequest(
	action: EmojiImportRequestAction,
	status: EmojiImportRequestStatus,
): boolean {
	return (emojiImportRequestTransitions[action].from as readonly string[]).includes(status);
}

// #endregion

// #region 書き換え

/**
 * 追加申請の状態を、遷移表に沿って書き換える。
 *
 * @remarks
 * `WHERE id = ? AND status IN (from)` で UPDATE するので、ほかの操作が先に状態を変えていたら何も書かずに false を返す。
 * 呼び出し側は false のとき `invalidStatus` を返す。
 * 絵文字の登録と一緒に行うときは、同じトランザクションの `manager` を渡す。
 *
 * @param action - 操作の名前（status は表の to が入る）
 * @param id - 申請の ID
 * @param values - status 以外に書き換える列
 * @param manager - トランザクション中なら、その EntityManager
 * @returns 書き換えたら true、状態が合わず書き換えなかったら false
 * @internal
 */
export async function transitionEmojiAddRequest(
	action: EmojiAddRequestAction,
	id: EmojiAddRequest["id"],
	values: Omit<QueryDeepPartialEntity<EmojiAddRequest>, "status">,
	manager: EntityManager = db.manager,
): Promise<boolean> {
	const { from, to } = emojiAddRequestTransitions[action];
	const result = await manager
		.getRepository(EmojiAddRequest)
		.update({ id, status: In([...from]) }, { ...values, status: to });
	return (result.affected ?? 0) > 0;
}

/**
 * インポート申請の状態を、遷移表に沿って書き換える。
 *
 * @remarks
 * 仕組みは {@link transitionEmojiAddRequest} と同じ。false のとき呼び出し側は `alreadyProcessed` を返す。
 *
 * @param action - 操作の名前
 * @param id - 申請の ID
 * @param values - status 以外に書き換える列
 * @param manager - トランザクション中なら、その EntityManager
 * @returns 書き換えたら true、状態が合わず書き換えなかったら false
 * @internal
 */
export async function transitionEmojiImportRequest(
	action: EmojiImportRequestAction,
	id: EmojiImportRequest["id"],
	values: Omit<QueryDeepPartialEntity<EmojiImportRequest>, "status">,
	manager: EntityManager = db.manager,
): Promise<boolean> {
	const { from, to } = emojiImportRequestTransitions[action];
	const result = await manager
		.getRepository(EmojiImportRequest)
		.update({ id, status: In([...from]) }, { ...values, status: to });
	return (result.affected ?? 0) > 0;
}

// #endregion
