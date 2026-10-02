/**
 * @packageDocumentation
 *
 * 管理者が、ローカルユーザーの自前 PDS から follow / like を 1 件消す試験用の API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/test-delete`
 * - `admin/atproto/test-write` で書いたレコードを消し、取り消しが Bluesky 側に反映されるかを確かめるためのもの。
 * - 消す対象は引数の `uri`（`test-write` が返した `at://<DID>/<collection>/<rkey>`）で渡す。
 * - 消せるのは、そのユーザー自身の follow / like だけ。プロフィールや他人のレコードは消さない。
 * - TODO: 実装手順 8（フォロー・リアクションからの自動の書き込み）ができたら、この API は消す。
 *
 * @see {@link ../../../../../remote/atproto/repo.ts} レコードの削除
 * @internal
 */
import define from "../../../define.js";
import { AtprotoIdentities } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { deleteBridgeRecord } from "@/remote/atproto/repo.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description:
		"試験用。ローカルユーザーの自前 PDS から、Bluesky の follow か like を 1 件消す。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		/** レコードの持ち主のローカルユーザー */
		userId: { type: "string", format: "misskey:id" },
		/** 消すレコードの URI（例: `at://did:plc:xxx/app.bsky.graph.follow/3kxxx`） */
		uri: { type: "string", minLength: 1 },
	},
	required: ["userId", "uri"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const identity = await AtprotoIdentities.findOneBy({ userId: ps.userId });
	if (identity == null) throw new Error("no atproto identity for the user");

	// 持ち主・種類の確認は deleteBridgeRecord が、状態の確認は writeRecords が行う
	const commit = await deleteBridgeRecord(identity, ps.uri);

	await insertModerationLog(me, "atprotoTestDelete", {
		targetId: identity.userId,
		did: identity.did,
		uri: ps.uri,
		rev: commit.rev,
	});

	return {
		did: identity.did,
		uri: ps.uri,
		commitCid: commit.commitCid,
		rev: commit.rev,
	};
});
