/**
 * @packageDocumentation
 *
 * ユーザーグループを作成する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/groups/create`（POST `/api/users/groups/create` で呼び出し）
 * - 認証必須。name でグループ名を指定して新規グループを作成する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { UserGroups, UserGroupJoinings } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { invalidateGroupMembersCache } from "@/misc/antenna-members-cache.js";
import type { UserGroup } from "@/models/entities/user-group.js";
import type { UserGroupJoining } from "@/models/entities/user-group-joining.js";
import define from "../../../define.js";

export const meta = {
	tags: ["groups"],

	requireCredential: true,

	kind: "write:user-groups",

	description: "Create a new group.",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "UserGroup",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		name: { type: "string", minLength: 1, maxLength: 100 },
	},
	required: ["name"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const userGroup = await UserGroups.insert({
		id: genId(),
		createdAt: new Date(),
		userId: user.id,
		name: ps.name,
	} as UserGroup).then((x) => UserGroups.findOneByOrFail(x.identifiers[0]));

	// オーナーを追加する
        await UserGroupJoinings.insert({
                id: genId(),
                createdAt: new Date(),
                userId: user.id,
                userGroupId: userGroup.id,
        } as UserGroupJoining);

        invalidateGroupMembersCache(userGroup.id);

        return await UserGroups.pack(userGroup);
});
