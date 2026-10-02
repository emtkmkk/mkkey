/**
 * @packageDocumentation
 *
 * フォロー申請（承認待ち）の取り消し処理。
 *
 * @remarks
 * - フォロー先がリモートなら、ActivityPub の Undo(Follow) を送る。
 * - フォロー先が Bluesky ユーザーなら、自前 PDS に書いた follow を消すジョブを積む（{@link remote/atproto/records}）。
 *   相手側から見えると確かめられなかったときも、この取り消しを通る。
 *
 * @internal
 */
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderFollow from "@/remote/activitypub/renderer/follow.js";
import renderUndo from "@/remote/activitypub/renderer/undo.js";
import { deliver } from "@/queue/index.js";
import { publishMainStream } from "@/services/stream.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import type { User } from "@/models/entities/user.js";
import { ILocalUser } from "@/models/entities/user.js";
import { Users, FollowRequests } from "@/models/index.js";
import { invalidateUserShowRelationCache } from "../../invalidate-user-show-relation-cache.js";
import { isBlueskyUser } from "@/remote/atproto/display.js";
import { onBlueskyUnfollow } from "@/remote/atproto/records.js";

export default async function (
	followee: {
		id: User["id"];
		host: User["host"];
		uri: User["host"];
		inbox: User["inbox"];
	},
	follower: { id: User["id"]; host: User["host"]; uri: User["host"] },
) {
	if (Users.isRemoteUser(followee)) {
		const content = renderActivity(
			renderUndo(renderFollow(follower, followee), follower),
		);

		if (Users.isLocalUser(follower)) {
			// 本来このチェックは不要だけどTSに怒られるので
			deliver(follower, content, followee.inbox);
		}
	}

	const request = await FollowRequests.findOneBy({
		followeeId: followee.id,
		followerId: follower.id,
	});

	if (request == null) {
		throw new IdentifiableError(
			"17447091-ce07-46dd-b331-c1fd4f15b1e7",
			"request not found",
		);
	}

	await FollowRequests.delete({
		followeeId: followee.id,
		followerId: follower.id,
	});

	await invalidateUserShowRelationCache(followee.id, follower.id);

	// Bluesky ユーザーへの申請なら、書いた follow があれば消す（ActivityPub の Undo は宛先が無いので送られない）
	if (Users.isLocalUser(follower) && isBlueskyUser(followee)) {
		await onBlueskyUnfollow(follower.id, followee.id);
	}

	Users.pack(followee.id, followee, {
		detail: true,
	}).then((packed) => publishMainStream(followee.id, "meUpdated", packed));
}
