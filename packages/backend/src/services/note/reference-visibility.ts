/**
 * @packageDocumentation
 *
 * 参照投稿（status_reference）の可視性判定・検証を一括 SQL で行う。
 *
 * @remarks
 * - 投稿 API の `validateReferenceIds` と AP `getReferences` の URI フィルタで共有する。
 * - N 回 `getNote` ループは使わず、`IN` 句 + `generateVisibilityQuery` でまとめて判定する。
 *
 * @internal
 */
import { Brackets, In, type SelectQueryBuilder } from "typeorm";
import config from "@/config/index.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import { Blockings, Notes } from "@/models/index.js";
import { toArray } from "@/prelude/array.js";
import type {
	ICollection,
	IOrderedCollection,
} from "@/remote/activitypub/type.js";
import { generateVisibilityQuery } from "@/server/api/common/generate-visibility-query.js";

/** API エラー `noSuchReferenceTarget` と同じ ID */
export const NO_SUCH_REFERENCE_TARGET_ERROR_ID =
	"a3f8c2e1-9b4d-4a7f-8e6c-1d5b0a9f3e72";

/** 参照公開可否の閲覧者コンテキスト */
export type ReferenceExposureContext =
	| { kind: "authenticated"; user: { id: User["id"] } }
	| { kind: "anonymous" };

/** 公開 Collection に載せ可能な参照ノートの最小フィールド */
export type ExposedReferenceNote = Pick<
	Note,
	"id" | "uri" | "userId" | "visibility" | "localOnly"
>;

/**
 * 純粋 RT（本文・ファイル・投票なしのリノート）かどうか
 *
 * @param note - 判定対象
 * @returns 純粋 RT なら true
 * @internal
 */
export function isPureRenote(
	note: Pick<Note, "renoteId" | "text" | "fileIds" | "hasPoll">,
): boolean {
	return !!(
		note.renoteId &&
		!note.text &&
		note.fileIds.length === 0 &&
		!note.hasPoll
	);
}

/**
 * 参照先ノートの AP / Web URI を返す
 *
 * @param note - id と uri を持つノート
 * @returns 連合 URI（ローカルは自インスタンス URL）
 * @public
 */
export function getReferenceUri(note: Pick<Note, "id" | "uri">): string {
	return note.uri ?? `${config.url}/notes/${note.id}`;
}

/**
 * AP references Collection に実質的な参照が含まれるかどうか
 *
 * @param collection - resolve 済みの Collection / OrderedCollection
 * @returns 空 shell のみなら false
 * @remarks
 * NOTE: `note.references != null` だけでは空の器も true になるため、実体（items）だけで判定する。
 * NOTE: 0件誤表示を防ぐため、first URL / next / totalItems は根拠に使わない。
 * NOTE: followers 限定参照の取りこぼしは、誤表示防止を優先して許容する。
 * @internal
 */
export function referencesCollectionHasSubstance(
	collection: ICollection | IOrderedCollection | Record<string, unknown>,
): boolean {
	const c = collection as Record<string, unknown>;

	// Collection 直下に items / orderedItems があるパターン
	const items = toArray(c.items as string | string[] | undefined);
	if (items.length > 0) return true;

	const orderedItems = toArray(
		c.orderedItems as string | string[] | undefined,
	);
	if (orderedItems.length > 0) return true;

	// first がオブジェクトの場合のみ、その中の items を見る
	const first = c.first;
	if (typeof first === "object" && first != null) {
		const firstObj = first as Record<string, unknown>;
		const firstItems = toArray(
			firstObj.items as string | string[] | undefined,
		);
		if (firstItems.length > 0) return true;
	}

	return false;
}

function applyExposureFilter(
	qb: SelectQueryBuilder<Note>,
	context: ReferenceExposureContext,
): void {
	qb.andWhere("note.deletedAt IS NULL");

	if (context.kind === "anonymous") {
		qb.andWhere(
			new Brackets((sub) => {
				sub
					.where(`note.visibility = 'public'`)
					.orWhere(`note.visibility = 'home'`);
			}),
		).andWhere(`note.localOnly = false`);
	} else {
		generateVisibilityQuery(qb, context.user);
	}
}

/**
 * 閲覧者コンテキストに応じて参照 ID を一括フィルタする
 *
 * @param referenceIds - 親投稿の referenceIds
 * @param context - 匿名 / 認証済み
 * @returns 公開可能な参照ノート（純粋 RT 除外済み）
 * @internal
 */
