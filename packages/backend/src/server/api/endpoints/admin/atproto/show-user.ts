/**
 * @packageDocumentation
 *
 * 管理者が、指定したローカルユーザーの Bluesky ブリッジ用の身元を見る API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/show-user`
 * - 身元が無いユーザーなら null を返す。秘密鍵は返さない。
 *
 * @see {@link ../../../../../remote/atproto/identity.ts} 身元の形
 * @internal
 */
import define from "../../../define.js";
import { AtprotoIdentities } from "@/models/index.js";
import { packAtprotoIdentityForAdmin } from "@/remote/atproto/identity.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "read:admin:show-user",

	description: "ローカルユーザーの Bluesky ブリッジ用の身元（DID・ハンドル・状態）を返す。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const identity = await AtprotoIdentities.findOneBy({ userId: ps.userId });
	return identity == null ? null : packAtprotoIdentityForAdmin(identity);
});
