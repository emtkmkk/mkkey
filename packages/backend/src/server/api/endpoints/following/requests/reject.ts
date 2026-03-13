/**
 * @packageDocumentation
 *
 * フォローリクエストを拒否する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `following/requests/reject`（POST `/api/following/requests/reject` で呼び出し）
 * - 認証必須。userId で指定したユーザーからのフォローリクエストを拒否する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { rejectFollowRequest } from "@/services/following/reject.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { getUser } from "../../../common/getters.js";

export const meta = {
	tags: ["following", "account"],

	requireCredential: true,

	kind: "write:following",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "abc2ffa6-25b2-4380-ba99-321ff3a94555",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// フォロワーを取得する
	const follower = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	await rejectFollowRequest(user, follower);

	return;
});
