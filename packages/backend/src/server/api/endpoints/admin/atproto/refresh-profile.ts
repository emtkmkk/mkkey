/**
 * @packageDocumentation
 *
 * 管理者が、指定したローカルユーザーの Bluesky プロフィールを書き直して firehose に流す API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/refresh-profile`
 * - Relay が「今から後」だけを購読しているときに、最初のコミットを見逃した場合のやり直しに使う。
 * - 身元が無い・止まっているユーザーでは失敗する（先に `admin/atproto/enable-user` を呼ぶこと）。
 *
 * @see {@link ../../../../../remote/atproto/repo.ts} プロフィールの書き直し
 * @internal
 */
import define from "../../../define.js";
import { AtprotoIdentities, Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { emitIdentityEvent } from "@/remote/atproto/sequencer.js";
import { upsertProfile } from "@/remote/atproto/repo.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description:
		"ローカルユーザーの Bluesky プロフィールを書き直し、Relay に知らせる。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });
	if (user == null) throw new Error("user not found");

	const identity = await AtprotoIdentities.findOneBy({ userId: user.id });
	if (identity == null) throw new Error("no atproto identity for the user");
	if (identity.status !== "active") throw new Error("the identity is not active");
	if (identity.plcRegisteredAt == null) {
		throw new Error("the DID is not registered to PLC yet");
	}

	// ハンドルの確認を促してから、プロフィールを書き直す（新しい #commit が firehose に流れる）
	await emitIdentityEvent(identity.did, identity.handle);
	const commit = await upsertProfile(identity, user);

	await insertModerationLog(me, "atprotoRefreshProfile", {
		targetId: user.id,
		did: identity.did,
		rev: commit.rev,
	});

	return {
		did: identity.did,
		handle: identity.handle,
		commitCid: commit.commitCid,
		rev: commit.rev,
	};
});
