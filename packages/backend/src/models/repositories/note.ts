/**
 * ノートリポジトリ（pack 含む）
 *
 * @remarks
 * pack 内で note.emojis / reactionEmojis の各要素に、表示者とモチーフユーザーのブロック関係に基づき hiddenForViewer を付与する。ブロック関係は hint で 1 リクエスト中 1 回だけ取得して使い回す。
 */
import { In, IsNull } from "typeorm";
import * as mfm from "mfm-js";
import { Note } from "@/models/entities/note.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import type { User } from "@/models/entities/user.js";
import type { Channel } from "@/models/entities/channel.js";
import {
	Users,
	PollVotes,
	DriveFiles,
	NoteReactions,
	Followings,
	Polls,
	Channels,
	NoteFavorites,
	UserMemos,
	UserProfiles,
	Blockings,
	Emojis,
} from "../index.js";
import type { Packed } from "@/misc/schema.js";
import { nyaize } from "@/misc/nyaize.js";
import { awaitAll } from "@/prelude/await-all.js";
import {
	convertLegacyReaction,
	convertLegacyReactions,
	decodeReaction,
} from "@/misc/reaction-lib.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import type { PopulatedEmoji } from "@/misc/populate-emojis.js";
import {
	aggregateNoteEmojis,
	populateEmojis,
	prefetchEmojis,
} from "@/misc/populate-emojis.js";
import { db } from "@/db/postgre.js";
import { redisClient, subscriber } from "@/db/redis.js";
import { Cache } from "@/misc/cache.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";

export async function populatePoll(note: Note, meId: User["id"] | null) {
	const poll = await Polls.findOneByOrFail({ noteId: note.id });
	const totalVotes = poll.votes.reduce((total, votes) => total + votes, 0);
	const choices = poll.choices.map((c, index) => ({
		text: c,
		votes: poll.votes[index],
		isVoted: false,
	}));

	if (meId) {
		if (poll.multiple) {
			const votes = await PollVotes.findBy({
				userId: meId,
				noteId: note.id,
			});

			const myChoices = votes.map((v) => v.choice);
			for (const myChoice of myChoices) {
				choices[myChoice].isVoted = true;
			}
		} else {
			const vote = await PollVotes.findOneBy({
				userId: meId,
				noteId: note.id,
			});

			if (vote) {
				choices[vote.choice].isVoted = true;
			}
		}
	}

	const hasVoted = choices.some((choice) => choice.isVoted);
	const isOwner = meId != null && meId === note.userId;
	const isExpired = poll.expiresAt != null && poll.expiresAt.getTime() <= Date.now();
	const canShowResults =
		!poll.hideResults || isOwner || hasVoted || isExpired;

	if (!canShowResults) {
		for (const choice of choices) {
			choice.votes = 0;
		}
	}

	return {
		multiple: poll.multiple,
		expiresAt: poll.expiresAt,
		hideResults: poll.hideResults,
		totalVotes,
		choices,
	};
}

type NoteReactionHint = Map<
        Note["id"],
        NoteReaction | NoteReaction[] | null
>;

type NotePackHint = {
        myReactions?: NoteReactionHint;
        favorites?: Set<Note["id"]>;
        me?: User;
        followings?: Map<User["id"], boolean>;
	/** 表示者とブロック関係にあるユーザ ID（モチーフ絵文字の hiddenForViewer 用）。1 リクエスト 1 回取得して使い回す */
	blockedUserIdsForEmoji?: Set<User["id"]>;
	/** packMany 用: ノート投稿者を一括取得した Map。あるときは pack 内の Users.findOneBy をスキップ */
	userMap?: Map<User["id"], User>;
	/** packMany 用: チャンネルを一括取得した Map */
	channelMap?: Map<string, Channel>;
	/** packMany 用: reply/renote 用ノートを一括取得した Map */
	noteMap?: Map<Note["id"], Note>;
	/** packMany 用: ノート添付ファイルを一括 pack した Map */
	packedFileMap?: Map<DriveFile["id"], Packed<"DriveFile">>;
};

const NOTE_PACK_CACHE_TTL_MS = 30 * 1000;
const NOTE_PACK_USER_PROFILE_CACHE_TTL_SEC = 60;
const NOTE_PACK_USER_PROFILE_CACHE_KEY_PREFIX = "note:pack:user";

