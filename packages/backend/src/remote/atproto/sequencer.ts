/**
 * @packageDocumentation
 *
 * 自前 PDS の firehose（`com.atproto.sync.subscribeRepos`）で流す出来事を採番して保存し、送る形に組み立てる。
 *
 * @remarks
 * - 出来事は `atproto_repo_seq` に保存する。送る側（{@link ../../server/atproto/subscribe-repos.ts}）はそこを読むだけ。
 * - **採番の順番を守るため、書き込みは必ず {@link lockSequencer} を取ったトランザクションの中で行う。**
 *   ロックが無いと、先に番号を取ったトランザクションが後から確定することがある。そうなると、送る側が
 *   その番号を飛ばしてしまい、Relay から見て出来事が 1 件消える。
 *   follow / like しか書かないので、全員の書き込みを 1 本の列に並べても速さは問題にならない。
 * - メッセージの形は、ヘッダー（`{op: 1, t: "#commit"}` など）と本体を、それぞれ DAG-CBOR にしてつなげたもの。
 *
 * @see {@link https://atproto.com/specs/event-stream | Event Stream の仕様}
 * @see {@link https://atproto.com/specs/sync | Sync の仕様}
 * @internal
 */

import type { EntityManager } from "typeorm";
import { cborDecode, cborEncode, type LexValue } from "@atproto/lex-cbor";
import { db } from "@/db/postgre.js";
import {
	AtprotoRepoSeq,
	type AtprotoRepoSeqType,
} from "@/models/entities/atproto-repo-seq.js";

// #region 定数

/**
 * 採番の順番を守るためのアドバイザリロックの番号。
 *
 * @remarks
 * ほかの処理のアドバイザリロックとぶつからない値にしている（"atpr" の文字コード）。変えるときは、
 * すべての書き込みが同じ値を使うようにすること。
 */
const SEQUENCER_LOCK_KEY = 0x61747072;

// #endregion

// #region 型

/** 本体の形（`seq` は送るときに足すので入れない） */
type EventBody = { [key: string]: LexValue | undefined };

// #endregion

// #region 書き込み

/**
 * 採番のロックを取る。トランザクションが終わると自動で外れる。
 *
 * @param manager - トランザクションの中の EntityManager
 * @internal
 */
export async function lockSequencer(manager: EntityManager): Promise<void> {
	await manager.query("SELECT pg_advisory_xact_lock($1)", [SEQUENCER_LOCK_KEY]);
}

/**
 * 出来事を 1 件保存する。
 *
 * @remarks
 * NB: 呼ぶ前に、同じトランザクションで {@link lockSequencer} を呼んでおくこと。
 *
 * @param manager - トランザクションの中の EntityManager
 * @param did - 対象のアカウントの DID
 * @param type - 出来事の種類
 * @param body - 本体（`seq` を除く）
 * @internal
 */
export async function appendEvent(
	manager: EntityManager,
	did: string,
	type: AtprotoRepoSeqType,
	body: EventBody,
): Promise<void> {
	await manager.insert(AtprotoRepoSeq, {
		did,
		type,
		event: Buffer.from(cborEncode(stripUndefined(body))),
		createdAt: new Date(),
	});
}

/**
 * 値が `undefined` の項目を取り除く。
 *
 * @remarks
 * DAG-CBOR には `undefined` が無いので、「項目ごと無い」形にしてから符号化する。
 *
 * @param obj - 対象のオブジェクト
 * @returns `undefined` の項目を除いたオブジェクト（元のものは変えない）
 * @internal
 */
function stripUndefined(obj: EventBody): EventBody {
	return Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== undefined),
	);
}

/**
 * ハンドルの確認を促す `#identity` を流す。
 *
 * @remarks
 * 身元を発行・再開したときに流す。Relay と AppView は、これを見て DID とハンドルを確かめ直す。
 *
 * @param did - 対象の DID
 * @param handle - 今のハンドル
 * @internal
 */
export async function emitIdentityEvent(did: string, handle: string): Promise<void> {
	await db.transaction(async (manager) => {
		await lockSequencer(manager);
		await appendEvent(manager, did, "identity", {
			did,
			handle,
			time: new Date().toISOString(),
		});
	});
}

/**
 * アカウントの状態を知らせる `#account` を流す。
 *
 * @remarks
 * 止めたときは `active: false` と `status: "deactivated"`。Relay はこれを見て、そのアカウントの中身を配らなくなる。
 *
 * @param did - 対象の DID
 * @param active - 使える状態か
 * @internal
 */
export async function emitAccountEvent(did: string, active: boolean): Promise<void> {
	await db.transaction(async (manager) => {
		await lockSequencer(manager);
		await appendEvent(manager, did, "account", {
			did,
			active,
			// 使える状態のときは status を付けない（仕様どおり）
			status: active ? undefined : "deactivated",
			time: new Date().toISOString(),
		});
	});
}

// #endregion

// #region メッセージの組み立て

/**
 * 保存した出来事を、firehose で送るメッセージにする。
 *
 * @param row - 保存した出来事
 * @returns 送るバイト列
 * @internal
 */
export function encodeEventFrame(
	row: Pick<AtprotoRepoSeq, "seq" | "type" | "event">,
): Buffer {
	// 保存した本体に seq を足して、符号化し直す
	const body = cborDecode(new Uint8Array(row.event)) as EventBody;
	body.seq = Number(row.seq);
	return Buffer.concat([
		cborEncode({ op: 1, t: `#${row.type}` }),
		cborEncode(body),
	]);
}

/**
 * お知らせのメッセージ（`#info`）を作る。
 *
 * @remarks
 * つなぎ直したときの番号が古すぎて、続きから送れないとき（`OutdatedCursor`）に使う。
 *
 * @param name - お知らせの種類（例: `OutdatedCursor`）
 * @param message - 説明
 * @returns 送るバイト列
 * @internal
 */
export function encodeInfoFrame(name: string, message?: string): Buffer {
	return Buffer.concat([
		cborEncode({ op: 1, t: "#info" }),
		cborEncode(stripUndefined({ name, message })),
	]);
}

/**
 * エラーのメッセージを作る。送った後は接続を閉じること。
 *
 * @param error - エラーの種類（例: `FutureCursor`）
 * @param message - 説明
 * @returns 送るバイト列
 * @internal
 */
export function encodeErrorFrame(error: string, message?: string): Buffer {
	return Buffer.concat([
		cborEncode({ op: -1 }),
		cborEncode(stripUndefined({ error, message })),
	]);
}

// #endregion
