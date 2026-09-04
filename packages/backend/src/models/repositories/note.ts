/**
 * @packageDocumentation
 *
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
import type { UserProfile } from "@/models/entities/user-profile.js";
import type { UserMemo } from "@/models/entities/user-memo.js";
import type { UserRelation } from "./user.js";
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
import { countVisibleReferencesBatch } from "@/services/note/reference-visibility.js";
import { db } from "@/db/postgre.js";
import { redisClient, subscriber } from "@/db/redis.js";
import { Cache } from "@/misc/cache.js";
import {
	CACHE_MAX_USER,
	CACHE_MAX_USER_NOTE,
} from "@/misc/cache-limits.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import {
	getHiddenReactionDeltas,
	type HiddenReactionDeltaMap,
} from "@/services/note/reaction/visibility.js";
import { subtractHiddenReactionDeltas } from "@/misc/reaction-count.js";

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

/**
 * pack / packMany 間で共有するヒント。
 *
 * @remarks
 * NOTE: packMany 冒頭で relation / memo / profile 等を一括取得し、各 pack 内の per-note クエリを避ける。
 * @internal
 */
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
	/** packMany 用: reply/renote/references 用ノートを一括取得した Map */
	noteMap?: Map<Note["id"], Note>;
	/** packMany 用: ノート添付ファイルを一括 pack した Map（参照ノートの fileIds も含む） */
	packedFileMap?: Map<DriveFile["id"], Packed<"DriveFile">>;
	/** packMany 用: リモート投稿の閲覧者可視参照件数 */
	visibleReferencesCountMap?: Map<Note["id"], number>;
	/** packMany 用: 閲覧者と各投稿者の関係を一括取得した Map。あるときは packNoteUser 内の getRelation をスキップ */
	relationsMap?: Map<User["id"], UserRelation>;
	/** packMany 用: 閲覧者のユーザメモを一括取得した Map。キー無しはメモ無し */
	memoMap?: Map<User["id"], UserMemo | null>;
	/** packMany 用: 投稿者プロフィールを一括取得した Map。followedMessage / canWarnedViewerReact 用 */
	profileMap?: Map<User["id"], UserProfile>;
	/** packMany 用: 投稿者が閲覧者をフォローしているユーザ ID（警告ユーザー向け canWarnedViewerReact） */
	authorFollowsViewerSet?: Set<User["id"]>;
	/** 閲覧者から見えない利用者分のリアクション件数。空Mapも「集計済み」を表す */
	hiddenReactionDeltas?: HiddenReactionDeltaMap;
};

/** packNoteUser に渡すヒントの部分型 */
type PackNoteUserHint = Pick<
	NotePackHint,
	"relationsMap" | "memoMap" | "profileMap" | "userMap"
>;

/**
 * pack 対象ノート群から、ユーザープロフィール pack に必要なユーザ ID を収集する。
 *
 * @param notes - 入力ノート配列
 * @param noteMap - reply/renote 用に一括取得済みのノート Map
 * @returns 重複除去済みのユーザ ID 集合
 * @internal
 */
function collectPackUserIds(
	notes: Note[],
	noteMap: Map<Note["id"], Note>,
): Set<User["id"]> {
	const ids = new Set<User["id"]>();
	const addFromNote = (n: Note) => {
		if (n.userId) ids.add(n.userId);
		if (n.renoteUserId) ids.add(n.renoteUserId);
		if (n.replyUserId) ids.add(n.replyUserId);
		if (n.renote?.userId) ids.add(n.renote.userId);
		if (n.reply?.userId) ids.add(n.reply.userId);
	};
	for (const n of notes) addFromNote(n);
	for (const n of noteMap.values()) addFromNote(n);
	return ids;
}

const NOTE_PACK_CACHE_TTL_MS = 30 * 1000;
const NOTE_PACK_USER_PROFILE_CACHE_TTL_SEC = 60;
const NOTE_PACK_USER_PROFILE_CACHE_KEY_PREFIX = "note:pack:user";

