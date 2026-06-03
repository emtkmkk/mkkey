/**
 * @packageDocumentation
 *
 * フォロー関係のキャッシュを無効化する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `following/invalidate`（POST `/api/following/invalidate` で呼び出し）
 * - 認証必須。userId で指定したユーザーとのフォロー状態を再取得してキャッシュを更新する。
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

		followerIsYourself: {
			message: "自分をFollowerに指定する事は出来ません。",
			code: "FOLLOWER_IS_YOURSELF",
			id: "07dc03b9-03da-422d-885b-438313707662",
		},

		notFollowing: {
			message: "The other use is not following you.",
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
	const followee = user;

	// フォロワーが自分でないか確認する
	if (user.id === ps.userId) {
		throw new ApiError(meta.errors.followerIsYourself);
	}

	// フォロワーを取得する
	const follower = await getUser(ps.userId).catch((e) => {
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

	await deleteFollowing(follower, followee, false, { kickFollower: true });

	return await Users.pack(followee.id, user);
});
