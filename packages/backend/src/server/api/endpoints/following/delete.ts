/**
 * @packageDocumentation
 *
 * フォローを解除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `following/delete`（POST `/api/following/delete` で呼び出し）
 * - 認証必須。userId で指定したユーザーのフォローを解除する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import deleteFollowing from "@/services/following/delete.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { Followings, Users } from "@/models/index.js";
import { HOUR } from "@/const.js";

export const meta = {
	tags: ["following", "users"],

	limit: {
		duration: HOUR,
		max: 100,
	},

	requireCredential: true,

	kind: "write:following",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "5b12c78d-2b28-4dca-99d2-f56139b42ff8",
		},

		followeeIsYourself: {
			message: "自分をFolloweeに指定する事は出来ません。",
			code: "FOLLOWEE_IS_YOURSELF",
			id: "d9e400b9-36b0-4808-b1d8-79e707f1296c",
		},

		notFollowing: {
			message: "あなたはそのユーザをfollowingしていない様です。",
			code: "NOT_FOLLOWING",
			id: "5dbf82f5-c92b-40b1-87d1-6c8c0741fd09",
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
	const follower = user;

	// フォロー先が自分でないか確認する
	if (user.id === ps.userId) {
		throw new ApiError(meta.errors.followeeIsYourself);
	}

	// フォロー先を取得する
	const followee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// フォローしていないか確認する
	const exist = await Followings.findOneBy({
		followerId: follower.id,
		followeeId: followee.id,
	});

	if (exist == null) {
		throw new ApiError(meta.errors.notFollowing);
	}

	await deleteFollowing(follower, followee);

	return await Users.pack(followee.id, user);
});
