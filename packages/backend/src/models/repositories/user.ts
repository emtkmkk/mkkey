import { URL } from "url";
import { In, Not } from "typeorm";
import Ajv from "ajv";
import type { ILocalUser, IRemoteUser } from "@/models/entities/user.js";
import { User } from "@/models/entities/user.js";
import config from "@/config/index.js";
import type { Packed } from "@/misc/schema.js";
import type { Promiseable } from "@/prelude/await-all.js";
import { awaitAll } from "@/prelude/await-all.js";
import { populateEmojis } from "@/misc/populate-emojis.js";
import {
	MB,
	DEFAULT_DRIVE_SIZE,
	MAX_DRIVE_SIZE,
	USER_ACTIVE_THRESHOLD,
	USER_ACTIVE2_THRESHOLD,
	USER_HALFONLINE_THRESHOLD,
	USER_ONLINE_THRESHOLD,
	USER_HALFSLEEP_THRESHOLD,
	USER_SLEEP_THRESHOLD,
	USER_DEEPSLEEP_THRESHOLD,
	USER_SUPERSLEEP_THRESHOLD,
} from "@/const.js";
import { Cache } from "@/misc/cache.js";
import { db } from "@/db/postgre.js";
import { isActor, getApId } from "@/remote/activitypub/type.js";
import DbResolver from "@/remote/activitypub/db-resolver.js";
import Resolver from "@/remote/activitypub/resolver.js";
import { createPerson } from "@/remote/activitypub/models/person.js";
import {
	AnnouncementReads,
	Announcements,
	Antennas,
	AntennaNotes,
	Blockings,
	ChannelFollowings,
	Clips,
	DriveFiles,
	Followings,
	FollowRequests,
	GalleryPosts,
	Instances,
	MessagingMessages,
	Mutings,
	RenoteMutings,
	Notes,
	NoteUnreads,
	Notifications,
	Pages,
	UserGroupJoinings,
	UserNotePinings,
	UserProfiles,
	UserSecurityKeys,
	UserMemos,
	FollowBlockings,
	EmojiCustomCategories,
} from "../index.js";
import type { Instance } from "../entities/instance.js";
import type { UserProfile } from "../entities/user-profile.js";
import type { Note } from "../entities/note.js";
import type { UserNotePining } from "../entities/user-note-pining.js";
import { resolveUser } from "@/remote/resolve-user.js";
import { redisClient } from "@/db/redis.js";

/** /i の base キャッシュ TTL（秒）。キャッシュヒット率向上のため 20 分に設定。 */
const ME_DETAILED_BASE_CACHE_TTL_SEC = 60 * 20;
const ME_DETAILED_VOLATILE_CACHE_TTL_SEC = 30;
const ME_DETAILED_MERGED_CACHE_TTL_SEC = 45;

const userInstanceCache = new Cache<Instance | null>(1000 * 60 * 60 * 3);

type IsUserDetailed<Detailed extends boolean> = Detailed extends true
	? Packed<"UserDetailed">
	: Packed<"UserLite">;
type IsMeAndIsUserDetailed<
        ExpectsMe extends boolean | null,
        Detailed extends boolean,
> = Detailed extends true
        ? ExpectsMe extends true
                ? Packed<"MeDetailed">
                : ExpectsMe extends false
                ? Packed<"UserDetailedNotMe">
                : Packed<"UserDetailed">
        : Packed<"UserLite">;

export type UserRelation = {
        id: User["id"];
        isFollowing: boolean;
        isFollowed: boolean;
        hasPendingFollowRequestFromYou: boolean;
        hasPendingFollowRequestToYou: boolean;
        isBlocking: boolean;
        isBlocked: boolean;
        isMuted: boolean;
        isRenoteMuted: boolean;
        isFollowBlocking: boolean;
        isInviter: boolean;
};

export type MeDetailedVolatile = {
	hasUnreadSpecifiedNotes: boolean;
	hasUnreadMentions: boolean;
	hasUnreadAnnouncement: boolean;
	hasUnreadAntenna: boolean;
	hasUnreadChannel: boolean;
	hasUnreadMessagingMessage: boolean;
	hasUnreadNotification: boolean;
	hasPendingReceivedFollowRequest: boolean;
};

const ajv = new Ajv();

const localUsernameSchema = {
	type: "string",
	pattern: /^\w{1,20}$/.toString().slice(1, -1),
} as const;
const passwordSchema = { type: "string", minLength: 1 } as const;
const nameSchema = { type: "string", minLength: 1, maxLength: 128 } as const;
const descriptionSchema = {
	type: "string",
	minLength: 1,
	maxLength: 2048,
} as const;
const locationSchema = {
	type: "string",
	minLength: 1,
	maxLength: 128,
} as const;
const birthdaySchema = {
	type: "string",
	pattern: /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.toString().slice(1, -1),
} as const;
export const followedMessageSchema = { type: 'string', minLength: 1, maxLength: 256 } as const;

function isLocalUser(user: User): user is ILocalUser;
function isLocalUser<T extends { host: User["host"] }>(
	user: T,
): user is T & { host: null };
/**
 * Returns true if the user is local.
 *
 * @param user The user to check.
 * @returns True if the user is local.
 */
function isLocalUser(user: User | { host: User["host"] }): boolean {
	return user.host == null;
}

function isRemoteUser(user: User): user is IRemoteUser;
function isRemoteUser<T extends { host: User["host"] }>(
	user: T,
): user is T & { host: string };
/**
 * Returns true if the user is remote.
 *
 * @param user The user to check.
 * @returns True if the user is remote.
 */
function isRemoteUser(user: User | { host: User["host"] }): boolean {
	return !isLocalUser(user);
}

