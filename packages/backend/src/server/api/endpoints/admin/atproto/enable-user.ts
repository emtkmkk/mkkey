/**
 * @packageDocumentation
 *
 * 管理者が、指定したローカルユーザーの Bluesky ブリッジ用の身元（DID・ハンドル）を有効にする API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/enable-user`
 * - 身元が無ければ発行して plc.directory に登録する。止めていたら再開する。何度呼んでもよい。
 * - 試験期間用。本人の同意を取ってから使うこと。
 *   TODO: ユーザー設定の画面からのオプトインができたら、管理者がほかの人を有効にする用途は無くす（実装手順 12）
 * - WARNING: plc.directory への登録は取り消せない（DID は公開の場所に残り続ける）。
 *
 * @see {@link ../../../../../remote/atproto/identity.ts} 身元の発行
 * @internal
 */
import define from "../../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import {
	enableAtprotoIdentity,
	packAtprotoIdentityForAdmin,
} from "@/remote/atproto/identity.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description:
		"ローカルユーザーの Bluesky ブリッジ用の身元を有効にする（無ければ DID を発行して登録する）。",
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

	const identity = await enableAtprotoIdentity(user);

	await insertModerationLog(me, "atprotoEnableUser", {
		targetId: user.id,
		did: identity.did,
	});

	return packAtprotoIdentityForAdmin(identity);
});