const meUserCache = new Cache<User>(NOTE_PACK_CACHE_TTL_MS);
const followingsMapCache = new Cache<Map<User["id"], boolean>>(NOTE_PACK_CACHE_TTL_MS);
const myReactionPointCache = new Cache<NoteReaction[]>(NOTE_PACK_CACHE_TTL_MS);
const favoritePointCache = new Cache<boolean>(NOTE_PACK_CACHE_TTL_MS);
const notePackUserProfileCache = new Cache<Packed<"User">>(NOTE_PACK_CACHE_TTL_MS);

function getUserNoteCacheKey(userId: User["id"], noteId: Note["id"]): string {
	return `${userId}:${noteId}`;
}

function getNotePackUserProfileCacheKey(userId: User["id"]): string {
	return `${NOTE_PACK_USER_PROFILE_CACHE_KEY_PREFIX}:${userId}`;
}

function deleteNotePackUserProfileCache(userId: User["id"]): void {
	notePackUserProfileCache.delete(userId);
	void redisClient.del(getNotePackUserProfileCacheKey(userId));
}

function stripVolatileUserFields(user: Packed<"User">): Packed<"User"> {
	const {
		onlineStatus: _onlineStatus,
		memo: _memo,
		originalName: _originalName,
		isFollowing: _isFollowing,
		isFollowed: _isFollowed,
		hasPendingFollowRequestFromYou: _hasPendingFollowRequestFromYou,
		hasPendingFollowRequestToYou: _hasPendingFollowRequestToYou,
		isBlocking: _isBlocking,
		isBlocked: _isBlocked,
		isMuted: _isMuted,
		isRenoteMuted: _isRenoteMuted,
		isFollowBlocking: _isFollowBlocking,
		isInviter: _isInviter,
		followedMessage: _followedMessage,
		...fixed
	} = user;

	return fixed;
}

async function getFixedPackedUserForNote(
	src: Note["user"] | User["id"],
): Promise<Packed<"User">> {
	const userId = typeof src === "object" ? src.id : src;
	const localCached = notePackUserProfileCache.get(userId);
	if (localCached !== undefined) {
		return localCached;
	}

	const redisKey = getNotePackUserProfileCacheKey(userId);
	const redisCached = await redisClient.get(redisKey);
	if (redisCached != null) {
		const parsed = JSON.parse(redisCached) as Packed<"User">;
		notePackUserProfileCache.set(userId, parsed);
		return parsed;
	}

	const packed = await Users.pack(src, null, {
		detail: false,
		relation: false,
	});
	const fixed = stripVolatileUserFields(packed);
	notePackUserProfileCache.set(userId, fixed);
	await redisClient.set(
		redisKey,
		JSON.stringify(fixed),
		"EX",
		NOTE_PACK_USER_PROFILE_CACHE_TTL_SEC,
	);

	return fixed;
}

async function packNoteUser(
	src: Note["user"] | User["id"],
	me?: { id: User["id"] } | null,
): Promise<Packed<"User">> {
	const fixed = await getFixedPackedUserForNote(src);
	const meId = me?.id ?? null;
	if (meId == null) {
		return fixed;
	}

	const user = typeof src === "object" ? src : await Users.findOneByOrFail({ id: src });
	const memo = await UserMemos.findOneBy({
		userId: meId,
		targetUserId: user.id,
	});

	const relation =
		meId !== user.id ? await Users.getRelation(meId, user.id, user) : null;
	const onlineStatus = await Users.getOnlineStatus(user, meId, relation ?? undefined);

	const packed: Packed<"User"> = {
		...fixed,
		name: memo?.customName ? memo.customName : fixed.name,
		onlineStatus,
		memo: memo?.memo || undefined,
		originalName: memo?.customName ? fixed.name : undefined,
		isRenoteMuted: relation == null ? false : relation.isRenoteMuted,
		...(relation
			? {
					isFollowing: relation.isFollowing,
					isFollowed: relation.isFollowed,
					hasPendingFollowRequestFromYou:
						relation.hasPendingFollowRequestFromYou,
					hasPendingFollowRequestToYou:
						relation.hasPendingFollowRequestToYou,
					isBlocking: relation.isBlocking,
					isBlocked: relation.isBlocked,
					isMuted: relation.isMuted,
					isFollowBlocking: relation.isFollowBlocking,
					isInviter: relation.isInviter ? true : undefined,
			  }
			: {}),
	};

	if (relation?.isFollowing) {
		const profile = await UserProfiles.findOneBy({ userId: user.id });
		packed.followedMessage = profile?.followedMessage || undefined;
	}

	return packed;
}

function invalidateNotePackViewerCache(viewerId: User["id"]): void {
	meUserCache.delete(viewerId);
	followingsMapCache.delete(viewerId);
}

