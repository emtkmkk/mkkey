/**
 * @packageDocumentation
 *
 * 管理者が、指定したローカルユーザーの Bluesky ブリッジ用の身元を止める API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/disable-user`
 * - DID と鍵は残す。`admin/atproto/enable-user` でもう一度有効にすれば、同じ DID とハンドルに戻る。
 * - 身元が無いユーザーなら何もせず、null を返す。
 *
 * @see {@link ../../../../../remote/atproto/identity.ts} 身元の停止
 * @internal
 */
import define from "../../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import {
	disableAtprotoIdentity,
	packAtprotoIdentityForAdmin,
} from "@/remote/atproto/identity.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description: "ローカルユーザーの Bluesky ブリッジ用の身元を止める（DID は残す）。",
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

	const identity = await disableAtprotoIdentity(user);
	if (identity == null) return null;

	await insertModerationLog(me, "atprotoDisableUser", {
		targetId: user.id,
		did: identity.did,
	});

	return packAtprotoIdentityForAdmin(identity);
});
