/**
 * @packageDocumentation
 *
 * ActivityPub の Reject(Follow) アクティビティを処理する。自インスタンスから送ったフォローリクエストの拒否を受け付ける。
 *
 * @remarks
 * - **役割**: inbox で Reject(Follow) を受信した際に、フォローリクエストを拒否状態にする。
 *
 * @see {@link services/following/reject} フォロー拒否
 * @internal
 */
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { remoteReject } from "@/services/following/reject.js";
import type { IFollow } from "../../type.js";
import DbResolver from "../../db-resolver.js";
import { relayRejected } from "@/services/relay.js";
import { Users } from "@/models/index.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IFollow,
): Promise<string> => {
	// ※ activity は自インスタンスから送ったフォローリクエストなので、activity.actor は存在するローカルユーザーである必要がある

	const dbResolver = new DbResolver();
	const follower = await dbResolver.getUserFromApId(activity.actor);

	if (follower == null) {
		return "skip: follower not found";
	}

	if (!Users.isLocalUser(follower)) {
		return "skip: follower is not a local user";
	}

	// リレー
	const match = activity.id?.match(/follow-relay\/(\w+)/);
	if (match) {
		return await relayRejected(match[1]);
	}

	await remoteReject(actor, follower);
	return "ok";
};
