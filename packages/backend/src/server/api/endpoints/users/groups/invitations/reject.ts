/**
 * @packageDocumentation
 *
 * ユーザーグループへの招待を拒否する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/groups/invitations/reject`（POST `/api/users/groups/invitations/reject` で呼び出し）
 * - 認証必須。invitationId で指定した招待を拒否する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { UserGroupInvitations } from "@/models/index.js";
import define from "../../../../define.js";
import { ApiError } from "../../../../error.js";

export const meta = {
	tags: ["groups", "users"],

	requireCredential: true,

	kind: "write:user-groups",

	description:
		"Delete an existing group invitation for the authenticated user without joining the group.",

	errors: {
		noSuchInvitation: {
			message: "そのinvitationは存在しません。",
			code: "NO_SUCH_INVITATION",
			id: "ad7471d4-2cd9-44b4-ac68-e7136b4ce656",
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

	await UserGroupInvitations.delete(invitation.id);
});
