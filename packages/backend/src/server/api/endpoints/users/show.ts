/**
 * @packageDocumentation
 *
 * ユーザー詳細を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/show`（GET `/api/users/show` で呼び出し）
 * - 認証は不要（userId または username で指定）。ユーザー情報を 1 件返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import type { FindOptionsWhere } from "typeorm";
import { In, IsNull } from "typeorm";
import { resolveUser } from "@/remote/resolve-user.js";
import { Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { redisClient } from "@/db/redis.js";
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
		if (ps.userIds.length === 0) {
			return [];
		}

		const users = await Users.find({
			where: isAdminOrModerator
				? {
						id: In(ps.userIds),
						isDeleted: false,
				  }
				: {
						id: In(ps.userIds),
						isSuspended: false,
						isDeleted: false,
				  },
			relations: { avatar: true, banner: true },
		});

		// リクエストされた通りに並べ替え
		const _users: User[] = [];
		for (const id of ps.userIds) {
			const user = users.find((x) => x.id === id);
			if (user) _users.push(user);
		}

		const viewerId = me?.id ?? "anon";
		const cacheKeys = _users.map((u) =>
			Users.getUserShowDetailedCacheKey(u.id, me?.id ?? null),
		);
		const cachedList = await redisClient.mget(...cacheKeys);
		if (cachedList.every((c) => c != null)) {
			return cachedList.map((c) =>
				JSON.parse(c!) as Awaited<ReturnType<typeof Users.pack>>,
			);
		}
		const packedList = await Users.packMany(_users, me, {
			detail: true,
		});
		const ttl = Users.getUserShowDetailedCacheTtlSec();
		await Promise.all([
			...packedList.map((_, i) =>
				redisClient.set(
					cacheKeys[i],
					JSON.stringify(packedList[i]),
					"EX",
					ttl,
				),
			),
			..._users.map((u) =>
				redisClient.sadd(
					`users:show:detailed:${u.id}:viewers`,
					viewerId,
				),
			),
		]);
		return packedList;
	}
	// ユーザーを検索する（avatar/banner を事前ロードして pack 内の DriveFiles 取得を削減）
	if (typeof ps.username === "string") {
		if (typeof ps.host === "string") {
			const usernameLower = ps.username.toLowerCase();
			user = await Users.findOne({
				where: { usernameLower, host: ps.host },
				relations: { avatar: true, banner: true },
			});

			if (user == null) {
				user = await resolveUser(ps.username, ps.host).catch((e) => {
					apiLogger.warn(`failed to resolve remote user: ${e}`);
					throw new ApiError(meta.errors.failedToResolveRemoteUser);
				});
				// resolveUser 戻り値は relation 未ロードのため、avatar/banner 付きで再取得
				user = await Users.findOneOrFail({
					where: { id: user.id },
					relations: { avatar: true, banner: true },
				});
			}
		} else {
			user = await Users.findOne({
				where: {
					usernameLower: ps.username.toLowerCase(),
					host: IsNull(),
				},
				relations: { avatar: true, banner: true },
			});
		}
	} else {
		user = await Users.findOne({
			where: { id: ps.userId } as FindOptionsWhere<User>,
			relations: { avatar: true, banner: true },
		});
	}

		if (
			user == null ||
			(!isAdminOrModerator && (user.isSuspended || user.isDeleted))
		) {
			throw new ApiError(meta.errors.noSuchUser);
		}

		const cacheKey = Users.getUserShowDetailedCacheKey(user.id, me?.id ?? null);
		const cached = await redisClient.get(cacheKey);
		if (cached != null) {
			return JSON.parse(cached) as Awaited<ReturnType<typeof Users.pack>>;
		}
		const packed = await Users.pack(user, me, {
			detail: true,
		});
		const ttl = Users.getUserShowDetailedCacheTtlSec();
		await redisClient.set(cacheKey, JSON.stringify(packed), "EX", ttl);
		const viewersKey = `users:show:detailed:${user.id}:viewers`;
		await redisClient.sadd(viewersKey, me?.id ?? "anon");
		return packed;
});
