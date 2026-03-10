import type { FindOptionsWhere } from "typeorm";
import { In, IsNull } from "typeorm";
import { resolveUser } from "@/remote/resolve-user.js";
import { Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import define from "../../define.js";
import { apiLogger } from "../../logger.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "Show the properties of a user.",

	res: {
		optional: false,
		nullable: false,
		oneOf: [
			{
				type: "object",
				ref: "UserDetailed",
			},
			{
				type: "array",
				items: {
					type: "object",
					ref: "UserDetailed",
				},
			},
		],
	},

	errors: {
		failedToResolveRemoteUser: {
			message: "リモートユーザ情報の解決に失敗しました。",
			code: "FAILED_TO_RESOLVE_REMOTE_USER",
			id: "ef7b9be4-9cba-4e6f-ab41-90ed171c7d3c",
			kind: "server",
		},

		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "4362f8dc-731f-4ad8-a694-be5a88922a24",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	anyOf: [
		{
			properties: {
				userId: { type: "string", format: "misskey:id" },
			},
			required: ["userId"],
		},
		{
			properties: {
				userIds: {
					type: "array",
					uniqueItems: true,
					items: {
						type: "string",
						format: "misskey:id",
					},
				},
			},
			required: ["userIds"],
		},
		{
			properties: {
				username: { type: "string" },
				host: {
					type: "string",
					nullable: true,
					description: "The local host is represented with `null`.",
				},
			},
			required: ["username"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	let user;

	const isAdminOrModerator = me && (me.isAdmin || me.isModerator);

	if (ps.userIds) {
		if (!isAdminOrModerator) ps.userIds = ps.userIds.filter((x) => x !== "9hlr56vkeu");
		if (ps.userIds.length === 0) {
			return [];
		}

		const users = await Users.findBy(
			isAdminOrModerator
				? {
						id: In(ps.userIds),
						isDeleted: false,
				  }
				: {
						id: In(ps.userIds),
						isSuspended: false,
						isDeleted: false,
				  },
		);

		// リクエストされた通りに並べ替え
		const _users: User[] = [];
		for (const id of ps.userIds) {
			const user = users.find((x) => x.id === id);
			if (user) _users.push(user);
		}

		return await Users.packMany(_users, me, {
			detail: true,
		});
	}
	// Lookup user
	if (typeof ps.username === "string") {
		if (typeof ps.host === "string") {
			const usernameLower = ps.username.toLowerCase();
			user = await Users.findOneBy({ usernameLower, host: ps.host });

			if (user == null) {
				user = await resolveUser(ps.username, ps.host).catch((e) => {
					apiLogger.warn(`failed to resolve remote user: ${e}`);
					throw new ApiError(meta.errors.failedToResolveRemoteUser);
				});
			}
		} else {
			user = await Users.findOneBy({
				usernameLower: ps.username.toLowerCase(),
				host: IsNull(),
			});
		}
	} else {
		const q: FindOptionsWhere<User> = { id: ps.userId };
		user = await Users.findOneBy(q);
	}

		if (
			user == null ||
			(!isAdminOrModerator && (user.isSuspended || user.isDeleted))
		) {
			throw new ApiError(meta.errors.noSuchUser);
		}

		return await Users.pack(user, me, {
			detail: true,
		});
});