subscriber.on("message", (_, data) => {
	const message = JSON.parse(data) as {
		channel: string;
		message: { type: string; body: { id?: User["id"]; userId?: User["id"]; noteId?: Note["id"] } | null };
	};

	if (message.channel === "internal") {
		switch (message.message.type) {
			case "localUserUpdated":
			case "remoteUserUpdated":
			case "userChangeSuspendedState":
			case "userChangeSilencedState":
			case "userChangeModeratorState": {
				const userId = message.message.body?.id;
				if (userId != null) {
					invalidateNotePackViewerCache(userId);
					deleteNotePackUserProfileCache(userId);
				}
				break;
			}
			case "notePackFollowingUpdated": {
				const userId = message.message.body?.userId;
				if (userId != null) {
					invalidateNotePackViewerCache(userId);
				}
				break;
			}
			case "notePackReactionUpdated": {
				const userId = message.message.body?.userId;
				const noteId = message.message.body?.noteId;
				if (userId != null && noteId != null) {
					myReactionPointCache.delete(getUserNoteCacheKey(userId, noteId));
				}
				break;
			}
			case "notePackFavoriteUpdated": {
				const userId = message.message.body?.userId;
				const noteId = message.message.body?.noteId;
				if (userId != null && noteId != null) {
					favoritePointCache.delete(getUserNoteCacheKey(userId, noteId));
				}
				break;
			}
			default:
				break;
		}
	}
});

async function populateMyReaction(
        note: Note,
        meId: User["id"],
        _hint_?: Pick<NotePackHint, "myReactions">,
) {
        if (_hint_?.myReactions?.has(note.id)) {
                const reaction = _hint_.myReactions.get(note.id);
                if (Array.isArray(reaction)) {
                        const firstReaction = reaction[0];
                        if (firstReaction) {
                                return convertLegacyReaction(firstReaction.reaction);
                        }
                        return undefined;
                } else if (reaction) {
                        return convertLegacyReaction(reaction.reaction);
                }
                return undefined;
        }

        // パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
        if (note.createdAt.getTime() + 1000 > Date.now()) {
                return undefined;
        }

	const reaction = await NoteReactions.findOneBy({
		userId: meId,
		noteId: note.id,
	});

	if (reaction) {
		return convertLegacyReaction(reaction.reaction);
	}

	return undefined;
}

async function populateMyReactions(
        note: Note,
        meId: User["id"],
        _hint_?: Pick<NotePackHint, "myReactions">,
) {
        if (_hint_?.myReactions?.has(note.id)) {
                const reactions = _hint_.myReactions.get(note.id);
                if (reactions && Array.isArray(reactions) && reactions.length !== 0) {
                        return {
                                myReactions: reactions.map((reaction) =>
                                        convertLegacyReaction(reaction.reaction),
                                ),
                                myReactionsCnt: reactions.length,
                        };
                } else if (reactions && !Array.isArray(reactions)) {
                        return {
                                myReactions: [convertLegacyReaction(reactions.reaction)],
                                myReactionsCnt: 1,
                        };
                }

                return {
                        myReactions: [],
                        myReactionsCnt: 0,
                };
        }

        // パフォーマンスのためノートが作成されてから1秒以上経っていない場合はリアクションを取得しない
        if (note.createdAt.getTime() + 1000 > Date.now()) {
                return {
                        myReactions: [],
                        myReactionsCnt: 0,
		};
	}

	const reactions = await NoteReactions.find({
		where: {
			userId: meId,
			noteId: note.id,
		},
	});

        if (reactions && reactions.length != 0) {
                return {
                        myReactions: reactions.map((reaction) =>
                                convertLegacyReaction(reaction.reaction),
                        ),
                        myReactionsCnt: reactions.length,
                };
        }

        return {
                myReactions: [],
                myReactionsCnt: 0,
        };
}