const meUserCache = new Cache<User>(NOTE_PACK_CACHE_TTL_MS, {
	maxEntries: CACHE_MAX_USER,
	scopeName: "note:pack:me-user",
});
const followingsMapCache = new Cache<Map<User["id"], boolean>>(NOTE_PACK_CACHE_TTL_MS, {
	maxEntries: CACHE_MAX_USER,
	scopeName: "note:pack:followings",
});
const myReactionPointCache = new Cache<NoteReaction[]>(NOTE_PACK_CACHE_TTL_MS, {
	maxEntries: CACHE_MAX_USER_NOTE,
	scopeName: "note:pack:my-reactions",
});
const favoritePointCache = new Cache<boolean>(NOTE_PACK_CACHE_TTL_MS, {
	maxEntries: CACHE_MAX_USER_NOTE,
	scopeName: "note:pack:favorites",
});
const notePackUserProfileCache = new Cache<Packed<"User">>(NOTE_PACK_CACHE_TTL_MS, {
	maxEntries: CACHE_MAX_USER,
	scopeName: "note:pack:user-profile",
});

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
	isPushMuted: _isPushMuted,
		isFollowBlocking: _isFollowBlocking,
	muteTypes: _muteTypes,
	muteExpiresAt: _muteExpiresAt,
		isInviter: _isInviter,
		followedMessage: _followedMessage,
		...fixed
	} = user;

	return fixed;
}

/**
 * ノート用ユーザープロフィールキャッシュが webhook/stream 表示に必要な最小項目を満たすかを判定する。
 *
 * @param user - キャッシュ済みの Packed User
 * @returns username と avatarUrl が文字列で保持されていれば true
 * @remarks
 * NOTE: 既存キャッシュに欠損データが残っている場合、ここで検知して再生成する。
 * @internal
 */
function isUsableNotePackedUserProfile(user: Packed<"User">): boolean {
	return (
		typeof user.username === "string" &&
		user.username.length > 0 &&
		typeof user.avatarUrl === "string" &&
		user.avatarUrl.length > 0
	);
}

/**
 * ノート表示向けの固定ユーザープロフィールを取得する。
 *
 * @param src - ノート上の user（User もしくは userId）
 * @returns relation などの可変情報を除いた Packed User
 * @remarks
 * NOTE: キャッシュに不整合を検出した場合のみ削除して再生成し、正しい値を同じキーへ再キャッシュする。
 * NOTE: 再生成時は必ず userId で `Users.pack` し、部分オブジェクト由来の欠損を避ける。
 * @internal
 */
