/**
 * @packageDocumentation
 *
 * ユーザーグループへの招待を承諾する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/groups/invitations/accept`（POST `/api/users/groups/invitations/accept` で呼び出し）
 * - 認証必須。invitationId で指定した招待を承諾し、グループに参加する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { UserGroupJoinings, UserGroupInvitations } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { invalidateGroupMembersCache } from "@/misc/antenna-members-cache.js";
import type { UserGroupJoining } from "@/models/entities/user-group-joining.js";
import { ApiError } from "../../../../error.js";
import define from "../../../../define.js";

export const meta = {
	tags: ["groups", "users"],

	requireCredential: true,

	kind: "write:user-groups",

	description: "自分が招待されたユーザーグループに参加します。",

	errors: {
		noSuchInvitation: {
			message: "そのinvitationは存在しません。",
			code: "NO_SUCH_INVITATION",
			id: "98c11eca-c890-4f42-9806-c8c8303ebb5e",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		invitationId: { type: "string", format: "misskey:id" },
	},
	required: ["invitationId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// 招待を取得する
	const invitation = await UserGroupInvitations.findOneBy({
		id: ps.invitationId,
	});

	if (invitation == null) {
		throw new ApiError(meta.errors.noSuchInvitation);
	}

	if (invitation.userId !== user.id) {
		throw new ApiError(meta.errors.noSuchInvitation);
	}

	// ユーザーを追加する
        await UserGroupJoinings.insert({
                id: genId(),
                createdAt: new Date(),
                userId: user.id,
                userGroupId: invitation.userGroupId,
        } as UserGroupJoining);

        invalidateGroupMembersCache(invitation.userGroupId);

        UserGroupInvitations.delete(invitation.id);
});
