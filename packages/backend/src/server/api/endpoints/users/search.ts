/**
 * @packageDocumentation
 *
 * ユーザーを検索する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/search`（GET `/api/users/search` で呼び出し）
 * - 認証は不要（クエリで検索）。query・limit 等でユーザーを検索する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { UserProfiles, Users } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import define from "../../define.js";

export const meta = {
	tags: ["users"],

	requireCredential: true,
	requireCredentialPrivateMode: true,

	description:
		"クエリに基づいてユーザーを検索する。ユーザー名・表示名・@username などで検索可能。offset/limit でページネーション、origin でローカル/リモートを絞れる。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "User",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		query: {
			type: "string",
			description: "検索する文字列。ユーザー名や @username など。",
		},
		offset: {
			type: "integer",
			default: 0,
			description: "先頭からスキップする件数。",
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 100,
			default: 10,
			description: "取得する件数。",
		},
		origin: {
			type: "string",
			enum: ["local", "remote", "combined"],
			default: "combined",
			description: "検索対象。local はローカルのみ、remote はリモートのみ、combined は両方。",
		},
		detail: {
			type: "boolean",
			default: true,
			description: "true のとき詳細情報を含めて返す。",
		},
	},
	required: ["query"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const activeThreshold = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30&#26085;

	const isUsername = ps.query.startsWith("@");

	let users: User[] = [];

	const querys = ps.query.replaceAll(/\s/g, "+").split("+");

	if (
		["誕生日", "たんじょうび", "birthday"].includes(querys?.[0].toLowerCase())
	) {
		const now = new Date();
		const profQuery = UserProfiles.createQueryBuilder("prof")
			.select("prof.userId")
			.where("user.birthday LIKE :birthday", {
				birthday: `%${`0${now.getMonth()}`.slice(
					-2,
				)}-${`0${now.getDate()}`.slice(-2)}`,
			});

		if (ps.origin === "local") {
			profQuery.andWhere("prof.userHost IS NULL");
		} else if (ps.origin === "remote") {
			profQuery.andWhere("prof.userHost IS NOT NULL");
		}

		const query = Users.createQueryBuilder("user")
			.leftJoinAndSelect("user.avatar", "avatar")
			.leftJoinAndSelect("user.banner", "banner")
			.where(`user.id IN (${profQuery.getQuery()})`)
			.andWhere(
				new Brackets((qb) => {
					qb.where("user.updatedAt IS NULL").orWhere(
						"user.updatedAt > :activeThreshold",
						{ activeThreshold: activeThreshold },
					);
				}),
			)
			.andWhere("user.isSuspended = FALSE")
			.setParameters(profQuery.getParameters());

		users = users.concat(
			await query
				.orderBy("user.updatedAt", "DESC", "NULLS LAST")
				.take(ps.limit)
				.skip(ps.offset)
				.getMany(),
		);
	} else if (isUsername) {
		const usernameQuery = Users.createQueryBuilder("user")
			.leftJoinAndSelect("user.avatar", "avatar")
			.leftJoinAndSelect("user.banner", "banner")
			.where("user.usernameLower LIKE :username", {
				username: `${querys?.[0].replace("@", "").toLowerCase()}%`,
			})
			.andWhere(
				new Brackets((qb) => {
					qb.where("user.updatedAt IS NULL").orWhere(
						"user.updatedAt > :activeThreshold",
						{ activeThreshold: activeThreshold },
					);
				}),
			)
			.andWhere("user.isSuspended = FALSE");

		if (ps.origin === "local") {
			usernameQuery.andWhere("user.host IS NULL");
		} else if (ps.origin === "remote") {
			usernameQuery.andWhere("user.host IS NOT NULL");
		}

		users = await usernameQuery
			.orderBy("user.updatedAt", "DESC", "NULLS LAST")
			.take(ps.limit)
			.skip(ps.offset)
			.getMany();
	} else {
		const nameQuery = Users.createQueryBuilder("user")
			.leftJoinAndSelect("user.avatar", "avatar")
			.leftJoinAndSelect("user.banner", "banner")
			.where(
				new Brackets((qb) => {
					qb.where("user.name ILIKE :query", { query: `%${querys?.[0]}%` });

					// ユーザー名として妥当な場合はユーザー名も検索する
					if (Users.validateLocalUsername(querys?.[0])) {
						qb.orWhere("user.usernameLower LIKE :username", {
							username: `%${querys?.[0].toLowerCase()}%`,
						});
					}
				}),
			)
			.andWhere(
				new Brackets((qb) => {
					qb.where("user.updatedAt IS NULL").orWhere(
						"user.updatedAt > :activeThreshold",
						{ activeThreshold: activeThreshold },
					);
				}),
			)
			.andWhere("user.isSuspended = FALSE");

		if (ps.origin === "local") {
			nameQuery.andWhere("user.host IS NULL");
		} else if (ps.origin === "remote") {
			nameQuery.andWhere("user.host IS NOT NULL");
		}

		users = await nameQuery
			.orderBy("user.updatedAt", "DESC", "NULLS LAST")
			.take(ps.limit)
			.skip(ps.offset)
			.getMany();

		if (users.length < ps.limit) {
			const profQuery = UserProfiles.createQueryBuilder("prof")
				.select("prof.userId")
				.where(
					new Brackets((qb) => {
						qb.where("prof.description ILIKE :query", {
							query: `%${querys?.[0]}%`,
						});
						qb.orWhere("prof.location LIKE :query", {
							query: `%${querys?.[0]}%`,
						});
						qb.orWhere("(prof.fields->>'name') LIKE :query", {
							query: `%${querys?.[0]}%`,
						});
						qb.orWhere("(prof.fields->>'value') LIKE :query", {
							query: `%${querys?.[0]}%`,
						});
					}),
				);

			if (ps.origin === "local") {
				profQuery.andWhere("prof.userHost IS NULL");
			} else if (ps.origin === "remote") {
				profQuery.andWhere("prof.userHost IS NOT NULL");
			}

			const query = Users.createQueryBuilder("user")
				.leftJoinAndSelect("user.avatar", "avatar")
				.leftJoinAndSelect("user.banner", "banner")
				.where(`user.id IN (${profQuery.getQuery()})`)
				.andWhere(
					new Brackets((qb) => {
						qb.where("user.updatedAt IS NULL").orWhere(
							"user.updatedAt > :activeThreshold",
							{ activeThreshold: activeThreshold },
						);
					}),
				)
				.andWhere("user.isSuspended = FALSE")
				.setParameters(profQuery.getParameters());

			users = users.concat(
				await query
					.orderBy("user.updatedAt", "DESC", "NULLS LAST")
					.take(ps.limit)
					.skip(ps.offset)
					.getMany(),
			);
		}
	}

	return await Users.packMany(users, me, { detail: ps.detail });
});
