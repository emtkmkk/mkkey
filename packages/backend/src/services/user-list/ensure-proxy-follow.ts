import Logger from "../logger.js";
import type { User } from "@/models/entities/user.js";
import { Users, Followings, FollowRequests, UserListJoinings } from "@/models/index.js";
import { fetchProxyAccount } from "@/misc/fetch-proxy-account.js";
import createFollowing from "../following/create.js";

const logger = new Logger("user-list/proxy-follow");

type Target = User | User["id"];

async function resolveUser(target: Target): Promise<User | null> {
        if (typeof target === "string") {
                return await Users.findOneBy({ id: target });
        }
        return target;
}

export async function ensureProxyFollowsListedUser(targetInput: Target): Promise<void> {
        const user = await resolveUser(targetInput);
        if (!user) {
                logger.warn("対象ユーザーの取得に失敗したため、proxyフォロー判定をスキップします。");
                return;
        }

        if (!Users.isRemoteUser(user)) {
                return;
        }

        const proxy = await fetchProxyAccount();
        if (!proxy) {
                return;
        }

        const [listCount, localFollowersCount, proxyFollowing, proxyRequest] = await Promise.all([
                UserListJoinings.countBy({ userId: user.id }),
                Followings.createQueryBuilder("following")
                        .where("following.followeeId = :userId", { userId: user.id })
                        .andWhere("following.followerHost IS NULL")
                        .getCount(),
                Followings.findOneBy({ followerId: proxy.id, followeeId: user.id }),
                FollowRequests.findOneBy({ followerId: proxy.id, followeeId: user.id }),
        ]);

        if (listCount === 0) {
                return;
        }

        if (localFollowersCount > 0) {
                return;
        }

        if (proxyFollowing || proxyRequest) {
                return;
        }

        try {
                await createFollowing(proxy, user);
                logger.info(
                        `proxyアカウントでリスト対象のユーザーをフォローしました: ${user.username}` +
                                `${user.host ? `@${user.host}` : ""} (${user.id})`,
                );
        } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(
                        `proxyアカウントでのフォローに失敗しました: ${user.username}` +
                                `${user.host ? `@${user.host}` : ""} (${user.id}) - ${message}`,
                );
        }
}