export const NoteRepository = db.getRepository(Note).extend({
        async isVisibleForMe(
                note: Note,
                meId: User["id"] | null,
                _hint_?: Pick<NotePackHint, "me" | "followings">,
        ): Promise<boolean> {
                // This code must always be synchronized with the checks in generateVisibilityQuery.
                if (!note?.visibility) return false;
                // visibility が specified かつ自分が指定されていなかったら非表示
                if (note.visibility === "specified") {
                        if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else {
				// 指定されているかどうか
				return (
					note.visibleUserIds.some((id: any) => meId === id) ||
					note.ccUserIds.some((id: any) => meId === id)
				);
			}
		}

		// visibility が followers かつ自分が投稿者のフォロワーでなかったら非表示
		if (note.visibility === "followers") {
			if (meId == null) {
				return false;
			} else if (meId === note.userId) {
				return true;
			} else if (note.reply && meId === note.reply.userId) {
				// 自分の投稿に対するリプライ
				return true;
			} else if (note.mentions?.some((id) => meId === id)) {
				// 自分へのメンション
				return true;
			} else {
                                // フォロワーかどうか
                                const userPromise = _hint_?.me
                                        ? Promise.resolve(_hint_.me)
                                        : Users.findOneByOrFail({ id: meId });
                                let following: boolean;
                                let user: User;

                                if (_hint_?.followings?.has(note.userId)) {
                                        following = !!_hint_.followings.get(note.userId);
                                        user = await userPromise;
                                } else {
                                        const [isFollowing, resolvedUser] = await Promise.all([
                                                Followings.exist({
                                                        where: {
                                                                followeeId: note.userId,
                                                                followerId: meId,
                                                        },
                                                }),
                                                userPromise,
                                        ]);
                                        following = isFollowing;
                                        user = resolvedUser;
                                }

                                /* If we know the following, everything is fine.

                                But if we do not know the following, it might be that both the
                                author of the note and the author of the like are remote users,
                                in which case we can never know the following. Instead we have
				to assume that the users are following each other.
				*/
                                return following || (note?.userHost != null && user.host != null);
                        }
                }

		// localOnly が true かつ 自分がログインしてなければ非表示
		if (note.localOnly && meId == null) {
			return false;
		}

		return true;
	},

        async pack(
                src: Note["id"] | Note,
                me?: { id: User["id"] } | null | undefined,
                options?: {
                        detail?: boolean;
                        _hint_?: NotePackHint;
                        showInvisible?: boolean;
                        blockCheck?: boolean;
                },
        ): Promise<Packed<"Note">> {
                const opts = Object.assign(
			{
				detail: true,
			},
			options,
                );

                const meId = me ? me.id : null;
                const note =
                        typeof src === "object" ? src : await this.findOneByOrFail({ id: src });
                const host = note?.userHost;
                const hint: NotePackHint = opts._hint_ ?? (opts._hint_ = {});
                let meUser = hint.me;
                if (meId && !meUser) {
                        meUser = await Users.findOneByOrFail({ id: meId });
                        hint.me = meUser;
                }
                const isVisible = await this.isVisibleForMe(note, meId, hint);

                if (!isVisible && !opts.showInvisible) {
                        throw new IdentifiableError(
                                "9725d0ce-ba28-4dde-95a7-2cbb2c15de24",
                                "投稿が存在しません。",
			);
		}

		const noteUser =
			hint.userMap?.get(note.userId) ??
			note.user ??
			await Users.findOneByOrFail({ id: note.userId });

		if (opts.blockCheck && meId) {
                        const relation = await Users.getRelation(
                                meId,
                                note.userId,
                                noteUser,
                        );
			if (relation.isMuted || relation.isBlocked) {
				throw new IdentifiableError(
					"281827eb-bd11-3625-ac9d-336a0d80fac2",
					"ブロックされているユーザの投稿です。",
				);
			}
		}

		let text = note.text;

		if (note.name && (note.url ?? note.uri)) {
			text = `【${note.name}】\n${(note.text || "").trim()}\n\n${
				note.url ?? note.uri
			}`;
		}

                const channel = note.channelId
                        ? note.channel ??
                                hint.channelMap?.get(note.channelId) ??
                                (await Channels.findOneBy({ id: note.channelId }))
                        : null;

                let isFavorited: true | undefined;
                if (meId) {
                        const favoritedFromHint = hint.favorites;
                        if (favoritedFromHint) {
                                isFavorited = favoritedFromHint.has(note.id)
                                        ? true
                                        : undefined;
                        } else {
                                isFavorited = (await NoteFavorites.count({
                                        where: {
                                                userId: meId,
                                                noteId: note.id,
                                        },
                                        take: 1,
                                }))
                                        ? true
                                        : undefined;
                        }
                }

                const myReactions = meId
                        ? await populateMyReactions(note, meId, hint)
                        : undefined;

                const reactions =
                        note.isPublicLikeList || meId === note.userId
				? {
						...(myReactions?.myReactions?.length
							? myReactions.myReactions.reduce(
									(acc, curr) => ((acc[curr] = 1), acc),
									{},
							  )
							: {}),
						...note.reactions,
				  }
				: myReactions?.myReactions
				? myReactions.myReactions.reduce(
						(acc, curr) => ((acc[curr] = 1), acc),
						{},
				  )
				: {};

		const reactionEmojiNames = Object.keys(reactions)
			.filter((x) => x?.startsWith(":"))
			.map((x) => decodeReaction(x).reaction)
			.map((x) => x.replace(/:/g, ""));

		const noteEmoji = await populateEmojis(
			note.emojis.concat(reactionEmojiNames),
			host,
		);

		const reactionEmoji = await populateEmojis(reactionEmojiNames, host);

		// モチーフ絵文字の hiddenForViewer: 表示者とモチーフユーザーがブロック関係のとき true。ブロック関係は hint で 1 回だけ取得
		const hasLocalEmoji = noteEmoji.some((e) => e.host == null) || reactionEmoji.some((e) => e.host == null);
		let blockedUserIds = hint.blockedUserIdsForEmoji;
		if (meId && hasLocalEmoji && blockedUserIds === undefined) {
			const [blockingMe, blockedByMe] = await Promise.all([
				Blockings.findBy({ blockerId: meId }).then((r) => r.map((b) => b.blockeeId)),
				Blockings.findBy({ blockeeId: meId }).then((r) => r.map((b) => b.blockerId)),
			]);
			blockedUserIds = new Set([...blockingMe, ...blockedByMe]);
			hint.blockedUserIdsForEmoji = blockedUserIds;
		}
		const emojiShortName = (emojiName: string): string =>
			emojiName.match(/^(\w+)/)?.[1] ?? emojiName;
		const localEmojiShortNames = [
			...new Set(
				[...noteEmoji, ...reactionEmoji]
					.filter((e) => e.host == null)
					.map((e) => emojiShortName(e.name)),
			),
		];
		const localEmojiMap =
			localEmojiShortNames.length > 0 && blockedUserIds && blockedUserIds.size > 0
				? new Map(
						(
							await Emojis.find({
								where: { name: In(localEmojiShortNames), host: IsNull() },
								select: ["name", "motifUserId"],
							})
						).map((e) => [e.name, e] as const),
				  )
				: new Map<string, { motifUserId: string | null }>();
		const addHiddenForViewer = (list: PopulatedEmoji[]): (PopulatedEmoji & { hiddenForViewer?: boolean })[] =>
			list.map((e) => {
				if (e.host != null || !blockedUserIds?.size) {
					return e;
				}
				const local = localEmojiMap.get(emojiShortName(e.name));
				const hidden =
					local?.motifUserId != null && blockedUserIds!.has(local.motifUserId);
				return { ...e, ...(hidden ? { hiddenForViewer: true } : {}) };
			});
		const noteEmojiWithHidden = addHiddenForViewer(noteEmoji);
		const reactionEmojiWithHidden = addHiddenForViewer(reactionEmoji);

		const packed: Packed<"Note"> = await awaitAll({
			id: note.id,
			createdAt: note.createdAt.toISOString(),
			userId: note.userId,
			user: packNoteUser(noteUser, me),
			text: isVisible ? text : null,
			cw: isVisible ? note.cw : undefined,
			visibility: note.visibility,
			localOnly: !!note.localOnly ?? undefined,
			visibleUserIds:
				note.visibility === "specified" && isVisible
					? note.visibleUserIds
					: undefined,
			ccUserIdsCount: isVisible ? note.ccUserIds.length : undefined,
			renoteCount: note.renoteCount,
			repliesCount: note.repliesCount,
			score: note.score,
			reactions: convertLegacyReactions(reactions),
			reactionEmojis: reactionEmojiWithHidden,
			emojis: isVisible ? noteEmojiWithHidden : [],
			tags: note.tags.length > 0 && isVisible ? note.tags : undefined,
			fileIds: isVisible ? note.fileIds : [],
			files:
				isVisible && note.fileIds.length > 0
					? hint.packedFileMap
						? note.fileIds
								.map((fileId) => hint.packedFileMap?.get(fileId))
								.filter((file): file is Packed<"DriveFile"> => file != null)
						: DriveFiles.packMany(note.fileIds)
					: [],
			replyId: note.replyId,
			renoteId: note.renoteId,
			referenceIds: note.referenceIds,
			channelId: note.channelId || undefined,
			channel: channel
				? {
						id: channel.id,
						name: channel.name,
				  }
				: undefined,
			mentions:
				note.mentions.length > 0 && isVisible ? note.mentions : undefined,
			uri: note.uri || undefined,
			url: note.url || undefined,
			updatedAt: note.updatedAt?.toISOString() || undefined,
			deletedAt: note.deletedAt?.toISOString() || undefined,
			isFirstNote: note.isFirstNote ? true : undefined,
			invisible: !isVisible ? true : undefined,
			...(opts.detail
				? {
                                                reply: note.replyId
                                                        ? this.pack(
                                                                note.reply ??
                                                                        hint.noteMap?.get(note.replyId) ??
                                                                        note.replyId,
                                                                me,
                                                                {
                                                                        detail: false,
                                                                        _hint_: opts._hint_,
                                                                        showInvisible: true,
                                                                },
                                                          )
                                                        : undefined,

                                                renote: note.renoteId
                                                        ? this.pack(
                                                                note.renote ??
                                                                        hint.noteMap?.get(note.renoteId) ??
                                                                        note.renoteId,
                                                                me,
                                                                {
                                                                        detail: true,
                                                                        _hint_: opts._hint_,
                                                                        showInvisible: true,
                                                                },
                                                          )
                                                        : undefined,

                                                references: note.referenceIds.filter(
                                                        (x) => !/\W/.test(x) && x !== note.renoteId,
                                                ).length
                                                        ? (
                                                                        await Promise.allSettled(
                                                                                note.referenceIds
                                                                                        .filter((x) => !/\W/.test(x) && x !== note.renoteId)
                                                                                        .map(async (x) => {
                                                                                                try {
                                                                                                        return await this.pack(x, me, {
                                                                                                                detail: true,
                                                                                                                _hint_: opts._hint_,
                                                                                                                showInvisible: false,
                                                                                                                blockCheck: true,
                                                                                                        });
                                                                                                } catch (e) {
													return null;
												}
											}),
									)
							  ).flatMap((result) =>
									result.status === "fulfilled" ? [result.value] : [],
							  ).filter(Boolean)
							: undefined,

						poll:
							note.hasPoll && isVisible ? populatePoll(note, meId) : undefined,

                                                ...(meId
                                                        ? {
                                                                        myReaction: populateMyReaction(note, meId, hint),
                                                                        ...myReactions,
                                                                        isFavorited,
                                                                        lastSendActivityAt:
                                                                                meId === note.userId
											? note.lastSendActivityAt?.toISOString() || undefined
											: undefined,
							  }
							: {}),
				  }
				: {}),
                });

                if (packed.user.isCat && packed.user.speakAsCat && packed.text) {
                        const me = meUser;
                        if (!me?.disableNyaise) {
                                const originalText = packed.text;
                                const tokens = packed.text ? mfm.parse(packed.text) : [];
                                function nyaizeNode(node: mfm.MfmNode) {
                                        if (node.type === "quote") return;
                                        if (node.type === "text") node.props.text = nyaize(node.props.text);

					if (node.children) {
						for (const child of node.children) {
							nyaizeNode(child);
						}
					}
				}

                                for (const node of tokens) nyaizeNode(node);

                                packed.text = mfm.toString(tokens);
                                if (meId === note.userId) {
                                        packed.originalText = originalText;
                                }
                        }
                }

		if (packed.text?.includes("[[参照]]"))
			packed.text = packed.text?.replaceAll("[[参照]]", "?[<参照>]");

		return packed;
	},

        async packMany(
                notes: Note[],
                me?: { id: User["id"] } | null | undefined,
                options?: {
                        detail?: boolean;
                },
	) {
		if (notes.length === 0) return [];

                const meId = me ? me.id : null;
                const myReactionsMap: NoteReactionHint = new Map();
                let favoritedNoteIds: Set<Note["id"]> | undefined;
                let meUser: User | undefined;
                if (meId) {
                        const renoteIds = notes
                                .filter((n) => n.renoteId != null)
                                .map((n) => n.renoteId!);
                        const targets = Array.from(
                                new Set([...notes.map((n) => n.id), ...renoteIds]),
                        );
                        const reactionMissTargets: Note["id"][] = [];
                        for (const target of targets) {
				const cached = myReactionPointCache.get(getUserNoteCacheKey(meId, target));
				if (cached === undefined) {
					reactionMissTargets.push(target);
				} else {
					myReactionsMap.set(target, cached);
				}
			}

			if (reactionMissTargets.length > 0) {
				const myReactions = await NoteReactions.findBy({
					userId: meId,
					noteId: In(reactionMissTargets),
				});

				const myReactionsByNoteId = new Map<Note["id"], NoteReaction[]>();
				for (const reaction of myReactions) {
					const reactions = myReactionsByNoteId.get(reaction.noteId) ?? [];
					reactions.push(reaction);
					myReactionsByNoteId.set(reaction.noteId, reactions);
				}

				for (const noteId of reactionMissTargets) {
					const reactions = myReactionsByNoteId.get(noteId) ?? [];
					myReactionPointCache.set(getUserNoteCacheKey(meId, noteId), reactions);
					myReactionsMap.set(noteId, reactions);
				}
			}

			favoritedNoteIds = new Set();
			const favoriteMissTargets: Note["id"][] = [];
			for (const target of targets) {
				const cached = favoritePointCache.get(getUserNoteCacheKey(meId, target));
				if (cached === undefined) {
					favoriteMissTargets.push(target);
					continue;
				}
				if (cached) {
					favoritedNoteIds.add(target);
				}
			}

			if (favoriteMissTargets.length > 0) {
				const favorites = await NoteFavorites.findBy({
					userId: meId,
					noteId: In(favoriteMissTargets),
				});
				const favoriteSet = new Set(favorites.map((favorite) => favorite.noteId));

				for (const noteId of favoriteMissTargets) {
					const isFavorited = favoriteSet.has(noteId);
					favoritePointCache.set(getUserNoteCacheKey(meId, noteId), isFavorited);
					if (isFavorited) {
						favoritedNoteIds.add(noteId);
					}
				}
			}

			meUser = await meUserCache.fetch(meId, async () => {
				return await Users.findOneByOrFail({ id: meId });
			});
                }

                await prefetchEmojis(aggregateNoteEmojis(notes));

                let followingsMap: Map<User["id"], boolean> | undefined;
                if (meId) {
                        const userIds = new Set<User["id"]>();
                        for (const note of notes) {
                                if (note.userId) userIds.add(note.userId);
                                if (note.renoteUserId) userIds.add(note.renoteUserId);
                                if (note.renote?.userId) userIds.add(note.renote.userId);
                                if (note.replyUserId) userIds.add(note.replyUserId);
                                if (note.reply?.userId) userIds.add(note.reply.userId);
                        }

                        if (userIds.size > 0) {
				const followeeIds = Array.from(userIds);
				followingsMap = await followingsMapCache.fetch(
					meId,
					async () => {
						const resolvedMap = new Map(
							followeeIds.map((id) => [id, false] as [User["id"], boolean]),
						);

						const followings = await Followings.findBy({
							followerId: meId,
							followeeId: In(followeeIds),
						});

						for (const following of followings) {
							resolvedMap.set(following.followeeId, true);
						}

						return resolvedMap;
					},
					(cachedMap) => followeeIds.every((id) => cachedMap.has(id)),
				);
			} else {
				followingsMap = new Map();
			}
                }

                const userIds = new Set(notes.map((n) => n.userId));
                const channelIds = new Set(
                        notes.map((n) => n.channelId).filter((id): id is string => id != null),
                );
                const replyIds = notes.map((n) => n.replyId).filter((id): id is string => id != null);
                const renoteIds = notes.map((n) => n.renoteId).filter((id): id is string => id != null);
                const noteIdsToFetch = [...new Set([...replyIds, ...renoteIds])];

                const [usersForNotes, channelsForNotes, notesForReplyRenote] =
                        await Promise.all([
                                userIds.size > 0
                                        ? Users.find({ where: { id: In([...userIds]) } })
                                        : [],
                                channelIds.size > 0
                                        ? Channels.find({ where: { id: In([...channelIds]) } })
                                        : [],
                                noteIdsToFetch.length > 0
                                        ? this.find({
                                                where: { id: In(noteIdsToFetch) },
                                                relations: ["user"],
                                          })
                                        : [],
                        ]);

		const noteFilesToPackIds = new Set<DriveFile["id"]>();
		for (const note of notes) {
			for (const fileId of note.fileIds) {
				noteFilesToPackIds.add(fileId);
			}
		}
		for (const note of notesForReplyRenote) {
			for (const fileId of note.fileIds) {
				noteFilesToPackIds.add(fileId);
			}
		}

		const allUsersForImageResolve = [
			...usersForNotes,
			...notesForReplyRenote
				.map((note) => note.user)
				.filter((user): user is User => user != null),
		];
		const userImageIds = new Set<DriveFile["id"]>();
		for (const user of allUsersForImageResolve) {
			if (user.avatarId != null) userImageIds.add(user.avatarId);
			if (user.bannerId != null) userImageIds.add(user.bannerId);
		}

		const allDriveFileIds = [...new Set([...noteFilesToPackIds, ...userImageIds])];
		const driveFiles =
			allDriveFileIds.length > 0
				? await DriveFiles.findBy({ id: In(allDriveFileIds) })
				: [];
		const driveFileMap = new Map(driveFiles.map((file) => [file.id, file]));

		for (const user of allUsersForImageResolve) {
			if (user.avatar === undefined && user.avatarId) {
				user.avatar = driveFileMap.get(user.avatarId) ?? null;
			}
			if (user.banner === undefined && user.bannerId) {
				user.banner = driveFileMap.get(user.bannerId) ?? null;
			}
		}

		const noteFilesToPack = [...noteFilesToPackIds]
			.map((fileId) => driveFileMap.get(fileId))
			.filter((file): file is NonNullable<typeof file> => file != null);
		const packedFiles = await DriveFiles.packMany(noteFilesToPack);
		const packedFileMap = new Map(packedFiles.map((file) => [file.id, file]));

                const userMap = new Map(usersForNotes.map((u) => [u.id, u]));
                const channelMap = new Map(channelsForNotes.map((c) => [c.id, c]));
                const noteMap = new Map(notesForReplyRenote.map((n) => [n.id, n]));

                const hint: NotePackHint = {
                        myReactions: myReactionsMap,
                        favorites: favoritedNoteIds,
                        me: meUser,
                        followings: followingsMap,
                        userMap,
                        channelMap,
                        noteMap,
			packedFileMap,
                };

                const promises = await Promise.allSettled(
                        notes.map((n) =>
                                this.pack(n, me, {
                                        ...options,
                                        _hint_: hint,
                                }),
                        ),
                );

		// filter out rejected promises, only keep fulfilled values
		return promises.flatMap((result) =>
			result.status === "fulfilled" ? [result.value] : [],
		);
	},

	/**
	 * 同一ノートを複数閲覧者（me）向けに pack する。
	 * メンション通知など、同じ note を異なる me で pack するときに、reactions/favorites/users を一括取得して N+1 を避ける。
	 *
	 * @param note - 対象ノート
	 * @param viewers - 閲覧者（id 必須。順序は戻り値の順序に反映される）
	 * @param options - detail など
	 * @returns 各 viewer に対応する Packed<"Note"> | null の配列（pack で例外になった viewer は null）
	 * @internal
	 */
	async packForViewers(
		note: Note,
		viewers: { id: User["id"] }[],
		options?: { detail?: boolean },
	): Promise<(Packed<"Note"> | null)[]> {
		if (viewers.length === 0) return [];
		const viewerIds = viewers.map((v) => v.id);

		const [reactionRows, favoriteRows, users] = await Promise.all([
			NoteReactions.find({
				where: { noteId: note.id, userId: In(viewerIds) },
			}),
			NoteFavorites.find({
				where: { noteId: note.id, userId: In(viewerIds) },
			}),
			Users.find({ where: { id: In(viewerIds) } }),
		]);

		const reactionsByUserId = new Map<User["id"], NoteReaction[]>();
		for (const r of reactionRows) {
			const arr = reactionsByUserId.get(r.userId) ?? [];
			arr.push(r);
			reactionsByUserId.set(r.userId, arr);
		}
		const favoritedUserIds = new Set(favoriteRows.map((f) => f.userId));
		const userMap = new Map(users.map((u) => [u.id, u]));

		const opts = { detail: true, ...options };
		const results = await Promise.allSettled(
			viewers.map((viewer) => {
				const meUser = userMap.get(viewer.id);
				if (!meUser) {
					return this.pack(note, viewer, opts);
				}
				const myReactions = new Map<
					Note["id"],
					NoteReaction | NoteReaction[] | null
				>();
				const reactions = reactionsByUserId.get(viewer.id);
				if (reactions != null) {
					myReactions.set(note.id, reactions.length === 1 ? reactions[0] : reactions);
				}
				const favorites = favoritedUserIds.has(viewer.id)
					? new Set<Note["id"]>([note.id])
					: new Set<Note["id"]>();
				const hint: NotePackHint = {
					myReactions,
					favorites,
					me: meUser,
				};
				return this.pack(note, meUser, { ...opts, _hint_: hint });
			}),
		);
		// viewers と同じ順序で返す（rejected は null）
		return results.map((r) =>
			r.status === "fulfilled" ? r.value : null,
		) as (Packed<"Note"> | null)[];
	},
});