async function getFixedPackedUserForNote(
	src: NonNullable<Note["user"]> | User["id"],
): Promise<Packed<"User">> {
	const userId = typeof src === "object" ? src.id : src;
	const localCached = notePackUserProfileCache.get(userId);
	if (localCached !== undefined) {
		if (isUsableNotePackedUserProfile(localCached)) {
			return localCached;
		}
		// 欠損した古いキャッシュを使い回さないように削除する。
		deleteNotePackUserProfileCache(userId);
	}

	const redisKey = getNotePackUserProfileCacheKey(userId);
	const redisCached = await redisClient.get(redisKey);
	if (redisCached != null) {
		const parsed = JSON.parse(redisCached) as Packed<"User">;
		if (isUsableNotePackedUserProfile(parsed)) {
			notePackUserProfileCache.set(userId, parsed);
			return parsed;
		}
		// 欠損した Redis キャッシュは即削除し、下で再生成する。
		await redisClient.del(redisKey);
	}

	// NOTE: src が部分 User オブジェクトでも、ID から再取得して安定した avatar/name を作る。
	const packed = await Users.pack(userId, null, {
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

/**
 * ノート表示用にユーザーを pack する（固定プロフィール + 閲覧者向け可変情報）。
 *
 * @param src - ノート上の user（User もしくは userId）
 * @param me - 閲覧者
 * @param hint - packMany から渡される一括取得結果。無いときは従来どおり個別クエリ
 * @returns Packed User
 * @remarks
 * NOTE: hint.relationsMap / memoMap / profileMap があるときは per-note の DB 取得をスキップする。
 * @internal
 */
async function packNoteUser(
	src: NonNullable<Note["user"]> | User["id"],
	me?: { id: User["id"] } | null,
	hint?: PackNoteUserHint,
): Promise<Packed<"User">> {
	const fixed = await getFixedPackedUserForNote(src);
	const meId = me?.id ?? null;
	if (meId == null) {
		return fixed;
	}

	const userId = typeof src === "object" ? src.id : src;
	const user =
		typeof src === "object"
			? src
			: (hint?.userMap?.get(userId) ??
				(await Users.findOneByOrFail({ id: userId })));

	const memo =
		hint?.memoMap != null
			? (hint.memoMap.get(user.id) ?? null)
			: await UserMemos.findOneBy({
					userId: meId,
					targetUserId: user.id,
			  });

	const relation =
		meId !== user.id
			? (hint?.relationsMap?.get(user.id) ??
				(await Users.getRelation(meId, user.id, user)))
			: null;
	const onlineStatus = await Users.getOnlineStatus(user, meId, relation ?? undefined);

	const packed: Packed<"User"> = {
		...fixed,
		name: memo?.customName ? memo.customName : fixed.name,
		onlineStatus,
		memo: memo?.memo || undefined,
		originalName: memo?.customName ? fixed.name : undefined,
		isRenoteMuted: relation == null ? false : relation.isRenoteMuted,
		isPushMuted: relation == null ? false : relation.isPushMuted,
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
					muteTypes: relation.muteTypes,
					muteExpiresAt: relation.muteExpiresAt,
					isInviter: relation.isInviter ? true : undefined,
			  }
			: {}),
	};

	if (relation?.isFollowing) {
		const profile =
			hint?.profileMap?.get(user.id) ??
			(await UserProfiles.findOneBy({ userId: user.id }));
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
                // この判定は generateVisibilityQuery のチェックと常に同期している必要がある
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

                                /* フォロー関係が分かっていればそれでよい。
                                分かっていない場合、ノート作者もリアクション作者もリモートユーザーで
                                フォロー関係を取得できないことがある。その場合は互いにフォローしているとみなす。
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
                const skipReferencePacking = !!host;
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
                        const relation =
                                hint.relationsMap?.get(note.userId) ??
                                (await Users.getRelation(
                                        meId,
                                        note.userId,
                                        noteUser,
                                ));
			const scopedMuted =
				relation.muteTypes.includes("all") ||
				relation.muteTypes.includes(
					note.renoteId != null && note.text == null ? "renote" : "note",
				);
			if (scopedMuted || relation.isBlocked) {
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

                const reactions = (
                        note.isPublicLikeList || meId === note.userId
				? {
						...(myReactions?.myReactions?.length
							? Object.fromEntries(
									myReactions.myReactions.map((reaction) => [reaction, 1]),
							  )
							: {}),
						...note.reactions,
				  }
				: myReactions?.myReactions
				? Object.fromEntries(
						myReactions.myReactions.map((reaction) => [reaction, 1]),
				  )
				: {}
		) as Record<string, number>;

		if (meId != null && hint.hiddenReactionDeltas === undefined) {
			hint.hiddenReactionDeltas =
				note.isPublicLikeList || meId === note.userId
					? await getHiddenReactionDeltas([note.id], meId)
					: new Map();
		}
		const hiddenDeltas = hint.hiddenReactionDeltas?.get(note.id);
		const visibleReactions = subtractHiddenReactionDeltas(
			reactions,
			hiddenDeltas,
		);

		const reactionEmojiNames = Object.keys(visibleReactions)
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

		// 警告ユーザ向け: リアクションが許可されるときだけ canWarnedViewerReact: true を付与（省略＝当該文脈では不可）
		let canWarnedViewerReact: true | undefined;
		if (
			meId &&
			meUser?.isModerationWarning === true &&
			note.userId !== meId
		) {
			const authorFollowsViewer =
				hint.authorFollowsViewerSet != null
					? hint.authorFollowsViewerSet.has(note.userId)
					: await Followings.exist({
							where: { followerId: note.userId, followeeId: meId },
					  });
			if (authorFollowsViewer) {
				canWarnedViewerReact = true;
			} else {
				const remoteAuthor = noteUser.host != null;
				let acceptFromWarned = false;
				if (!remoteAuthor) {
					const ap =
						hint.profileMap?.get(note.userId) ??
						(await UserProfiles.findOneBy({
							userId: note.userId,
						}));
					acceptFromWarned =
						ap?.receiveReactionsFromNonFollowedWarnedUsers === true;
				}
				if (!remoteAuthor && acceptFromWarned) {
					canWarnedViewerReact = true;
				}
			}
		}

		const packed: Packed<"Note"> = await awaitAll({
			id: note.id,
			createdAt: note.createdAt.toISOString(),
			userId: note.userId,
			user: packNoteUser(noteUser, me, hint),
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
			reactions: convertLegacyReactions(visibleReactions),
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
			// ラッパー行の非正規化値。ネスト renote が欠けるストリーム／pack でも LTL のリモート純RT判定に使う。
			...(note.renoteId != null &&
			note.renoteUserHost != null &&
			note.renoteUserHost.length > 0
				? { renoteUserHost: note.renoteUserHost }
				: {}),
			referenceIds: note.referenceIds,
			hasReferences: host
				? note.hasReferences
				: (note.referenceIds?.length ?? 0) > 0,
			...(host
				? {
						visibleReferencesCount:
							hint.visibleReferencesCountMap?.get(note.id) ?? 0,
					}
				: {}),
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
			...(note.isBotMention ? { isBotMention: true as const } : {}),
			invisible: !isVisible ? true : undefined,
			...(canWarnedViewerReact
				? { canWarnedViewerReact: true as const }
				: {}),
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

                                                references:
                                                        skipReferencePacking ||
                                                        !note.referenceIds.filter(
                                                                (x) =>
                                                                        !/\W/.test(x) &&
                                                                        x !== note.renoteId,
                                                        ).length
                                                                ? undefined
                                                                : (
                                                                                await Promise.allSettled(
                                                                                        note.referenceIds
                                                                                                .filter(
                                                                                                        (x) =>
                                                                                                                !/\W/.test(
                                                                                                                        x,
                                                                                                                ) &&
                                                                                                                x !==
                                                                                                                        note.renoteId,
                                                                                                )
                                                                                                .map(async (x) => {
                                                                                                        try {
                                                                                                                // packMany で noteMap に載せた参照ノートがあれば再利用（N+1 と file 解決漏れ防止）
                                                                                                                return await this.pack(
                                                                                                                        opts._hint_?.noteMap?.get(x) ?? x,
                                                                                                                        me,
                                                                                                                        {
                                                                                                                                detail: true,
                                                                                                                                _hint_: opts._hint_,
                                                                                                                                showInvisible: false,
                                                                                                                                blockCheck: true,
                                                                                                                        },
                                                                                                                );
                                                                                                        } catch (e) {
                                                                                                                return null;
                                                                                                        }
                                                                                                }),
                                                                                )
                                                                        ).flatMap(
                                                                                (result) =>
                                                                                        result.status ===
                                                                                        "fulfilled"
                                                                                                ? [
                                                                                                                result.value,
                                                                                                        ]
                                                                                                : [],
                                                                        ).filter(Boolean),

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

	/**
	 * 複数ノートを pack する。hint で userMap / noteMap / relationsMap 等を渡すと N+1 を削減できる。
	 *
	 * @remarks
	 * 各ノートの pack は Promise.allSettled で並列実行し、fulfilled の結果のみを返す。
	 * いずれかのノートで pack が失敗（rejected）した場合、そのノートは戻り値に含まれず、件数が減った配列になる。
	 * NOTE: ログイン閲覧時は冒頭で getRelationsBulk / UserMemos / UserProfiles を一括取得し packNoteUser の per-note クエリを避ける。
	 * NOTE: 「純RT → 引用 → 引用先」の2段 renote まで noteMap / packedFileMap に含める（画面に表示され得る範囲）。
	 * NOTE: references（参照）も top-level / reply / renote から最大2段まで noteMap に載せ、添付を packedFileMap で解決する。
	 */
        async packMany(
                notes: Note[],
                me?: { id: User["id"] } | null | undefined,
                options?: {
                        detail?: boolean;
                        /** 呼び出し元から渡す初期 hint。userMap/noteMap があると該当分の DB 取得をスキップする */
                        _hint_?: Partial<NotePackHint>;
                },
	) {
		if (notes.length === 0) return [];

                const initialHint = options?._hint_;
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
                for (const n of notes) {
                        if (n.renoteUserId) userIds.add(n.renoteUserId);
                        if (n.renote?.userId) userIds.add(n.renote.userId);
                        if (n.replyUserId) userIds.add(n.replyUserId);
                        if (n.reply?.userId) userIds.add(n.reply.userId);
                }
                const channelIds = new Set(
                        notes.map((n) => n.channelId).filter((id): id is string => id != null),
                );
                const replyIds = notes.map((n) => n.replyId).filter((id): id is string => id != null);
                const renoteIds = notes.map((n) => n.renoteId).filter((id): id is string => id != null);
                const noteIdsToFetch = [...new Set([...replyIds, ...renoteIds])];

                const missingUserIds =
                        initialHint?.userMap != null
                                ? [...userIds].filter((id) => !initialHint.userMap!.has(id))
                                : [...userIds];
                const missingNoteIds =
                        initialHint?.noteMap != null
                                ? noteIdsToFetch.filter((id) => !initialHint.noteMap!.has(id))
                                : noteIdsToFetch;

                const [usersFetched, channelsForNotes, notesForReplyRenoteFetched] =
                        await Promise.all([
                                missingUserIds.length > 0
                                        ? Users.find({ where: { id: In(missingUserIds) } })
                                        : [],
                                channelIds.size > 0
                                        ? Channels.find({ where: { id: In([...channelIds]) } })
                                        : [],
                                missingNoteIds.length > 0
                                        ? this.find({
                                                where: { id: In(missingNoteIds) },
                                                relations: ["user"],
                                          })
                                        : [],
                        ]);

                const userMap = new Map<User["id"], User>(initialHint?.userMap ?? []);
                for (const u of usersFetched) {
                        userMap.set(u.id, u);
                }
                const noteMap = new Map<Note["id"], Note>(initialHint?.noteMap ?? []);
                for (const n of notesForReplyRenoteFetched) {
                        noteMap.set(n.id, n);
                }

		// RT+引用など2段 renote ネスト対策:
		// packMany の事前収集は top-level + 直下1階層までなので、画面に出る
		// 「純RT → 引用 → 引用先」の2階層目を noteMap/userMap に足し、
		// 続く packedFileMap 収集で引用先の fileIds も解決できるようにする。
		// reply は detail:false で pack され renote を展開しないため、renote のみ辿る。
		const secondLevelRenoteIds = [
			...new Set(
				[...noteMap.values()]
					.map((n) => n.renoteId)
					.filter((id): id is string => id != null && !noteMap.has(id)),
			),
		];
		if (secondLevelRenoteIds.length > 0) {
			const secondLevelNotes = await this.find({
				where: { id: In(secondLevelRenoteIds) },
				relations: ["user"],
			});
			for (const n of secondLevelNotes) {
				noteMap.set(n.id, n);
				// 2階層目ノートの pack で user / avatar 解決に使う
				if (n.user) {
					userMap.set(n.user.id, n.user);
					userIds.add(n.user.id);
				} else if (n.userId) {
					userIds.add(n.userId);
				}
			}
			// relations で user が取れなかった分だけ補完取得
			const stillMissingUserIds = [...userIds].filter(
				(id) => !userMap.has(id),
			);
			if (stillMissingUserIds.length > 0) {
				const moreUsers = await Users.find({
					where: { id: In(stillMissingUserIds) },
				});
				for (const u of moreUsers) {
					userMap.set(u.id, u);
				}
			}
		}

		// #region 参照ノートの事前収集（添付ファイル解決）
		// references は親と同じ packedFileMap で pack されるため、参照先の fileIds を
		// noteMap に載せないと files が空になり、クライアントが「削除されたファイル」と誤表示する。
		// pack 時と同じフィルタ（非英数字 ID・自ノートの renoteId 除外）で最大2段集める。
		/**
		 * noteMap に未載の参照 ID を収集する
		 *
		 * @param sourceNotes - 参照 ID の収集元ノート
		 * @returns noteMap にまだ無い参照ノート ID
		 * @internal
		 */
		const collectMissingReferenceIds = (
			sourceNotes: Iterable<Note>,
		): Note["id"][] => {
			const ids = new Set<Note["id"]>();
			for (const note of sourceNotes) {
				for (const id of note.referenceIds ?? []) {
					if (/\W/.test(id)) continue;
					if (id === note.renoteId) continue;
					if (noteMap.has(id)) continue;
					ids.add(id);
				}
			}
			return [...ids];
		};

		/**
		 * 参照ノートを取得して noteMap / userMap に載せる
		 *
		 * @param referenceIds - 取得する参照ノート ID
		 * @returns 取得できたノート（ネスト参照の次段収集用）
		 * @internal
		 */
		const absorbReferenceNotes = async (
			referenceIds: Note["id"][],
		): Promise<Note[]> => {
			if (referenceIds.length === 0) return [];
			const fetched = await this.find({
				where: { id: In(referenceIds) },
				relations: ["user"],
			});
			for (const n of fetched) {
				noteMap.set(n.id, n);
				if (n.user) {
					userMap.set(n.user.id, n.user);
					userIds.add(n.user.id);
				} else if (n.userId) {
					userIds.add(n.userId);
				}
			}
			const stillMissingUserIds = [...userIds].filter(
				(id) => !userMap.has(id),
			);
			if (stillMissingUserIds.length > 0) {
				const moreUsers = await Users.find({
					where: { id: In(stillMissingUserIds) },
				});
				for (const u of moreUsers) {
					userMap.set(u.id, u);
				}
			}
			return fetched;
		};

		// 1段目: top-level + reply/renote（2段含む）からの参照
		const firstLevelReferenceNotes = await absorbReferenceNotes(
			collectMissingReferenceIds([...notes, ...noteMap.values()]),
		);
		// 2段目: 参照ノート自身も detail:true でネスト参照を pack するため、もう1段だけ
		await absorbReferenceNotes(
			collectMissingReferenceIds(firstLevelReferenceNotes),
		);
		// #endregion

		const noteFilesToPackIds = new Set<DriveFile["id"]>();
		for (const note of notes) {
			for (const fileId of note.fileIds) {
				noteFilesToPackIds.add(fileId);
			}
		}
		for (const note of noteMap.values()) {
			for (const fileId of note.fileIds) {
				noteFilesToPackIds.add(fileId);
			}
		}

		const allUsersForImageResolve: User[] = [];
		for (const uid of userIds) {
			const u = userMap.get(uid);
			if (u) allUsersForImageResolve.push(u);
		}
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

                const channelMap = new Map(channelsForNotes.map((c) => [c.id, c]));

                const visibleReferencesCountMap =
                        await countVisibleReferencesBatch(notes, me);

                // relation / memo / profile を一括取得し packNoteUser の N+1 を避ける
                let relationsMap = new Map<User["id"], UserRelation>(
                        initialHint?.relationsMap ?? [],
                );
                let memoMap: Map<User["id"], UserMemo | null> | undefined =
                        initialHint?.memoMap;
                let profileMap = new Map<User["id"], UserProfile>(
                        initialHint?.profileMap ?? [],
                );
                let authorFollowsViewerSet = initialHint?.authorFollowsViewerSet;

                if (meId) {
                        const allPackUserIds = collectPackUserIds(notes, noteMap);
                        const relationTargetIds = [...allPackUserIds].filter(
                                (id) => id !== meId,
                        );

                        if (relationTargetIds.length > 0) {
                                const missingRelationIds = relationTargetIds.filter(
                                        (id) => !relationsMap.has(id),
                                );
                                const targetUsers = missingRelationIds
                                        .map((id) => userMap.get(id))
                                        .filter((u): u is User => u != null);

                                const needMemos = memoMap == null;
                                const needProfiles = initialHint?.profileMap == null;

                                const [bulkRelations, memoRows, profiles] =
                                        await Promise.all([
                                                missingRelationIds.length > 0
                                                        ? Users.getRelationsBulk(
                                                                  meId,
                                                                  missingRelationIds,
                                                                  targetUsers,
                                                          )
                                                        : Promise.resolve(
                                                                  new Map<
                                                                          User["id"],
                                                                          UserRelation
                                                                  >(),
                                                          ),
                                                needMemos
                                                        ? UserMemos.findBy({
                                                                  userId: meId,
                                                                  targetUserId: In(
                                                                          relationTargetIds,
                                                                  ),
                                                          })
                                                        : Promise.resolve([]),
                                                needProfiles
                                                        ? UserProfiles.findBy({
                                                                  userId: In(
                                                                          relationTargetIds,
                                                                  ),
                                                          })
                                                        : Promise.resolve([]),
                                        ]);

                                for (const [id, relation] of bulkRelations) {
                                        relationsMap.set(id, relation);
                                }

                                if (needMemos) {
                                        memoMap = new Map(
                                                memoRows.map((row) => [
                                                        row.targetUserId,
                                                        row,
                                                ]),
                                        );
                                }

                                if (needProfiles) {
                                        profileMap = new Map(
                                                profiles.map((p) => [p.userId, p]),
                                        );
                                }
                        }

                        if (
                                meUser?.isModerationWarning === true &&
                                authorFollowsViewerSet == null
                        ) {
                                const authorIds = [
                                        ...new Set(
                                                notes
                                                        .map((n) => n.userId)
                                                        .filter((id) => id !== meId),
                                        ),
                                ];
                                if (authorIds.length > 0) {
                                        const authorFollowRows = await Followings.findBy({
                                                followerId: In(authorIds),
                                                followeeId: meId,
                                        });
                                        authorFollowsViewerSet = new Set(
                                                authorFollowRows.map((r) => r.followerId),
                                        );
                                } else {
                                        authorFollowsViewerSet = new Set();
                                }
                        }
                }

		let hiddenReactionDeltas = initialHint?.hiddenReactionDeltas;
		if (meId != null && hiddenReactionDeltas === undefined) {
			const packableNotes = [...notes, ...noteMap.values()];
			const eligibleNoteIds = packableNotes
				.filter(
					(note) => note.isPublicLikeList || note.userId === meId,
				)
				.map((note) => note.id);
			hiddenReactionDeltas = await getHiddenReactionDeltas(
				eligibleNoteIds,
				meId,
			);
		}

                const hint: NotePackHint = {
                        myReactions: myReactionsMap,
                        favorites: favoritedNoteIds,
                        me: meUser,
                        followings: followingsMap,
                        userMap,
                        channelMap,
                        noteMap,
			packedFileMap,
                        visibleReferencesCountMap,
                        relationsMap:
                                relationsMap.size > 0 ? relationsMap : undefined,
                        memoMap,
                        profileMap: profileMap.size > 0 ? profileMap : undefined,
                        authorFollowsViewerSet,
			hiddenReactionDeltas,
                };

                const promises = await Promise.allSettled(
                        notes.map((n) =>
                                this.pack(n, me, {
                                        ...options,
                                        _hint_: hint,
                                }),
                        ),
                );

		// 拒否された Promise を除き、履行された値のみ返す
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
