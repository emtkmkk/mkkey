/**
 * @packageDocumentation
 *
 * ユーザーリストに紐づくタイムラインを取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/user-list-timeline`（GET `/api/notes/user-list-timeline` で呼び出し）
 * - 認証必須。listId で指定したユーザーリストに含まれるユーザーのノートを取得する。
 * CHANGED: 本家 Misskey 互換のため `kind: read:account` を追加し、アプリトークンからの利用を許可する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import {
	UserLists,
	UserListJoinings,
	Notes,
	Followings,
} from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { rethrowTimelineQueryAsApiError } from "../../common/rethrow-timeline-query-error.js";
import { fetchPackedNotesWithOverfetch } from "../../common/fetch-packed-notes-with-overfetch.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";

export const meta = {
	tags: ["notes", "lists"],

	requireCredential: true,
	kind: "read:account",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Note",
		},
	},

	errors: {
		noSuchList: {
			message: "そのlistは存在しません。",
			code: "NO_SUCH_LIST",
			id: "8fb1fbd5-e476-4c37-9fb0-43d55b63a2ff",
		},
		queryError: {
			message:
				"タイムラインの取得に失敗しました。時間をおいて再度お試しください。",
			code: "QUERY_ERROR",
			id: "620763f4-f621-4533-ab33-0577a1a3c343",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		listId: { type: "string", format: "misskey:id" },
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
		includeMyRenotes: { type: "boolean", default: true },
		includeRenotedMyNotes: { type: "boolean", default: true },
		includeLocalRenotes: { type: "boolean", default: true },
		withFiles: {
			type: "boolean",
			default: false,
			description: "true のとき、ファイルが添付されたノートのみ返します。",
		},
	},
	required: ["listId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const list = await UserLists.findOneBy({
		id: ps.listId,
		userId: user.id,
	});

	if (list == null) {
		throw new ApiError(meta.errors.noSuchList);
	}

	//#region クエリ構築
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
	)
		.innerJoin(
			UserListJoinings.metadata.targetName,
			"userListJoining",
			"userListJoining.userId = note.userId",
		)
		.innerJoinAndSelect("note.user", "user")
		.leftJoinAndSelect("user.avatar", "avatar")
		.leftJoinAndSelect("user.banner", "banner")
		.leftJoinAndSelect("note.reply", "reply")
		.leftJoinAndSelect("note.renote", "renote")
		.leftJoinAndSelect("reply.user", "replyUser")
		.leftJoinAndSelect("replyUser.avatar", "replyUserAvatar")
		.leftJoinAndSelect("replyUser.banner", "replyUserBanner")
		.leftJoinAndSelect("renote.user", "renoteUser")
		.leftJoinAndSelect("renoteUser.avatar", "renoteUserAvatar")
		.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner")
		.andWhere("userListJoining.userListId = :userListId", {
			userListId: list.id,
		});

        generateChannelQuery(query, user);
        if (user) {
                const followingCondition = createFollowingExistsCondition(user.id);
                query.setParameters(followingCondition.parameters);
                generateRepliesQuery(query, user, followingCondition);
        } else {
                generateRepliesQuery(query, user);
        }
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);
	if (user) generateMutedUserRenotesQueryForNotes(query, user);

	if (ps.includeMyRenotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.userId != :meId", { meId: user.id });
				qb.orWhere("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
			}),
		);
	}

	if (ps.includeRenotedMyNotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.renoteUserId != :meId", { meId: user.id });
				qb.orWhere("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
			}),
		);
	}

	if (ps.includeLocalRenotes === false) {
		query.andWhere(
			new Brackets((qb) => {
				qb.orWhere("note.renoteUserHost IS NOT NULL");
				qb.orWhere("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
			}),
		);
	}

        if (ps.withFiles) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
        }
	//#endregion

	process.nextTick(() => {
		if (user) {
			activeUsersChart.read(user);
		}
	});

	return await fetchPackedNotesWithOverfetch({
		query,
		limit: ps.limit,
		pagination: ps,
		me: user,
		onError: (error) =>
			rethrowTimelineQueryAsApiError(
				"notes/user-list-timeline",
				meta.errors.queryError,
				error,
			),
	});
});
