import { In } from "typeorm";
import { db } from "@/db/postgre.js";
import { UserMemos, Users } from "../index.js";
import { Following } from "@/models/entities/following.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { Packed } from "@/misc/schema.js";
import type { User } from "@/models/entities/user.js";
import type { UserRelation } from "./user.js";

type LocalFollowerFollowing = Following & {
	followerHost: null;
	followerInbox: null;
	followerSharedInbox: null;
};

type RemoteFollowerFollowing = Following & {
	followerHost: string;
	followerInbox: string;
	followerSharedInbox: string;
};

type LocalFolloweeFollowing = Following & {
	followeeHost: null;
	followeeInbox: null;
	followeeSharedInbox: null;
};

type RemoteFolloweeFollowing = Following & {
	followeeHost: string;
	followeeInbox: string;
	followeeSharedInbox: string;
};

export const FollowingRepository = db.getRepository(Following).extend({
	isLocalFollower(following: Following): following is LocalFollowerFollowing {
		return following.followerHost == null;
	},

	isRemoteFollower(following: Following): following is RemoteFollowerFollowing {
		return following.followerHost != null;
	},

	isLocalFollowee(following: Following): following is LocalFolloweeFollowing {
		return following.followeeHost == null;
	},

	isRemoteFollowee(following: Following): following is RemoteFolloweeFollowing {
		return following.followeeHost != null;
	},

        async pack(
                src: Following["id"] | Following,
                me?: { id: User["id"] } | null | undefined,
                opts?: {
                        populateFollowee?: boolean;
                        populateFollower?: boolean;
                },
                hints?: {
                        followee?: {
                                relation?: UserRelation | null;
                                memo?: Awaited<ReturnType<typeof UserMemos.findOneBy>> | null;
                        };
                        follower?: {
                                relation?: UserRelation | null;
                                memo?: Awaited<ReturnType<typeof UserMemos.findOneBy>> | null;
                        };
                },
        ): Promise<Packed<"Following">> {
                const following =
                        typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

                if (opts == null) opts = {};

		return await awaitAll({
			id: following.id,
			createdAt: following.createdAt.toISOString(),
                        followeeId: following.followeeId,
                        followerId: following.followerId,
                        followee: opts.populateFollowee
                                ? Users.pack(following.followee || following.followeeId, me, {
                                                detail: true,
                                  }, hints?.followee)
                                : undefined,
                        follower: opts.populateFollower
                                ? Users.pack(following.follower || following.followerId, me, {
                                                detail: true,
                                  }, hints?.follower)
                                : undefined,
                });
        },

        async packMany(
                followings: any[],
                me?: { id: User["id"] } | null | undefined,
                opts?: {
                        populateFollowee?: boolean;
                        populateFollower?: boolean;
                },
        ) {
                if (opts == null) opts = {};

                const populateFollowee = Boolean(opts.populateFollowee);
                const populateFollower = Boolean(opts.populateFollower);

                const extractUserId = (
                        user: User | null | undefined,
                        fallbackId: User["id"] | undefined,
                ): User["id"] | undefined => {
                        if (user && typeof user === "object") {
                                return user.id;
                        }

                        return fallbackId;
                };

                const extractFolloweeId = (following: Following): User["id"] | undefined =>
                        extractUserId(following.followee ?? undefined, following.followeeId);

                const extractFollowerId = (following: Following): User["id"] | undefined =>
                        extractUserId(following.follower ?? undefined, following.followerId);

                const ids = new Set<User["id"]>();

                if (populateFollowee || populateFollower) {
                        for (const following of followings) {
                                if (typeof following !== "object" || following == null) continue;

                                const entity = following as Following;

                                if (populateFollowee) {
                                        const followeeId = extractFolloweeId(entity);
                                        if (followeeId) ids.add(followeeId);
                                }

                                if (populateFollower) {
                                        const followerId = extractFollowerId(entity);
                                        if (followerId) ids.add(followerId);
                                }
                        }
                }

                const meId = me?.id ?? null;

                let relationsMap: Map<User["id"], UserRelation> | null = null;
                let memoMap:
                        | Map<
                                  User["id"],
                                  Awaited<ReturnType<typeof UserMemos.findOneBy>>
                          >
                        | null = null;

                if (meId && ids.size > 0) {
                        const targetIds = Array.from(ids);

                        relationsMap = await Users.getRelationsBulk(meId, targetIds);

                        memoMap = new Map(
                                (
                                        await UserMemos.findBy({
                                                userId: meId,
                                                targetUserId: In(targetIds),
                                        })
                                ).map((row) => [row.targetUserId, row]),
                        );
                }

                const createUserHints = (
                        id: User["id"] | null | undefined,
                ):
                        | {
                                  relation?: UserRelation | null;
                                  memo?: Awaited<ReturnType<typeof UserMemos.findOneBy>> | null;
                          }
                        | undefined => {
                        if (!id) return undefined;

                        let hints:
                                | {
                                          relation?: UserRelation | null;
                                          memo?: Awaited<ReturnType<typeof UserMemos.findOneBy>> | null;
                                  }
                                | undefined;

                        if (relationsMap) {
                                hints = hints ?? {};
                                hints.relation = relationsMap.get(id) ?? null;
                        }

                        if (memoMap) {
                                hints = hints ?? {};
                                hints.memo = memoMap.has(id)
                                        ? memoMap.get(id) ?? null
                                        : null;
                        }

                        return hints;
                };

                return Promise.all(
                        followings.map((following) => {
                                if (typeof following !== "object" || following == null) {
                                        return this.pack(following, me, opts);
                                }

                                const entity = following as Following;

                                const followeeId = populateFollowee
                                        ? extractFolloweeId(entity)
                                        : undefined;
                                const followerId = populateFollower
                                        ? extractFollowerId(entity)
                                        : undefined;

                                const followeeHints = populateFollowee
                                        ? createUserHints(followeeId)
                                        : undefined;
                                const followerHints = populateFollower
                                        ? createUserHints(followerId)
                                        : undefined;

                                let hints:
                                        | {
                                                  followee?: {
                                                          relation?: UserRelation | null;
                                                          memo?: Awaited<ReturnType<
                                                                  typeof UserMemos.findOneBy
                                                          >> | null;
                                                  };
                                                  follower?: {
                                                          relation?: UserRelation | null;
                                                          memo?: Awaited<ReturnType<
                                                                  typeof UserMemos.findOneBy
                                                          >> | null;
                                                  };
                                          }
                                        | undefined;

                                if (followeeHints || followerHints) {
                                        hints = {};
                                        if (followeeHints) hints.followee = followeeHints;
                                        if (followerHints) hints.follower = followerHints;
                                }

                                return this.pack(entity, me, opts, hints);
                        }),
                );
        },
});
