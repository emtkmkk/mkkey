/**
 * 署名検証済みの通常フォローと、許可したローカル相手のリレー購読を処理する。
 * @remarks NOTE: Follow(Public) だけを購読処理へ渡し、通常のフォローの挙動は維持する。
 * @packageDocumentation
 * @internal
 */
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import follow from "@/services/following/create.js";
import type { IFollow } from "../type.js";
import DbResolver from "../db-resolver.js";
import { localRelayFollow } from "@/services/local-relay.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IFollow,
): Promise<string> => {
	const relayResult = await localRelayFollow(actor, activity);
	if (relayResult !== null) return relayResult;
	const dbResolver = new DbResolver();
	const followee = await dbResolver.getUserFromApId(activity.object);

	if (followee == null) {
		return "skip: followee not found";
	}

	if (followee.host != null) {
		return "skip: user you are trying to follow is not a local user";
	}

	await follow(actor, followee, activity.id);
	return "ok";
};
