/**
 * @packageDocumentation
 *
 * ローカルタイムライン（自インスタンスのノート）を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/local-timeline`（GET `/api/notes/local-timeline` で呼び出し）
 * - 認証不要。ローカルのパブリックノートを時系列で取得。
 * - 純リノートのリモート先判定は {@link isRemoteRenoteTarget}（`renoteUserHost` を最優先し、無ければネスト `renote`）に依存する。
 * - **性能**: 純 RT 用の事後フィルタで件数が足りないとき、同一リクエスト内で複数回 DB に取りに行く。追い取りは {@link fetchPackedNotesWithOverfetch} の id キーセットカーソルを使用する。
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
import { rethrowTimelineQueryAsApiError } from "../../common/rethrow-timeline-query-error.js";
import { fetchPackedNotesWithOverfetch } from "../../common/fetch-packed-notes-with-overfetch.js";
import { generateMutedUserQuery } from "../../common/generate-muted-user-query.js";
import { makePaginationQuery } from "../../common/make-pagination-query.js";
import { generateVisibilityQuery } from "../../common/generate-visibility-query.js";
import { generateRepliesQuery } from "../../common/generate-replies-query.js";
import { generateMutedNoteQuery } from "../../common/generate-muted-note-query.js";
import { generateChannelQuery } from "../../common/generate-channel-query.js";
import { generateBlockedUserQuery } from "../../common/generate-block-query.js";
import { generateMutedUserRenotesQueryForNotes } from "../../common/generated-muted-renote-query.js";
import { createFollowingExistsCondition } from "../../common/following-exists-condition.js";
import { isRemoteRenoteTarget } from "../../common/is-remote-renote-target.js";
import { applyPublicTimelineWarnedUserFilter } from "../../common/generate-public-timeline-warned-user-filter.js";
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

/**
 * 純リノートの LTL 用デデュープ状態（バッチをまたいで 1 パスで進める）。
 *
 * @remarks
 * 以前は各 DB ラウンドごとに「累積 rawNotes を毎回先頭から再フィルタ」しており、
 * ラウンド数に対して計算量が二乗に近づくうえ、OFFSET も積み上がって遡りが極端に遅くなっていた。
 *
 * @internal
 */
interface LocalTimelineRenoteFilterState {
        visibleNotes: Array<Packed<"Note"> | null>;
        visibleNoteIds: Set<string>;
        visibleRenoteIndexes: Map<string, number>;
        visibleCount: number;
}

function createLocalTimelineRenoteFilterState(): LocalTimelineRenoteFilterState {
        return {
                visibleNotes: [],
                visibleNoteIds: new Set(),
                visibleRenoteIndexes: new Map(),
                visibleCount: 0,
        };
}

/**
 * 1 バッチ分のパック済みノートを LTL 用純リノートフィルタに合流する。
 *
 * @param state - 累積状態（呼び出しごとに更新される）
 * @param notes - 今回の DB バッチを pack した配列（時系列は {@link makePaginationQuery} の並びと一致）
 * @param limit - 目標件数（バッチ処理後に `visibleCount >= limit` なら DB 追い取りを打ち切る）
 * @param meId - ログイン中ユーザ ID（自分の純 RT は常に通す）
 * @returns もう DB から取る必要がないとき true（`state.visibleCount >= limit`）
 *
 * @remarks
 * バッチ途中で打ち切らず **バッチ全件** を処理する。同一バッチ内の古い方の純 RT が新しい方を差し替えるため、
 * 途中打ち切りは表示がずれる可能性がある。
 *
 * @internal
 */
function appendPackedNotesToLocalTimelineRenoteFilter(
        state: LocalTimelineRenoteFilterState,
        notes: Packed<"Note">[],
        limit: number,
        meId?: string,
): boolean {
        for (const note of notes) {
                if (!isRenoteOnly(note) || (meId && note.userId === meId)) {
                        const renoteIndex = state.visibleRenoteIndexes.get(note.id);
                        if (renoteIndex !== undefined) {
                                state.visibleNotes[renoteIndex] = null;
                                state.visibleRenoteIndexes.delete(note.id);
                        }

                        state.visibleNoteIds.add(note.id);
                        state.visibleNotes.push(note);
                        state.visibleCount += 1;
                } else {
                        const targetId = note.renote?.id;
                        if (!targetId) {
                                state.visibleNotes.push(note);
                                state.visibleCount += 1;
                        } else {
                                if (
                                        !isRemoteRenoteTarget(note) &&
                                        state.visibleNoteIds.has(targetId)
                                ) {
                                        continue;
                                }

                                const visibleRenoteIndex =
                                        state.visibleRenoteIndexes.get(targetId);
                                if (visibleRenoteIndex !== undefined) {
                                        state.visibleNotes[visibleRenoteIndex] = null;
                                        state.visibleRenoteIndexes.set(
                                                targetId,
                                                state.visibleNotes.length,
                                        );
                                        state.visibleNotes.push(note);
                                        continue;
                                }

                                state.visibleRenoteIndexes.set(
                                        targetId,
                                        state.visibleNotes.length,
                                );
                                state.visibleNotes.push(note);
                                state.visibleCount += 1;
                        }
                }
        }

        return state.visibleCount >= limit;
}

/** @internal */
function finalizeLocalTimelineRenoteFilter(
        state: LocalTimelineRenoteFilterState,
): Packed<"Note">[] {
        return state.visibleNotes.filter(
                (note): note is Packed<"Note"> => note !== null,
        );
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
                generateRepliesQuery(query, user, followingCondition, ps.showReplyMode ?? "all", ps.showReplyMode === "notBotOnly");
        } else {
                generateRepliesQuery(query, user);
        }
	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user) generateMutedNoteQuery(query, user);
	if (user) generateBlockedUserQuery(query, user);
	if (user) generateMutedUserRenotesQueryForNotes(query, user);

	await applyPublicTimelineWarnedUserFilter(query, user, {
		socialFollowingException: false,
	});

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
        // authenticate の user にフラグが無いと undefined になり !flag で常に制限が掛かるため === false にする
        if (user && user.localShowRenote === false) {
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

	if (user && user.remoteShowRenote === false) {
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

	return await fetchPackedNotesWithOverfetch({
		query,
		limit: ps.limit,
		pagination: ps,
		me: user,
		cursorParameterName: "ltlMoreCursor",
		onError: (error) =>
			rethrowTimelineQueryAsApiError(
				"notes/local-timeline",
				meta.errors.queryError,
				error,
			),
		createState: createLocalTimelineRenoteFilterState,
		onBatchPacked: ({ packedNotes, limit, me, state }) => {
			const done = appendPackedNotesToLocalTimelineRenoteFilter(
				state,
				packedNotes,
				limit,
				me?.id,
			);
			const result = finalizeLocalTimelineRenoteFilter(state).slice(
				0,
				limit,
			);
			return {
				done,
				result,
				remaining: limit - state.visibleCount,
			};
		},
	});
});