export async function fetchExposedReferences(
	referenceIds: Note["id"][],
	context: ReferenceExposureContext,
): Promise<ExposedReferenceNote[]> {
	if (referenceIds.length === 0) return [];

	const uniqueIds = [...new Set(referenceIds)];
	const qb = Notes.createQueryBuilder("note")
		.where("note.id IN (:...ids)", { ids: uniqueIds })
		.select([
			"note.id",
			"note.uri",
			"note.userId",
			"note.visibility",
			"note.localOnly",
			"note.renoteId",
			"note.text",
			"note.fileIds",
			"note.hasPoll",
		]);

	applyExposureFilter(qb, context);
	const notes = await qb.getMany();
	return notes.filter((n) => !isPureRenote(n));
}

/**
 * 投稿 API 用: referenceIds を一括検証し、保存可能な ID のみ返す
 *
 * @param user - 投稿者
 * @param referenceIds - リクエストの参照 ID 一覧
 * @returns 検証済み ID（純粋 RT はサイレント除外）
 * @throws {IdentifiableError} 存在しない・閲覧不可・ブロック時
 * @internal
 */
export async function validateReferenceIds(
	user: User,
	referenceIds: Note["id"][],
): Promise<Note["id"][]> {
	if (referenceIds.length === 0) return [];

	const qb = Notes.createQueryBuilder("note")
		.where("note.id IN (:...ids)", { ids: referenceIds })
		.andWhere("note.deletedAt IS NULL")
		.select([
			"note.id",
			"note.userId",
			"note.renoteId",
			"note.text",
			"note.fileIds",
			"note.hasPoll",
		]);
	generateVisibilityQuery(qb, user);
	const notes = await qb.getMany();

	const valid = notes.filter((n) => !isPureRenote(n));

	const authorIds = [
		...new Set(valid.map((n) => n.userId).filter((id) => id !== user.id)),
	];
	if (authorIds.length > 0) {
		const blocks = await Blockings.findBy({
			blockerId: In(authorIds),
			blockeeId: user.id,
		});
		if (blocks.length > 0) {
			throw new IdentifiableError(
				NO_SUCH_REFERENCE_TARGET_ERROR_ID,
				"参照先が存在しないか閲覧できません。",
				false,
			);
		}
	}

	const validIdSet = new Set(valid.map((n) => n.id));
	const pureRenoteIdSet = new Set(
		notes.filter((n) => isPureRenote(n)).map((n) => n.id),
	);

	for (const id of referenceIds) {
		if (pureRenoteIdSet.has(id)) continue;
		if (!validIdSet.has(id)) {
			throw new IdentifiableError(
				NO_SUCH_REFERENCE_TARGET_ERROR_ID,
				"参照先が存在しないか閲覧できません。",
				false,
			);
		}
	}

	return referenceIds.filter((id) => validIdSet.has(id));
}

/**
 * packMany 用: 複数親投稿の閲覧者可視参照件数を一括算出
 *
 * @param notes - TL 等の親投稿一覧
 * @param me - 閲覧者（未ログインは null）
 * @returns noteId → 見えている参照件数
 * @internal
 */
export async function countVisibleReferencesBatch(
	notes: Note[],
	me?: { id: User["id"] } | null,
): Promise<Map<Note["id"], number>> {
	const result = new Map<Note["id"], number>();
	const noteToRefIds = new Map<Note["id"], Note["id"][]>();
	const allRefIds = new Set<Note["id"]>();

	for (const note of notes) {
		if (!note.userHost) continue;
		const refIds = (note.referenceIds ?? []).filter(
			(x) => !/\W/.test(x) && x !== note.renoteId,
		);
		if (refIds.length === 0 && !note.hasReferences) continue;
		noteToRefIds.set(note.id, refIds);
		for (const id of refIds) allRefIds.add(id);
	}

	if (allRefIds.size === 0) {
		for (const note of notes) {
			if (note.userHost && note.hasReferences) {
				result.set(note.id, 0);
			}
		}
		return result;
	}

	const context: ReferenceExposureContext = me
		? { kind: "authenticated", user: me }
		: { kind: "anonymous" };
	const exposed = await fetchExposedReferences([...allRefIds], context);
	const visibleSet = new Set(exposed.map((n) => n.id));

	for (const [noteId, refIds] of noteToRefIds) {
		result.set(noteId, refIds.filter((id) => visibleSet.has(id)).length);
	}

	for (const note of notes) {
		if (note.userHost && note.hasReferences && !result.has(note.id)) {
			result.set(note.id, 0);
		}
	}

	return result;
}
