/**
 * @packageDocumentation
 *
 * フォローリクエストをキャンセルする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `following/requests/cancel`（POST `/api/following/requests/cancel` で呼び出し）
 * - 認証必須。userId で指定したユーザーへ送ったフォローリクエストを取り下げる。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import cancelFollowRequest from "@/services/following/requests/cancel.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { getUser } from "../../../common/getters.js";
import { Users } from "@/models/index.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";

export const meta = {
	tags: ["following", "account"],

	requireCredential: true,

	kind: "write:following",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "4e68c551-fc4c-4e46-bb41-7d4a37bf9dab",
		},

		followRequestNotFound: {
			message: "フォローリクエストがありません。",
			code: "FOLLOW_REQUEST_NOT_FOUND",
			id: "089b125b-d338-482a-9a09-e2622ac9f8d4",
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
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// フォロー先を取得する
	const followee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	try {
		await cancelFollowRequest(followee, user);
	} catch (e) {
		if (e instanceof IdentifiableError) {
			if (e.id === "17447091-ce07-46dd-b331-c1fd4f15b1e7")
				throw new ApiError(meta.errors.followRequestNotFound);
		}
		throw e;
	}

	// クライアントがボタン表示を即座に更新できるよう relation を含めて返す
	return await Users.pack(followee.id, user, {
		relation: true,
	});
});
