/**
 * @packageDocumentation
 *
 * ユーザーリストにユーザーを追加する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/lists/push`（POST `/api/users/lists/push` で呼び出し）
 * - 認証必須。listId と userId で指定したユーザーをリストに追加する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { pushUserToUserList } from "@/services/user-list/push.js";
import { UserLists, UserListJoinings, Blockings } from "@/models/index.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { getUser } from "../../../common/getters.js";

export const meta = {
	tags: ["lists", "users"],

	requireCredential: true,

	kind: "write:account",

	description: "指定ユーザーをユーザーリストに追加します。",

	errors: {
		noSuchList: {
			message: "そのlistは存在しません。",
			code: "NO_SUCH_LIST",
			id: "2214501d-ac96-4049-b717-91e42272a711",
		},

		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "a89abd3d-f0bc-4cce-beb1-2f446f4f1e6a",
		},

		alreadyAdded: {
			message: "That user has already been added to that list.",
			code: "ALREADY_ADDED",
			id: "1de7c884-1595-49e9-857e-61f12f4d4fc5",
		},

		youHaveBeenBlocked: {
			message:
				"You cannot push this user because you have been blocked by this user.",
			code: "YOU_HAVE_BEEN_BLOCKED",
			id: "990232c5-3f9d-4d83-9f3f-ef27b6332a4b",
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

	// ブロック関係を確認する
	if (user.id !== me.id) {
		const block = await Blockings.findOneBy({
			blockerId: user.id,
			blockeeId: me.id,
		});
		if (block) {
			throw new ApiError(meta.errors.youHaveBeenBlocked);
		}
	}

	const exist = await UserListJoinings.findOneBy({
		userListId: userList.id,
		userId: user.id,
	});

	if (exist) {
		throw new ApiError(meta.errors.alreadyAdded);
	}

	// ユーザーを追加する
	await pushUserToUserList(user, userList);
});
