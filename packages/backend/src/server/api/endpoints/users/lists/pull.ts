/**
 * @packageDocumentation
 *
 * ユーザーリストからユーザーを除外する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/lists/pull`（POST `/api/users/lists/pull` で呼び出し）
 * - 認証必須。listId と userId で指定したユーザーをリストから外す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishUserListStream } from "@/services/stream.js";
import { UserLists, UserListJoinings, Users } from "@/models/index.js";
import { invalidateListMembersCache } from "@/misc/antenna-members-cache.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { getUser } from "../../../common/getters.js";

export const meta = {
	tags: ["lists", "users"],

	requireCredential: true,

	kind: "write:account",

	description: "指定ユーザーをユーザーリストから削除します。",

	errors: {
		noSuchList: {
			message: "そのlistは存在しません。",
			code: "NO_SUCH_LIST",
			id: "7f44670e-ab16-43b8-b4c1-ccd2ee89cc02",
		},

		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "588e7f72-c744-4a61-b180-d354e912bda2",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		listId: { type: "string", format: "misskey:id" },
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["listId", "userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// リストを取得する
	const userList = await UserLists.findOneBy({
		id: ps.listId,
		userId: me.id,
	});

	if (userList == null) {
		throw new ApiError(meta.errors.noSuchList);
	}

	// ユーザーを取得する
	const user = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// ユーザーをリストから外す
        await UserListJoinings.delete({ userListId: userList.id, userId: user.id });

        invalidateListMembersCache(userList.id);

        publishUserListStream(userList.id, "userRemoved", await Users.pack(user));
});
