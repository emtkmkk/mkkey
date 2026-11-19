/**
 * 通常フォローとローカルリレー購読の解除を処理する。
 * @remarks NOTE: リレーの Undo は元の Follow ID に対応する購読だけを削除する。
 * @packageDocumentation
 * @internal
 */
import unfollow from "@/services/following/delete.js";
import cancelRequest from "@/services/following/requests/cancel.js";
import type { IFollow } from "../../type.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { FollowRequests, Followings } from "@/models/index.js";
import DbResolver from "../../db-resolver.js";
import { localRelayFollow } from "@/services/local-relay.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IFollow,
): Promise<string> => {
	const relayResult = await localRelayFollow(actor, activity, true);
	if (relayResult !== null) return relayResult;
	const dbResolver = new DbResolver();

	const followee = await dbResolver.getUserFromApId(activity.object);
	if (followee == null) {
		return "skip: followee not found";
	}

	if (followee.host != null) {
		return "skip: The user you are trying to unfollow is not a local user";
	}

	const req = await FollowRequests.findOneBy({
		followerId: actor.id,
		followeeId: followee.id,
	});

	const following = await Followings.findOneBy({
		followerId: actor.id,
		followeeId: followee.id,
	});

	if (req) {
		await cancelRequest(followee, actor);
		return "ok: follow request canceled";
	}

	if (following) {
		await unfollow(actor, followee);
		return "ok: unfollowed";
	}

	return "skip: Not requested or followed";
};
