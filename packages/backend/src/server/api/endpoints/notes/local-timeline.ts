/**
 * @packageDocumentation
 *
 * ローカルタイムライン（自インスタンスのノート）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/local-timeline`（GET `/api/notes/local-timeline` で呼び出し）
 * - 認証不要。ローカルのパブリックノートを時系列で取得。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Notes, Users, Followings } from "@/models/index.js";
import { activeUsersChart } from "@/services/chart/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { buildUserAndNoteMapsFromNotes } from "../../common/build-note-pack-hint.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";
import type { Packed } from "@/misc/schema.js";

export const meta = {
	tags: ["notes"],
	requireCredentialPrivateMode: true,

	description:
		"ローカルタイムラインを取得する。自インスタンスのパブリック投稿を時系列で返す。sinceId/untilId/limit でページネーション可能。返信・ファイル付きなどの絞り込みができる。",

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
		ltlDisabled: {
			message: "LTLは無効化されています。",
			code: "LTL_DISABLED",
			id: "45a6eb02-7695-4393-b023-dd3be9aaaefd",
		},
		queryError: {
			message: "フォロー数を増やしてください。",
			code: "QUERY_ERROR",
			id: "620763f4-f621-4533-ab33-0577a1a3c343",
		},
	},
} as const;

export const paramDef = {
        type: "object",
        properties: {
                withFiles: {
			type: "boolean",
			default: false,
			description: "true のとき、ファイルが添付されたノートのみ返します。",
		},
		fileType: {
			type: "array",
			items: {
				type: "string",
			},
		},
		excludeNsfw: { type: "boolean", default: false },
		withBelowPublic: { type: "boolean", default: false },
		showReplyMode: {
			type: "string",
			enum: ["all", "notBotOnly", "personalOnly"],
			default: "all",
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
		sinceDate: { type: "integer" },
		untilDate: { type: "integer" },
		host: { type: "string" },
	},
        required: [],
} as const;

function hasRenoteOnlyContent(note: Packed<"Note">): boolean {
        if (!note.text && (!note.files || note.files.length === 0) && !note.poll) {
                return false;
        }

        if (note.text && note.text.trim().length > 0) {
                return true;
        }

        if (note.files && note.files.length > 0) {
                return true;
        }

        if (note.poll) {
                return true;
        }

        return false;
}

function isRenoteOnly(note: Packed<"Note">): boolean {
        if (!note.renote) return false;

        return !hasRenoteOnlyContent(note);
}

function filterRenoteOnlyForLocalTimeline(
        notes: Packed<"Note">[],
        meId?: string,
): Packed<"Note">[] {
        if (notes.length === 0) return notes;

        const noteMap = new Map<string, Packed<"Note">>();
        const renoteOnlyMap = new Map<string, Packed<"Note">[]>();

        for (const note of notes) {
                noteMap.set(note.id, note);

                if (!isRenoteOnly(note)) continue;

                const targetId = note.renote?.id;
                if (!targetId) continue;

                if (!renoteOnlyMap.has(targetId)) {
                        renoteOnlyMap.set(targetId, []);
                }

                renoteOnlyMap.get(targetId)!.push(note);
        }

        return notes.filter((note) => {
                if (!isRenoteOnly(note)) return true;
                if (meId && note.userId === meId) return true;

                const targetId = note.renote?.id;
                if (!targetId) return true;

                if (noteMap.has(targetId)) {
                        return false;
                }

                const candidates = renoteOnlyMap.get(targetId);
                if (!candidates || candidates.length === 0) {
                        return true;
                }

                let oldest = candidates[0];
                for (const candidate of candidates) {
                        if (candidate.id < oldest.id) {
                                oldest = candidate;
                        }
                }

                return note.id === oldest.id;
        });
}

export default define(meta, paramDef, async (ps, user) => {
        const m = await fetchMeta();
        if (m.disableLocalTimeline) {
		if (user == null || !(user.isAdmin || user.isModerator)) {
			throw new ApiError(meta.errors.ltlDisabled);
		}
	}

	//#region クエリ構築
	const query = makePaginationQuery(
		Notes.createQueryBuilder("note"),
		ps.sinceId,
		ps.untilId,
		ps.sinceDate,
		ps.untilDate,
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
		.leftJoinAndSelect("renoteUser.banner", "renoteUserBanner");

	if (!ps.host) {
		query
			.andWhere(
          `(note.userHost IS NULL OR note.userHost = ANY (:recommendedHosts))`,
          { recommendedHosts: m.recommendedInstances },
      )
			.andWhere("(note.replyId IS NULL OR reply.userHost IS NULL OR reply.userHost = ANY (:recommendedHosts))",
							 { recommendedHosts: m.recommendedInstances },
			);
	} else {
		query
			.andWhere("(note.userHost = :host)", { host: ps.host })
			.andWhere("(note.replyId IS NULL OR reply.userHost = :host)", {
				host: ps.host,
			});
	}

        generateChannelQuery(query, user);
        if (user) {
                const followingCondition = createFollowingExistsCondition(user.id);
                query.setParameters(followingCondition.parameters);
                generateRepliesQuery(query, user, followingCondition, ps.showReplyMode ?? "all");
        } else {
                generateRepliesQuery(query, user);
        }
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);
	if (user) generateMutedUserRenotesQueryForNotes(query, user);

	if (user && ps.withBelowPublic) {
		const followees = await Followings.createQueryBuilder("following")
			.select("following.followeeId")
			.where("following.followerId = :followerId", { followerId: user.id })
			.getMany();

		const meOrFolloweeIds = [user.id, ...followees.map((f) => f.followeeId)];
		query.andWhere(
			new Brackets((qb) => {
				qb.where("(note.visibility = 'public')");
				qb.orWhere("note.userId IN (:...meOrFolloweeIds)", {
					meOrFolloweeIds: meOrFolloweeIds,
				});
			}),
		);
	} else {
		query.andWhere("(note.visibility = 'public')");
	}
        if (user && !user.localShowRenote) {
                query.andWhere(
                        new Brackets((qb) => {
                                qb.where("note.renoteId IS NULL");
                                qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
                                qb.orWhere(
                                        '0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
                                );
                                qb.orWhere("note.userHost IS NOT NULL");
                                qb.orWhere("note.userId = :meId", { meId: user.id });
                        }),
                );
        }

	if (user && !user.remoteShowRenote) {
		query.andWhere(
			new Brackets((qb) => {
				qb.where("note.renoteId IS NULL");
				qb.orWhere("note.text IS NOT NULL");
                                qb.orWhere('CARDINALITY(note."fileIds") > 0');
				qb.orWhere(
					'0 < (SELECT COUNT(*) FROM poll WHERE poll."noteId" = note.id)',
				);
				qb.orWhere("note.userHost IS NULL");
				qb.orWhere(
					`user.username || '@' || note."userHost" = ANY ('{"${m.recommendedInstances.join(
						'","',
					)}"}')`,
				);
			}),
		);
	}

        if (ps.withFiles) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
        }

        if (ps.fileType != null) {
                query.andWhere('CARDINALITY(note."fileIds") > 0');
		query.andWhere(
			new Brackets((qb) => {
				for (const type of ps.fileType!) {
					const i = ps.fileType!.indexOf(type);
					qb.orWhere(`:type${i} = ANY(note.attachedFileTypes)`, {
						[`type${i}`]: type,
					});
				}
			}),
		);

		if (ps.excludeNsfw) {
			query.andWhere("note.cw IS NULL");
			query.andWhere(
				'0 = (SELECT COUNT(*) FROM drive_file df WHERE df.id = ANY(note."fileIds") AND df."isSensitive" = TRUE)',
			);
		}
	}
	query.andWhere("note.visibility != 'hidden'");
	//#endregion

	process.nextTick(() => {
		if (user) {
			activeUsersChart.read(user);
		}
	});

	// フィルタで除外されるため要求より多めに取得し、件数が不足するとページネーションを打ち切る。
        const rawNotes: Packed<"Note">[] = [];
        const take = Math.floor(ps.limit * 1.5);
        let skip = 0;
        try {
                while (true) {
                        const notes = await query.take(take).skip(skip).getMany();
                        if (notes.length === 0) break;

                        const { userMap, noteMap } =
                                buildUserAndNoteMapsFromNotes(notes);
                        const packedNotes = await Notes.packMany(notes, user, {
                                _hint_: { userMap, noteMap },
                        });
                        rawNotes.push(...packedNotes);

                        const filtered = filterRenoteOnlyForLocalTimeline(rawNotes, user?.id);
                        if (filtered.length >= ps.limit) {
                                return filtered.slice(0, ps.limit);
                        }

                        if (notes.length < take) {
                                return filtered;
                        }

                        skip += take;
                }
        } catch (error) {
                throw new ApiError(meta.errors.queryError);
        }

        return filterRenoteOnlyForLocalTimeline(rawNotes, user?.id).slice(0, ps.limit);
});
