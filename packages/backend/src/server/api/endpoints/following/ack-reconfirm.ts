/**
 * @packageDocumentation
 *
 * 再フォロー確認ダイアログを承認したあと、対応レコードを削除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `following/ack-reconfirm`（POST `/api/following/ack-reconfirm` で呼び出し）
 * - Web UI のフォローボタンが、確認ダイアログ承認後に `following/create` と併せて呼ぶ。
 *
 * @see {@link services/following/follow-reconfirm} レコード削除
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { Users } from "@/models/index.js";
import { ackFollowReconfirm } from "@/services/following/follow-reconfirm.js";

export const meta = {
	tags: ["following", "account"],

	requireCredential: true,

	kind: "write:following",

	description:
		"再フォロー確認ダイアログを承認したあと、対象ユーザーとの follow_reconfirm レコードを削除する。",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "UserLite",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: {
			type: "string",
			format: "misskey:id",
			description: "再フォロー確認を承認した対象ユーザーの ID。",
		},
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const target = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	await ackFollowReconfirm(user.id, target.id);

	return await Users.pack(target.id, user, {
		relation: true,
	});
});
