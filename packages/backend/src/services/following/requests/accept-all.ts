/**
 * @packageDocumentation
 *
 * フォローリクエスト一括承諾処理を行うサービス。
 *
 * @remarks
 * - **役割**: フォローリクエスト一括承諾 API から呼ばれ、未承諾のリクエストを一括で承諾する。
 *
 * @see {@link server/api/endpoints/following/requests/accept} フォロー承諾
 * @internal
 */

import accept from "./accept.js";
import type { User } from "@/models/entities/user.js";
import { FollowRequests, Users } from "@/models/index.js";
import { In } from "typeorm";

/**
 * Approve all follow requests for the specified user
 * @param user User.
 */
export default async function (user: {
	id: User["id"];
	host: User["host"];
	uri: User["host"];
	inbox: User["inbox"];
	sharedInbox: User["sharedInbox"];
}) {
	const requests = await FollowRequests.findBy({
		followeeId: user.id,
	});

        const followerIds = Array.from(new Set(requests.map((request) => request.followerId)));

        if (followerIds.length === 0) return;

        const followers = await Users.findBy({ id: In(followerIds) });
        const followerMap = new Map(followers.map((follower) => [follower.id, follower]));

        for (const request of requests) {
                const follower =
                        followerMap.get(request.followerId) ??
                        (await Users.findOneByOrFail({ id: request.followerId }));

                accept(user, follower);
        }
}
