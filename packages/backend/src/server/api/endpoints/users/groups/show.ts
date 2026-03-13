/**
 * @packageDocumentation
 *
 * ユーザーグループの詳細を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/groups/show`（GET `/api/users/groups/show` で呼び出し）
 * - 認証必須。groupId で指定したグループの情報とメンバーを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { UserGroups, UserGroupJoinings } from "@/models/index.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";

export const meta = {
	tags: ["groups", "account"],

	requireCredential: true,

	kind: "read:user-groups",

	description: "Show the properties of a group.",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "UserGroup",
	},

	errors: {
		noSuchGroup: {
			message: "そのgroupは存在しません。",
			code: "NO_SUCH_GROUP",
			id: "ea04751e-9b7e-487b-a509-330fb6bd6b9b",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		groupId: { type: "string", format: "misskey:id" },
	},
	required: ["groupId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// グループを取得する
	const userGroup = await UserGroups.findOneBy({
		id: ps.groupId,
	});

	if (userGroup == null) {
		throw new ApiError(meta.errors.noSuchGroup);
	}

	const joining = await UserGroupJoinings.findOneBy({
		userId: me.id,
		userGroupId: userGroup.id,
	});

	if (joining == null && userGroup.userId !== me.id) {
		throw new ApiError(meta.errors.noSuchGroup);
	}

	return await UserGroups.pack(userGroup);
});
