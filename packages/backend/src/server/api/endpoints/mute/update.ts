/**
 * @packageDocumentation
 *
 * ユーザー単位ミュートの対象範囲と共通期限を置き換えるAPI。
 *
 * @remarks
 * - **API パス**: `mute/update`
 * - 空の `types` は全範囲解除として扱う。
 * - `all` は従来の通常ミュートで、他の範囲指定より優先される。
 *
 * @internal
 */

import { muteTypes, type MuteType } from "@/misc/mute-scope.js";
import { NoteWatchings, Users } from "@/models/index.js";
import { replaceMutingScopes } from "@/services/muting.js";
import { publishUserEvent } from "@/services/stream.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";

export const meta = {
	tags: ["account"],
	requireCredential: true,
	kind: "write:mutes",
	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "933f07d7-3970-49ea-88c5-75dc1f10408f",
		},
		muteeIsYourself: {
			message: "自分をMuteeに指定する事は出来ません。",
			code: "MUTEE_IS_YOURSELF",
			id: "5f812bdb-b9a3-42ba-9f84-950a6cb2b132",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: {
			type: "string",
			format: "misskey:id",
		},
		types: {
			type: "array",
			minItems: 0,
			uniqueItems: true,
			items: {
				type: "string",
				enum: muteTypes,
			},
		},
		expiresAt: {
			type: "integer",
			nullable: true,
		},
	},
	required: ["userId", "types"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	if (user.id === ps.userId) {
		throw new ApiError(meta.errors.muteeIsYourself);
	}

	const mutee = await getUser(ps.userId).catch((error) => {
		if (error.id === "15348ddd-432d-49c2-8a5a-8069753becff") {
			throw new ApiError(meta.errors.noSuchUser);
		}
		throw error;
	});

	if (
		ps.types.length > 0 &&
		!user.host &&
		!user.isAdmin &&
		mutee.isAdmin &&
		!ps.expiresAt
	) {
		throw new ApiError();
	}

	const expiresAt = ps.expiresAt ? new Date(ps.expiresAt) : null;
	const types = ps.types as MuteType[];
	const result =
		ps.expiresAt != null && ps.expiresAt <= Date.now()
			? await replaceMutingScopes(user.id, mutee.id, [], null)
			: await replaceMutingScopes(user.id, mutee.id, types, expiresAt);

	publishUserEvent(user.id, result.muting == null ? "unmute" : "mute", mutee);

	if (types.includes("all") || types.includes("note")) {
		void NoteWatchings.delete({
			userId: user.id,
			noteUserId: mutee.id,
		});
	}

	// NOTE: 利用者情報キャッシュはi/updateと異なり更新されないため、最新関係をpackして返す。
	return await Users.pack(mutee.id, user, {
		detail: true,
	});
});
