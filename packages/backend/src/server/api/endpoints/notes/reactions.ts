import type { FindOptionsWhere } from "typeorm";
import { DeepPartial, Like, Not, In } from "typeorm";
import {
	Blockings,
	Followings,
	Mutings,
	NoteReactions,
} from "@/models/index.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getNote } from "../../common/getters.js";

export const meta = {
	tags: ["notes", "reactions"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	allowGet: true,
	cacheSec: 60,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "NoteReaction",
		},
	},

	errors: {
		noSuchNote: {
			message: "No such note.",
			code: "NO_SUCH_NOTE",
			id: "263fff3d-d0e1-4af4-bea7-8408059b451a",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: { type: "string", format: "misskey:id" },
		type: { type: "string", nullable: true },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		offset: { type: "integer", default: 0 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
	},
	required: ["noteId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// check note visibility
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	let query = NoteReactions.createQueryBuilder("reaction").where(
		"reaction.noteId = :noteId",
		{ noteId: note.id },
	);

	if (user?.id) {
		if (note.userId !== user.id) {
			const followingUserIds = (
				await Followings.createQueryBuilder("following")
					.select("following.followeeId")
					.where("following.followerId = :followerId", { followerId: user.id })
					.getMany()
			).map((x) => x.followeeId);

			if (followingUserIds.length > 0) {
				query.andWhere(
					"(reaction.userId IN (:...followingUserIds) OR user.isExplorable = true)",
					{
						followingUserIds,
					},
				);
			} else {
				query.andWhere("user.isExplorable = true");
			}
		}

		const mutingUserIds = (
			await Mutings.createQueryBuilder("muting")
				.select("muting.muteeId")
				.where("muting.muterId = :muterId", { muterId: user.id })
				.getMany()
		).map((x) => x.muteeId);

		const blockingUserIds = (
			await Blockings.createQueryBuilder("blocking")
				.select("blocking.blockeeId")
				.where("blocking.blockerId = :blockerId", { blockerId: user.id })
				.getMany()
		).map((x) => x.blockeeId);

		const blockedUserIds = (
			await Blockings.createQueryBuilder("blocking")
				.select("blocking.blockerId")
				.where("blocking.blockeeId = :blockeeId", { blockeeId: user.id })
				.getMany()
		).map((x) => x.blockerId);

		if ([...mutingUserIds, ...blockingUserIds, ...blockedUserIds].length > 0) {
			query.andWhere("reaction.userId NOT IN (:...mutingUserIds)", {
				mutingUserIds: [
					...mutingUserIds,
					...blockingUserIds,
					...blockedUserIds,
				],
			});
		}
	} else {
		query.andWhere(
			"user.isExplorable = true AND user.isRemoteExplorable = true",
		);
	}

	if (ps.type && note?.isPublicLikeList) {
		// ローカルリアクションはホスト名が . とされているが
		// DB 上ではそうではないので、必要に応じて変換
		// @.指定の場合、同名絵文字のリアクションを全て返す
		const suffix = "@.:";
		if (ps.type.endsWith(suffix)) {
			query.andWhere(
				"(reaction.reaction = :type OR reaction.reaction LIKE :typelike)",
				{
					type: `${ps.type.slice(0, ps.type.length - suffix.length)}:`,
					typelike: `${ps.type.slice(0, ps.type.length - suffix.length)}@%:`,
				},
			);
		} else {
			query.andWhere("reaction.reaction = :type", { type: ps.type });
		}
	}

	query
		.innerJoinAndSelect("reaction.note", "note")
		.innerJoinAndSelect("reaction.user", "user")
		.leftJoinAndSelect("user.avatar", "avatar")
		.leftJoinAndSelect("user.banner", "banner");

	query.orderBy("reaction.id", "DESC");

	const reactions = await query.take(ps.limit).skip(ps.offset).getMany();

	return await NoteReactions.packMany(reactions, user);
});
