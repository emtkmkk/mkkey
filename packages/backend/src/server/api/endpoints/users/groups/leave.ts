/**
 * @packageDocumentation
 *
 * ユーザーグループから脱退する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/groups/leave`（POST `/api/users/groups/leave` で呼び出し）
 * - 認証必須。groupId で指定したグループから自分を脱退させる。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { UserGroups, UserGroupJoinings } from "@/models/index.js";
import { invalidateGroupMembersCache } from "@/misc/antenna-members-cache.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";

export const meta = {
	tags: ["groups", "users"],

	requireCredential: true,

	kind: "write:user-groups",

	description:
		"Leave a group. The owner of a group can not leave. They must transfer ownership or delete the group instead.",

	errors: {
		noSuchGroup: {
			message: "そのgroupは存在しません。",
			code: "NO_SUCH_GROUP",
			id: "62780270-1f67-5dc0-daca-3eb510612e31",
		},

		youAreOwner: {
			message: "Your are the owner.",
			code: "YOU_ARE_OWNER",
			id: "b6d6e0c2-ef8a-9bb8-653d-79f4a3107c69",
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

	if (me.id === userGroup.userId) {
		throw new ApiError(meta.errors.youAreOwner);
	}

        await UserGroupJoinings.delete({ userGroupId: userGroup.id, userId: me.id });

        invalidateGroupMembersCache(userGroup.id);
});