export const UserRepository = db.getRepository(User).extend({
	localUsernameSchema,
	passwordSchema,
	nameSchema,
	descriptionSchema,
	locationSchema,
	birthdaySchema,
	followedMessageSchema,

	//#region Validators
	validateLocalUsername: ajv.compile(localUsernameSchema),
	validatePassword: ajv.compile(passwordSchema),
	validateName: ajv.compile(nameSchema),
	validateDescription: ajv.compile(descriptionSchema),
	validateLocation: ajv.compile(locationSchema),
	validateBirthday: ajv.compile(birthdaySchema),
	//#endregion

        async getRelation(
                me: User["id"],
                target: User["id"],
                targetUser?: Pick<User, "id" | "inviteUserId"> | null,
        ): Promise<UserRelation> {
                const relations = await this.getRelationsBulk(
                        me,
                        [target],
                        targetUser ? [targetUser] : undefined,
                );
                const relation = relations.get(target);
                if (relation == null) {
                        return {
                                id: target,
                                isFollowing: false,
                                isFollowed: false,
                                hasPendingFollowRequestFromYou: false,
                                hasPendingFollowRequestToYou: false,
                                isBlocking: false,
                                isBlocked: false,
                                isMuted: false,
                                isRenoteMuted: false,
                                isFollowBlocking: false,
                                isInviter: false,
                        } as UserRelation;
                }

                return relation;
        },

        async getRelationsBulk(
                meId: User["id"],
                targetIds: User["id"][],
                targetUsers?: (Pick<User, "id" | "inviteUserId"> | null | undefined)[],
        ): Promise<Map<User["id"], UserRelation>> {
                const uniqueTargetIds = Array.from(
                        new Set(targetIds.filter((id) => id !== meId)),
                );

                const relationsMap = new Map<User["id"], UserRelation>();

                const targetUserMap = new Map<
                        User["id"],
                        Pick<User, "id" | "inviteUserId">
                >();

                if (targetUsers) {
                        for (const info of targetUsers) {
                                if (info) {
                                        targetUserMap.set(info.id, info);
                                }
                        }
                }

                if (uniqueTargetIds.length === 0) {
                        return relationsMap;
                }

                for (const id of uniqueTargetIds) {
                        relationsMap.set(id, {
                                id,
                                isFollowing: false,
                                isFollowed: false,
                                hasPendingFollowRequestFromYou: false,
                                hasPendingFollowRequestToYou: false,
                                isBlocking: false,
                                isBlocked: false,
                                isMuted: false,
                                isRenoteMuted: false,
                                isFollowBlocking: false,
                                isInviter: false,
                        });
                }

                const [
                        followings,
                        followers,
                        pendingFromYou,
                        pendingToYou,
                        blockings,
                        blockedBy,
                        mutings,
                        renoteMutings,
                        followBlockings,
                        invitees,
                ] = await Promise.all([
                        Followings.findBy({
                                followerId: meId,
                                followeeId: In(uniqueTargetIds),
                        }),
                        Followings.findBy({
                                followerId: In(uniqueTargetIds),
                                followeeId: meId,
                        }),
                        FollowRequests.findBy({
                                followerId: meId,
                                followeeId: In(uniqueTargetIds),
                        }),
                        FollowRequests.findBy({
                                followerId: In(uniqueTargetIds),
                                followeeId: meId,
                        }),
                        Blockings.findBy({
                                blockerId: meId,
                                blockeeId: In(uniqueTargetIds),
                        }),
                        Blockings.findBy({
                                blockerId: In(uniqueTargetIds),
                                blockeeId: meId,
                        }),
                        Mutings.findBy({
                                muterId: meId,
                                muteeId: In(uniqueTargetIds),
                        }),
                        RenoteMutings.findBy({
                                muterId: meId,
                                muteeId: In(uniqueTargetIds),
                        }),
                        FollowBlockings.findBy({
                                blockerId: meId,
                                blockeeId: In(uniqueTargetIds),
                        }),
                        (async () => {
                                const idsToFetch = uniqueTargetIds.filter((id) => {
                                        const info = targetUserMap.get(id);
                                        return !(info && info.inviteUserId === meId);
                                });

                                if (idsToFetch.length === 0) {
                                        return [] as Pick<User, "id" | "inviteUserId">[];
                                }

                                return this.find({
                                        select: { id: true, inviteUserId: true },
                                        where: {
                                                id: In(idsToFetch),
                                                inviteUserId: meId,
                                        },
                                });
                        })(),
                ]);

                for (const following of followings) {
                        const relation = relationsMap.get(following.followeeId);
                        if (relation) relation.isFollowing = true;
                }

                for (const follower of followers) {
                        const relation = relationsMap.get(follower.followerId);
                        if (relation) relation.isFollowed = true;
                }

                for (const request of pendingFromYou) {
                        const relation = relationsMap.get(request.followeeId);
                        if (relation) relation.hasPendingFollowRequestFromYou = true;
                }

                for (const request of pendingToYou) {
                        const relation = relationsMap.get(request.followerId);
                        if (relation) relation.hasPendingFollowRequestToYou = true;
                }

                for (const blocking of blockings) {
                        const relation = relationsMap.get(blocking.blockeeId);
                        if (relation) relation.isBlocking = true;
                }

                for (const blocked of blockedBy) {
                        const relation = relationsMap.get(blocked.blockerId);
                        if (relation) relation.isBlocked = true;
                }

                for (const muting of mutings) {
                        const relation = relationsMap.get(muting.muteeId);
                        if (relation) relation.isMuted = true;
                }

                for (const muting of renoteMutings) {
                        const relation = relationsMap.get(muting.muteeId);
                        if (relation) relation.isRenoteMuted = true;
                }

                for (const followBlocking of followBlockings) {
                        const relation = relationsMap.get(followBlocking.blockeeId);
                        if (relation) relation.isFollowBlocking = true;
                }

                for (const info of targetUserMap.values()) {
                        if (info.inviteUserId === meId) {
                                const relation = relationsMap.get(info.id);
                                if (relation) relation.isInviter = true;
                        }
                }

                for (const invitee of invitees) {
                        const relation = relationsMap.get(invitee.id);
                        if (relation) relation.isInviter = true;
                }

                return relationsMap;
        },

	async getHasUnreadMessagingMessage(userId: User["id"]): Promise<boolean> {
		const mute = await Mutings.findBy({ muterId: userId });

		const [withUser, withGroups] = await Promise.all([
			MessagingMessages.count({
				where: {
					recipientId: userId,
					isRead: false,
					...(mute.length > 0
						? { userId: Not(In(mute.map((x) => x.muteeId))) }
						: {}),
				},
				take: 1,
			}).then((count) => count > 0),
			// グループ未読を 1 クエリで判定（加入グループごとの条件を JOIN で再現）
			MessagingMessages.createQueryBuilder("message")
				.innerJoin(
					UserGroupJoinings,
					"j",
					"j.userGroupId = message.groupId AND j.userId = :userId",
					{ userId },
				)
				.where("message.userId != :userId", { userId })
				.andWhere("NOT (:userIdList <@ message.reads)", {
					userIdList: [userId],
				})
				.andWhere("message.createdAt > j.createdAt")
				.limit(1)
				.getRawOne()
				.then((row) => row != null),
		]);

		return withUser || withGroups;
	},

	async getHasUnreadAnnouncement(userId: User["id"]): Promise<boolean> {
		const reads = await AnnouncementReads.findBy({
			userId: userId,
		});

		const count = await Announcements.countBy(
			reads.length > 0
				? {
						id: Not(In(reads.map((read) => read.announcementId))),
				  }
				: {},
		);

		return count > 0;
	},

	async userFromURI(uri: string): Promise<User | null> {
		const dbResolver = new DbResolver();
		let local = await dbResolver.getUserFromApId(uri);
		if (local) {
			return local;
		}

		// fetching Object once from remote
		const resolver = new Resolver();
		const object = (await resolver.resolve(uri)) as any;

		// /@user If a URI other than the id is specified,
		// the URI is determined here
		if (uri !== object.id) {
			local = await dbResolver.getUserFromApId(object.id);
			if (local != null) return local;
		}

		return isActor(object) ? await createPerson(getApId(object)) : null;
	},

	async getHasUnreadAntenna(userId: User["id"]): Promise<boolean> {
		const myAntennas = await Antennas.find({
			where: { userId },
			select: ["id"],
		});
		if (myAntennas.length === 0) return false;
		const unread = await AntennaNotes.findOneBy({
			antennaId: In(myAntennas.map((x) => x.id)),
			read: false,
		});
		return unread != null;
	},

	async getHasUnreadChannel(userId: User["id"]): Promise<boolean> {
		const channels = await ChannelFollowings.findBy({ followerId: userId });

		const unread =
			channels.length > 0
				? await NoteUnreads.findOneBy({
						userId: userId,
						noteChannelId: In(channels.map((x) => x.followeeId)),
				  })
				: null;

		return unread != null;
	},

	async getHasUnreadNotification(userId: User["id"]): Promise<boolean> {
		const mute = await Mutings.findBy({
			muterId: userId,
		});
		const mutedUserIds = mute.map((m) => m.muteeId);

		const count = await Notifications.count({
			where: {
				notifieeId: userId,
				...(mutedUserIds.length > 0
					? { notifierId: Not(In(mutedUserIds)) }
					: {}),
				isRead: false,
			},
			take: 1,
		});

		return count > 0;
	},

	async getHasPendingReceivedFollowRequest(
		userId: User["id"],
	): Promise<boolean> {
		const followBlocking = await FollowBlockings.findBy({
			blockerId: userId,
		});

		const count = await FollowRequests.countBy({
			followeeId: userId,
			followerId: Not(In(followBlocking.map((x) => x.blockeeId))),
		});

		return count > 0;
	},

	getMeDetailedBaseCacheKey(
		userId: User["id"],
		includeSecrets: boolean,
	): string {
		return `me:detailed:base:${userId}:${includeSecrets ? "secure" : "public"}`;
	},

	getMeDetailedVolatileCacheKey(userId: User["id"]): string {
		return `me:detailed:volatile:${userId}`;
	},

	getMeDetailedMergedCacheKey(
		userId: User["id"],
		includeSecrets: boolean,
	): string {
		return `me:detailed:merged:${userId}:${includeSecrets ? "secure" : "public"}`;
	},

	async invalidateMeDetailedBaseCache(userId: User["id"]): Promise<void> {
		await redisClient.del(
			this.getMeDetailedBaseCacheKey(userId, true),
			this.getMeDetailedBaseCacheKey(userId, false),
			this.getMeDetailedMergedCacheKey(userId, true),
			this.getMeDetailedMergedCacheKey(userId, false),
		);
	},

	getMeDetailedBaseCacheTtlSec(): number {
		return ME_DETAILED_BASE_CACHE_TTL_SEC;
	},

	getMeDetailedVolatileCacheTtlSec(): number {
		return ME_DETAILED_VOLATILE_CACHE_TTL_SEC;
	},

	getMeDetailedMergedCacheTtlSec(): number {
		return ME_DETAILED_MERGED_CACHE_TTL_SEC;
	},

	/**
	 * 未読・未処理系の volatile 情報を一括取得する。
	 * 6項目を1本の raw クエリで取得し、antenna と messaging は別途並列で取得して DB 往復を削減する。
	 */
	async getMeDetailedVolatile(userId: User["id"]): Promise<MeDetailedVolatile> {
		const [batchRow, hasUnreadAntenna, hasUnreadMessagingMessage] =
			await Promise.all([
				this.getMeDetailedVolatileBatch(userId),
				this.getHasUnreadAntenna(userId),
				this.getHasUnreadMessagingMessage(userId),
			]);

		return {
			hasUnreadSpecifiedNotes: batchRow.hasUnreadSpecifiedNotes,
			hasUnreadMentions: batchRow.hasUnreadMentions,
			hasUnreadAnnouncement: batchRow.hasUnreadAnnouncement,
			hasUnreadAntenna,
			hasUnreadChannel: batchRow.hasUnreadChannel,
			hasUnreadMessagingMessage,
			hasUnreadNotification: batchRow.hasUnreadNotification,
			hasPendingReceivedFollowRequest: batchRow.hasPendingReceivedFollowRequest,
		};
	},

	/**
	 * getMeDetailedVolatile のうち、1本の SQL で取得できる6項目を一括取得する。
	 * @internal
	 */
	async getMeDetailedVolatileBatch(
		userId: User["id"],
	): Promise<{
		hasUnreadSpecifiedNotes: boolean;
		hasUnreadMentions: boolean;
		hasUnreadAnnouncement: boolean;
		hasUnreadChannel: boolean;
		hasUnreadNotification: boolean;
		hasPendingReceivedFollowRequest: boolean;
	}> {
		const rows = await db.query(
			`SELECT
  (SELECT EXISTS(SELECT 1 FROM note_unread n WHERE n."userId" = $1 AND n."isSpecified" = true LIMIT 1)) AS "hasUnreadSpecifiedNotes",
  (SELECT EXISTS(SELECT 1 FROM note_unread n WHERE n."userId" = $1 AND n."isMentioned" = true LIMIT 1)) AS "hasUnreadMentions",
  (SELECT (COUNT(*) > 0) FROM announcement a WHERE NOT EXISTS (SELECT 1 FROM announcement_read ar WHERE ar."userId" = $1 AND ar."announcementId" = a.id)) AS "hasUnreadAnnouncement",
  (SELECT EXISTS(SELECT 1 FROM note_unread nu WHERE nu."userId" = $1 AND nu."noteChannelId" IS NOT NULL AND nu."noteChannelId" IN (SELECT cf."followeeId" FROM channel_following cf WHERE cf."followerId" = $1) LIMIT 1)) AS "hasUnreadChannel",
  (SELECT EXISTS(SELECT 1 FROM notification n WHERE n."notifieeId" = $1 AND n."isRead" = false AND NOT EXISTS (SELECT 1 FROM muting m WHERE m."muterId" = $1 AND m."muteeId" = n."notifierId") LIMIT 1)) AS "hasUnreadNotification",
  (SELECT EXISTS(SELECT 1 FROM follow_request fr WHERE fr."followeeId" = $1 AND NOT EXISTS (SELECT 1 FROM follow_blocking fb WHERE fb."blockerId" = $1 AND fb."blockeeId" = fr."followerId") LIMIT 1)) AS "hasPendingReceivedFollowRequest"`,
			[userId],
		);
		const r = rows[0] as Record<string, unknown>;
		return {
			hasUnreadSpecifiedNotes: Boolean(r?.hasUnreadSpecifiedNotes),
			hasUnreadMentions: Boolean(r?.hasUnreadMentions),
			hasUnreadAnnouncement: Boolean(r?.hasUnreadAnnouncement),
			hasUnreadChannel: Boolean(r?.hasUnreadChannel),
			hasUnreadNotification: Boolean(r?.hasUnreadNotification),
			hasPendingReceivedFollowRequest: Boolean(
				r?.hasPendingReceivedFollowRequest,
			),
		};
	},

        async getOnlineStatus(
                user: User,
                meId?: string | null,
                relationHint?: Pick<UserRelation, "isFollowed"> | null,
        ): Promise<
                | "unknown"
                | "online"
                | "half-online"
		| "active"
		| "half-active"
		| "offline"
		| "half-sleeping"
		| "sleeping"
		| "deep-sleeping"
		| "never-sleeping"
		| "super-sleeping"
        > {
                if (!meId) return "unknown";

                if (meId !== user.id && meId !== "9d5ts6in38" && !user.host) {
                        let isFollowed = relationHint?.isFollowed;

                        if (isFollowed == null) {
                                isFollowed = (
                                        await this.getRelation(meId, user.id, user)
                                ).isFollowed;
                        }

                        if (!isFollowed) {
                                return "unknown";
                        }
                }
                if (user.lastActiveDate == null) return "unknown";
                const elapsed = Date.now() - user.lastActiveDate.getTime();
		return elapsed < USER_ONLINE_THRESHOLD
			? "online"
			: elapsed < USER_HALFONLINE_THRESHOLD
			? "half-online"
			: elapsed < USER_ACTIVE_THRESHOLD
			? "active"
			: elapsed < USER_ACTIVE2_THRESHOLD
			? "half-active"
			: elapsed < USER_HALFSLEEP_THRESHOLD
			? "offline"
			: elapsed < USER_SLEEP_THRESHOLD
			? "half-sleeping"
			: elapsed < USER_DEEPSLEEP_THRESHOLD
			? "sleeping"
			: elapsed < USER_SUPERSLEEP_THRESHOLD
			? "deep-sleeping"
			: "super-sleeping";
	},

	async getAvatarUrl(user: User): Promise<string> {
		if (user.avatar) {
			return (
				DriveFiles.getPublicUrl(user.avatar, true) ||
				this.getIdenticonUrl(user.id)
			);
		} else if (user.avatarId) {
			const avatar = await DriveFiles.findOneByOrFail({ id: user.avatarId });
			return (
				DriveFiles.getPublicUrl(avatar, true) || this.getIdenticonUrl(user.id)
			);
		} else {
			return this.getIdenticonUrl(user.id);
		}
	},

	getAvatarUrlSync(user: User): string {
		if (user.avatar) {
			return (
				DriveFiles.getPublicUrl(user.avatar, true) ||
				this.getIdenticonUrl(user.id)
			);
		} else {
			return this.getIdenticonUrl(user.id);
		}
	},

	getIdenticonUrl(userId: User["id"]): string {
		return `${config.url}/missing`;
	},

        async pack<
                ExpectsMe extends boolean | null = null,
                D extends boolean = false,
        >(
                src: User["id"] | User,
                me?: { id: User["id"] } | null | undefined,
                options?: {
                        detail?: D;
                        relation?: D;
                        includeSecrets?: boolean;
                },
                hints?: {
                        relation?: UserRelation | null;
                        memo?: Awaited<ReturnType<typeof UserMemos.findOneBy>> | null;
                        /** packMany 用: 一括取得した User。渡されていれば findOneOrFail をスキップ */
                        user?: User | null;
                        /** packMany 用: 一括取得したプロファイル。渡されていれば UserProfiles.findOneByOrFail をスキップ */
                        profile?: UserProfile | null;
                        /** packMany 用: 一括取得したピン（note  join 済み）。渡されていれば UserNotePinings の QueryBuilder をスキップ */
                        pins?: (UserNotePining & { note: Note })[] | null;
                        /** packMany 用: 一括取得した has* の結果。渡されていれば各 count をスキップ */
                        hasClips?: boolean;
                        hasPages?: boolean;
                        hasGallerys?: boolean;
                        hasCategories?: boolean;
                        /** packMany 用: 一括 pack したピン付きノート。渡されていれば Notes.packMany(pins) をスキップ */
                        pinnedNotesPacked?: Packed<"Note">[];
                        /** packMany 用: 一括 pack した pinnedPage。渡されていれば Pages.pack をスキップ */
                        pinnedPagePacked?: Packed<"Page"> | null;
                },
        ): Promise<IsMeAndIsUserDetailed<ExpectsMe, D>> {
                const opts = Object.assign(
                        {
                                detail: false,
                                relation: false,
				includeSecrets: false,
			},
			options,
		);

		let user: User;

		if (typeof src === "object") {
			user = src;
			if (src.avatar === undefined && src.avatarId)
				src.avatar = (await DriveFiles.findOneBy({ id: src.avatarId })) ?? null;
			if (src.banner === undefined && src.bannerId)
				src.banner = (await DriveFiles.findOneBy({ id: src.bannerId })) ?? null;
		} else if (hints?.user != null) {
			user = hints.user;
		} else {
			user = await this.findOneOrFail({
				where: { id: src },
				relations: {
					avatar: true,
					banner: true,
				},
			});
		}

		if (user.host && user.lastFetchedAt && Date.now() - new Date(user.lastFetchedAt).getTime() > (7 * 24 * 60 * 60 * 1000)) {
			const ruser = await resolveUser(user.username, user.host).catch((e) => {
				console.log(`failed to resolve remote user: ${e}`);
			});
			if (ruser) {
				user = await this.findOneOrFail({
					where: { id: ruser.id },
					relations: {
						avatar: true,
						banner: true,
					},
				});
			}
		}

		const meId = me ? me.id : null;
		const isMe = meId === user.id;

		const relationHintProvided = hints != null && "relation" in hints;
		const relation = relationHintProvided
			? hints?.relation ?? null
			: meId && !isMe && (opts.detail || opts.relation)
			? await this.getRelation(meId, user.id, user)
			: null;
		const meDetailedVolatile = opts.detail && isMe
			? await this.getMeDetailedVolatile(user.id)
			: null;
		const pins =
			opts.detail && "pins" in (hints ?? {})
				? (hints!.pins ?? [])
				: opts.detail
					? await UserNotePinings.createQueryBuilder("pin")
							.where("pin.userId = :userId", { userId: user.id })
							.innerJoinAndSelect("pin.note", "note")
							.orderBy("pin.createdAt", "DESC")
							.addOrderBy("pin.id", "DESC")
							.getMany()
					: [];
		const profile =
			"profile" in (hints ?? {})
				? (hints!.profile ?? null)
				: !user.host || opts.detail
					? await UserProfiles.findOneByOrFail({ userId: user.id })
					: null;

		const followingCount =
			profile == null
				? null
				: profile.ffVisibility === "public" || isMe
				? user.followingCount
				: profile.ffVisibility === "followers" &&
				  relation &&
				  relation.isFollowing
				? user.followingCount
				: user.followingCount;

		const followersCount =
			profile == null
				? null
				: profile.ffVisibility === "public" || isMe
				? user.followersCount
				: profile.ffVisibility === "followers" &&
				  relation &&
				  relation.isFollowing
				? user.followersCount
				: user.followersCount;

		const rankBadges =
			user.maxRankPoint > 5000 && !user.isBot
				? {
						id: `${3000010000 + (user.maxRankPoint - 5000)}`,
						key: "star",
						name: `星の観測者${
							user.maxRankPoint > 9000
								? `+${Math.floor(user.maxRankPoint / 1000) - 5}`
								: user.maxRankPoint > 6000
								? "+".repeat(Math.floor(user.maxRankPoint / 1000) - 5)
								: ""
						}${` ${((user.maxRankPoint % 1000) / 10).toFixed(1)}%`}`,
						emoji: "⭐",
						showBadgeNote: false,
				  }
				: undefined;

		const donateBadges =
			user.driveCapacityOverrideMb > DEFAULT_DRIVE_SIZE / MB
				? user.driveCapacityOverrideMb >= DEFAULT_DRIVE_SIZE / MB + 15000
					? user.driveCapacityOverrideMb >= MAX_DRIVE_SIZE / 2 / MB
						? user.driveCapacityOverrideMb >= MAX_DRIVE_SIZE / MB
							? {
									id: "3000000014",
									key: "mkb4",
									name: "支援者LvMax",
									emoji: ":mk_discochicken:",
									showBadgeNote: true,
							  }
							: {
									id: "3000000013",
									key: "mkb3",
									name: "支援者Lv3",
									emoji: ":mk_chuchuchicken:",
									showBadgeNote: true,
							  }
						: {
								id: "3000000012",
								key: "mkb2",
								name: "支援者Lv2",
								emoji: ":mk_yurayurachicken:",
								showBadgeNote: true,
						  }
					: {
							id: "3000000011",
							key: "mkb1",
							name: "支援者",
							emoji: ":mkb:",
							showBadgeNote: true,
					  }
				: undefined;

		const harborBadges =
			new Date(user.createdAt) < new Date("2023-04-05T00:00:00Z")
				? {
						id: "3000000001",
						key: "mkhb",
						name: "港から移住",
						emoji: ":mkbms:",
						showBadgeNote: false,
				  }
				: undefined;

		const badges = !user.host
			? [
					profile?.showDonateBadges ? donateBadges : undefined,
					harborBadges,
					rankBadges,
			  ].filter((x) => x !== undefined && (opts.detail || x.showBadgeNote))
			: rankBadges
			? [rankBadges]
			: undefined;
		let roles =
			badges?.map((x, i) => ({
				id: x.id,
				name: x.name,
				description: x.name,
				iconUrl: `${config.url}/emojis/${
					x.emoji.startsWith(":") ? x.emoji.replaceAll(":", "") : x.key
				}.webp`,
				isModerator: false,
				isAdministrator: false,
				color: "#f8bcba",
				displayOrder: badges?.length - 1 - i,
			})) ?? [];
		if (user.isAdmin) {
			roles.push({
				id: "3000000021",
				name: "Admin",
				description: "Admin",
				iconUrl: null,
				isModerator: false,
				isAdministrator: true,
				color: "#ff4b45",
				displayOrder: 200 + (badges?.length ?? 0),
			});
		}
		if (user.isModerator) {
			roles.push({
				id: "3000000022",
				name: "Moderator",
				description: "Moderator",
				iconUrl: null,
				isModerator: true,
				isAdministrator: false,
				color: "#1dc200",
				displayOrder: 100 + (badges?.length ?? 0),
			});
		}

		const truthy = opts.detail ? true : undefined;
		const falsy = opts.detail ? false : undefined;

		const isDeleted = user.isDeleted;

                const memo =
                        meId == null
                                ? null
                                : hints?.memo !== undefined
                                ? hints.memo ?? null
                                : await UserMemos.findOneBy({
                                                userId: meId,
                                                targetUserId: user.id,
                                  }).then((row) => row ?? null);

		const packed = {
			id: user.id,
			name: isDeleted ? "🗑" : memo?.customName ? memo.customName : user.name,
			username: user.username,
			host: user.host,
			avatarUrl: this.getAvatarUrlSync(user),
			avatarBlurhash: user.avatar?.blurhash || null,
			avatarColor: null, // 後方互換性のため
			isAdmin: user.isAdmin || falsy,
			isModerator: user.isModerator || falsy,
			isBot: user.isBot || falsy,
			isCat: user.isCat || falsy,
			speakAsCat: user.speakAsCat || falsy,
			notesCount: user.notesCount,
			instance: user.host
				? userInstanceCache
						.fetch(
							user.host,
							() => Instances.findOneBy({ host: user.host! }),
							(v) => v != null,
						)
						.then((instance) =>
							instance
								? {
										name: instance.name,
								  	host: instance.host,
										softwareName: instance.softwareName,
										softwareVersion: instance.softwareVersion,
										iconUrl: instance.iconUrl,
										faviconUrl: instance.faviconUrl,
										themeColor: instance.themeColor,
										maxReactionsPerAccount:
											instance.maxReactionsPerAccount ?? 1,
								  }
								: undefined,
						)
				: undefined,
			emojis: populateEmojis(user.emojis, user.host),
                        onlineStatus: await this.getOnlineStatus(
                                user,
                                meId,
                                relation ?? undefined,
                        ),
			patron: user.host
				? undefined
				: (user.driveCapacityOverrideMb ?? DEFAULT_DRIVE_SIZE / MB) >
				  DEFAULT_DRIVE_SIZE / MB,
			badgeRoles:
				user.host == null
					? roles.map((x) => ({
							name: x.name,
							iconUrl: x.iconUrl,
							displayOrder: x.displayOrder,
					  }))
					: undefined,
			originalName: memo?.customName
				? isDeleted
					? "🗑"
					: user.name
				: undefined,
			fixedName: user.fixedName,
			memo: memo?.memo ? memo.memo : undefined,
			...(opts.detail
				? {
						url: profile!.url,
						uri: user.uri,
						movedToUri: user.movedToUri
							? await this.userFromURI(user.movedToUri)
							: null,
						alsoKnownAs: user.alsoKnownAs,
						createdAt: user.createdAt.toISOString(),
						updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
						lastFetchedAt: user.lastFetchedAt
							? user.lastFetchedAt.toISOString()
							: null,
						...(me
							? {
									isExplorable: user.isExplorable,
							  }
							: {}),
						bannerUrl: user.banner
							? DriveFiles.getPublicUrl(user.banner, false)
							: null,
						bannerBlurhash: user.banner?.blurhash || null,
						bannerColor: null, // 後方互換性のため
						isLocked: isMe
							? user.isLocked
							: !user.isSilentLocked && user.isLocked,
						isSilenced: user.isSilenced || falsy,
						isSuspended: user.isSuspended || falsy,
						description: isDeleted ? "" : profile!.description,
						location: isDeleted ? "" : profile!.location,
                                                birthday: isDeleted ? "" : profile!.birthday,
                                                lang: isDeleted ? "" : profile!.lang,
                                                fields: isDeleted ? "" : profile!.fields,
                                                verifiedLinks: isDeleted ? [] : profile!.verifiedLinks,
                                                followersCount: followersCount ?? "N/A",
						followingCount: followingCount ?? "N/A",
						hasClips:
							"hasClips" in (hints ?? {})
								? hints!.hasClips!
								: !user.host
									? Clips.count({
											where: { userId: user.id, isPublic: true },
											take: 1,
									  }).then((count) => count > 0)
									: false,
						hasPages:
							"hasPages" in (hints ?? {})
								? hints!.hasPages!
								: !user.host
									? profile!.pinnedPageId
										? true
										: Pages.count({
												where: { userId: user.id, isPublic: true },
												take: 1,
										  }).then((count) => count > 0)
									: false,
						hasGallerys:
							"hasGallerys" in (hints ?? {})
								? hints!.hasGallerys!
								: !user.host
									? GalleryPosts.count({
											where: { userId: user.id },
											take: 1,
									  }).then((count) => count > 0)
									: false,
						hasCategories:
							"hasCategories" in (hints ?? {})
								? hints!.hasCategories!
								: !user.host
									? EmojiCustomCategories.count({
											where: { userId: user.id },
											take: 1,
										}).then((count) => count > 0)
									: false,
						pinnedNoteIds: pins.map((pin) => pin.noteId),
						pinnedNotes:
							"pinnedNotesPacked" in (hints ?? {})
								? hints!.pinnedNotesPacked ?? []
								: Notes.packMany(
										pins.map((pin) => pin.note!),
										me,
										{
											detail: true,
										},
									),
						pinnedPageId: profile!.pinnedPageId,
						pinnedPage:
							"pinnedPagePacked" in (hints ?? {})
								? (hints!.pinnedPagePacked ?? null)
								: profile!.pinnedPageId
									? Pages.pack(profile!.pinnedPageId, me)
									: null,
						publicReactions: profile!.publicReactions,
						ffVisibility: profile!.ffVisibility,
						isRemoteLocked:
							(isMe
								? user.isRemoteLocked
								: !user.isSilentLocked && user.isRemoteLocked) || falsy,
						twoFactorEnabled: profile!.twoFactorEnabled,
						usePasswordLessLogin: profile!.usePasswordLessLogin,
						showDonateBadges: profile!.showDonateBadges,
					securityKeys: UserSecurityKeys.countBy({
						userId: user.id,
					}).then((result) => result >= 1),
						badges: badges?.length !== 0 ? badges : undefined,
						roles,
						achievements: [],
						loggedInDays: 0,
						driveCapacityOverrideMb: user.driveCapacityOverrideMb,
						policies: {
							gtlAvailable: true,
							ltlAvailable: true,
							canPublicNote: true,
							canCreateContent: true,
							canUpdateContent: true,
							canDeleteContent: true,
							canInvite: true,
							inviteLimit: 128,
							inviteLimitCycle: 0,
							inviteExpirationTime: 0,
							canManageCustomEmojis: false,
							canSearchNotes: true,
							canHideAds: true,
							alwaysMarkNsfw: false,
							driveCapacityMb: 5192,
							pinLimit: 30,
							antennaLimit: 128,
							wordMuteLimit: 1024,
							webhookLimit: 128,
							clipLimit: 128,
							noteEachClipsLimit: 1024,
							userListLimit: 128,
							userEachUserListsLimit: 1024,
							rateLimitFactor: 128,
						},
				  }
				: {}),

			...(opts.detail && isMe
				? {
						avatarId: user.avatarId,
						bannerId: user.bannerId,
						followedMessage: profile!.followedMessage,
						injectFeaturedNote: profile!.injectFeaturedNote,
						receiveAnnouncementEmail: profile!.receiveAnnouncementEmail,
						alwaysMarkNsfw: profile!.alwaysMarkNsfw,
						autoSensitive: profile!.autoSensitive,
						carefulBot: profile!.carefulBot,
						autoAcceptFollowed: profile!.autoAcceptFollowed,
						noCrawle: profile!.noCrawle,
						preventAiLearning: profile!.preventAiLearning,
						isRemoteExplorable: user.isRemoteExplorable,
						isDeleted: user.isDeleted,
						hideOnlineStatus: user.hideOnlineStatus,
						hasUnreadSpecifiedNotes: meDetailedVolatile!.hasUnreadSpecifiedNotes,
						hasUnreadMentions: meDetailedVolatile!.hasUnreadMentions,
						hasUnreadAnnouncement: meDetailedVolatile!.hasUnreadAnnouncement,
						hasUnreadAntenna: meDetailedVolatile!.hasUnreadAntenna,
						hasUnreadChannel: meDetailedVolatile!.hasUnreadChannel,
						hasUnreadMessagingMessage:
							meDetailedVolatile!.hasUnreadMessagingMessage,
						hasUnreadNotification: meDetailedVolatile!.hasUnreadNotification,
						hasPendingReceivedFollowRequest:
							meDetailedVolatile!.hasPendingReceivedFollowRequest,
						integrations: profile!.integrations,
						mutedWords: profile!.mutedWords,
						rejectMuteReaction: profile!.rejectMuteReaction,
						reactionMutedWords: profile!.reactionMutedWords,
						mutedInstances: profile!.mutedInstances,
						mutingNotificationTypes: profile!.mutingNotificationTypes,
						emailNotificationTypes: profile!.emailNotificationTypes,
						showTimelineReplies: user.showTimelineReplies || falsy,
						blockPostPublic: user.blockPostPublic || falsy,
						blockPostHome: user.blockPostHome || falsy,
						blockPostNotLocal: user.blockPostNotLocal || falsy,
						blockPostNotLocalPublic: user.blockPostNotLocalPublic || falsy,
						localShowRenote: user.localShowRenote ?? truthy,
						remoteShowRenote: user.remoteShowRenote || falsy,
						showSelfRenoteToHome: user.showSelfRenoteToHome ?? truthy,
						lastActiveDate: user.lastActiveDate
							? user.lastActiveDate.toISOString()
							: null,
						canInvite: user.canInvite || falsy,
						isPublicLikeList: user.isPublicLikeList ?? truthy,
						disableNyaise: user.disableNyaise || falsy,
				  }
				: {}),

			...(opts.includeSecrets
				? {
						email: profile!.email,
						emailVerified: profile!.emailVerified,
					securityKeysList: UserSecurityKeys.find({
						where: {
							userId: user.id,
						},
						select: {
							id: true,
							name: true,
							lastUsed: true,
						},
					}),
						inviteUserId: user.inviteUserId,
						isSilentLocked: user.isSilentLocked || falsy,
						canInvite: user.canInvite || falsy,
						isMiniSilenced: user.isMiniSilenced || falsy,
				  }
				: {}),

                        ...(relation
                                ? {
                                                isFollowing: relation.isFollowing,
                                                isFollowed: relation.isFollowed,
                                                hasPendingFollowRequestFromYou:
                                                        relation.hasPendingFollowRequestFromYou,
						hasPendingFollowRequestToYou: relation.hasPendingFollowRequestToYou,
						isBlocking: relation.isBlocking,
						isBlocked: relation.isBlocked,
						isMuted: relation.isMuted,
						isRenoteMuted: relation.isRenoteMuted,
						isFollowBlocking: relation.isFollowBlocking,
						isInviter: relation.isInviter ? true : undefined,
						followedMessage: relation.isFollowing && profile ? profile.followedMessage : undefined,
				  }
				: {}),
			...(
				meId && !relation && (opts.detail || opts.relation)
				? {
					isRenoteMuted: RenoteMutings.count({
				where: {
					muterId: meId,
					muteeId: user.id,
				},
				take: 1,
			}).then((n) => n > 0),
				} : {}
			)
		} as Promiseable<Packed<"User">> as Promiseable<
			IsMeAndIsUserDetailed<ExpectsMe, D>
		>;

		return await awaitAll(packed);
	},

        async packMany<D extends boolean = false>(
                users: (User["id"] | User)[],
                me?: { id: User["id"] } | null | undefined,
                options?: {
                        detail?: D;
                        relation?: D;
                        includeSecrets?: boolean;
                },
        ): Promise<IsUserDetailed<D>[]> {
                const opts = Object.assign(
                        {
                                detail: false,
                                relation: false,
                                includeSecrets: false,
                        },
                        options,
                );

                const meId = me?.id ?? null;
                const ids = users
                        .map((u) => (typeof u === "object" ? u.id : u))
                        .filter((id): id is User["id"] => id != null);
                const uniqueIds = Array.from(new Set(ids));

                const targetUsers = users.map((u) =>
                        typeof u === "object" ? (u as Pick<User, "id" | "inviteUserId">) : undefined,
                );

                const relationsMap =
                        meId && uniqueIds.length > 0 && (opts.detail || opts.relation)
                                ? await this.getRelationsBulk(meId, uniqueIds, targetUsers)
                                : null;

                const memoMap =
                        meId && uniqueIds.length > 0
                                ? new Map<
                                          User["id"],
                                          Awaited<ReturnType<typeof UserMemos.findOneBy>>
                                  >(
                                          (
                                                  await UserMemos.findBy({
                                                          userId: meId,
                                                          targetUserId: In(uniqueIds),
                                                  })
                                          ).map((row) => [row.targetUserId, row]),
                                  )
                                : null;

                // 一括取得: User, UserProfile, pins, has*, pinnedNotes, pinnedPage
                let userMap: Map<User["id"], User> | null = null;
                let profileMap: Map<User["id"], UserProfile> | null = null;
                let pinsByUserId: Map<User["id"], (UserNotePining & { note: Note })[]> | null = null;
                let hasClipsSet: Set<User["id"]> | null = null;
                let hasPagesSet: Set<User["id"]> | null = null;
                let hasGallerysSet: Set<User["id"]> | null = null;
                let hasCategoriesSet: Set<User["id"]> | null = null;
                let pinnedNotesPackedMap: Map<User["id"], Packed<"Note">[]> | null = null;
                let pinnedPagePackedMap: Map<User["id"], Packed<"Page">> | null = null;

                if (uniqueIds.length > 0) {
                        const [usersBatch, profilesBatch] = await Promise.all([
                                this.find({
                                        where: { id: In(uniqueIds) },
                                        relations: { avatar: true, banner: true },
                                }).then((list) => new Map(list.map((u) => [u.id, u]))),
                                UserProfiles.findBy({ userId: In(uniqueIds) }).then((list) =>
                                        new Map(list.map((p) => [p.userId, p])),
                                ),
                        ]);
                        userMap = usersBatch;
                        profileMap = profilesBatch;

                        if (opts.detail) {
                                const allPins = await UserNotePinings
                                        .createQueryBuilder("pin")
                                        .innerJoinAndSelect("pin.note", "note")
                                        .where("pin.userId IN (:...ids)", { ids: uniqueIds })
                                        .orderBy("pin.createdAt", "DESC")
                                        .addOrderBy("pin.id", "DESC")
                                        .getMany();

                                pinsByUserId = new Map();
                                for (const pin of allPins as (UserNotePining & { note: Note })[]) {
                                        const arr = pinsByUserId.get(pin.userId) ?? [];
                                        arr.push(pin);
                                        pinsByUserId.set(pin.userId, arr);
                                }

                                const [clipsRows, pagesRows, galleryRows, categoriesRows] =
                                        await Promise.all([
                                                Clips.find({
                                                        where: { userId: In(uniqueIds), isPublic: true },
                                                        select: ["userId"],
                                                }),
                                                Pages.find({
                                                        where: { userId: In(uniqueIds), isPublic: true },
                                                        select: ["userId"],
                                                }),
                                                GalleryPosts.find({
                                                        where: { userId: In(uniqueIds) },
                                                        select: ["userId"],
                                                }),
                                                EmojiCustomCategories.find({
                                                        where: { userId: In(uniqueIds) },
                                                        select: ["userId"],
                                                }),
                                        ]);
                                hasClipsSet = new Set(clipsRows.map((r) => r.userId));
                                hasPagesSet = new Set(pagesRows.map((r) => r.userId));
                                hasGallerysSet = new Set(galleryRows.map((r) => r.userId));
                                hasCategoriesSet = new Set(categoriesRows.map((r) => r.userId));

                                const allPinNotes = allPins
                                        .map((pin) => (pin as UserNotePining & { note: Note }).note)
                                        .filter((n): n is Note => n != null);
                                const uniquePinNotes = Array.from(
                                        new Map(allPinNotes.map((n) => [n.id, n])).values(),
                                );
                                const pinnedNotesPacked =
                                        uniquePinNotes.length > 0
                                                ? await Notes.packMany(uniquePinNotes, me, {
                                                        detail: true,
                                                  })
                                                : [];
                                const noteIdToPacked = new Map(
                                        pinnedNotesPacked.map((p) => [p.id, p]),
                                );
                                pinnedNotesPackedMap = new Map();
                                for (const [uid, pins] of pinsByUserId) {
                                        const packed = pins
                                                .map((pin) => noteIdToPacked.get(pin.noteId))
                                                .filter((p): p is Packed<"Note"> => p != null);
                                        pinnedNotesPackedMap.set(uid, packed);
                                }

                                const pinnedPageIds = [...profileMap.values()]
                                        .map((p) => p.pinnedPageId)
                                        .filter((id): id is NonNullable<typeof id> => id != null);
                                const uniquePinnedPageIds = [...new Set(pinnedPageIds)];
                                if (uniquePinnedPageIds.length > 0) {
                                        const pages = await Pages.find({
                                                where: { id: In(uniquePinnedPageIds) },
                                        });
                                        const packedPages = await Promise.all(
                                                pages.map((p) => Pages.pack(p, me)),
                                        );
                                        const pageIdToPacked = new Map(
                                                pages.map((p, i) => [p.id, packedPages[i]]),
                                        );
                                        pinnedPagePackedMap = new Map();
                                        for (const [uid, profile] of profileMap) {
                                                if (profile.pinnedPageId) {
                                                        const packed = pageIdToPacked.get(
                                                                profile.pinnedPageId,
                                                        );
                                                        if (packed) pinnedPagePackedMap.set(uid, packed);
                                                }
                                        }
                                }
                        }
                }

                return Promise.all(
                        users.map((u) => {
                                const id = typeof u === "object" ? u.id : u;

                                let hints: {
                                        relation?: UserRelation | null;
                                        memo?: Awaited<ReturnType<typeof UserMemos.findOneBy>> | null;
                                        user?: User | null;
                                        profile?: UserProfile | null;
                                        pins?: (UserNotePining & { note: Note })[] | null;
                                        hasClips?: boolean;
                                        hasPages?: boolean;
                                        hasGallerys?: boolean;
                                        hasCategories?: boolean;
                                        pinnedNotesPacked?: Packed<"Note">[];
                                        pinnedPagePacked?: Packed<"Page"> | null;
                                } | undefined;

                                const needHints =
                                        relationsMap ||
                                        memoMap ||
                                        userMap ||
                                        profileMap ||
                                        pinsByUserId != null ||
                                        hasClipsSet != null ||
                                        pinnedNotesPackedMap != null ||
                                        pinnedPagePackedMap != null;

                                if (needHints) {
                                        hints = {};
                                        if (relationsMap) hints.relation = relationsMap.get(id) ?? null;
                                        if (memoMap)
                                                hints.memo = memoMap.has(id)
                                                        ? memoMap.get(id) ?? null
                                                        : null;
                                        if (userMap?.has(id)) hints.user = userMap.get(id)!;
                                        if (profileMap?.has(id)) hints.profile = profileMap.get(id)!;
                                        // リモートユーザーはプロファイル行が無いことがあるため、pack 内で findOneByOrFail を避ける
                                        else if (userMap?.get(id)?.host) hints.profile = null;
                                        if (pinsByUserId != null)
                                                hints.pins = pinsByUserId.get(id) ?? [];
                                        if (hasClipsSet != null)
                                                hints.hasClips = hasClipsSet.has(id);
                                        if (hasPagesSet != null)
                                                hints.hasPages =
                                                        profileMap?.get(id)?.pinnedPageId != null ||
                                                        hasPagesSet.has(id);
                                        if (hasGallerysSet != null)
                                                hints.hasGallerys = hasGallerysSet.has(id);
                                        if (hasCategoriesSet != null)
                                                hints.hasCategories = hasCategoriesSet.has(id);
                                        if (pinnedNotesPackedMap?.has(id))
                                                hints.pinnedNotesPacked =
                                                        pinnedNotesPackedMap.get(id) ?? [];
                                        if (pinnedPagePackedMap?.has(id))
                                                hints.pinnedPagePacked =
                                                        pinnedPagePackedMap.get(id) ?? null;
                                }

                                return this.pack(u, me, options, hints);
                        }),
                );
        },

	isLocalUser,
	isRemoteUser,
});
