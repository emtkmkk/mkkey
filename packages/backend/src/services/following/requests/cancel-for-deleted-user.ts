/**
 * @packageDocumentation
 *
 * 削除されるアカウントが関わるフォロー申請（送った分・受けた分）をまとめて取り消す。
 *
 * @remarks
 * - 相手のアカウントが消えるので、承認・拒否しても意味がない。
 * - ローカルのアカウント削除では、Delete を送る**前**に呼ぶ（{@link services/delete-account}）。
 *   相手のサーバーが「削除済みのユーザーからの Undo / Reject は無視する」作りでも、
 *   Delete より先に届けば普通の取り消しとして処理されるため。
 *   NB: 配送の列に先に並べるだけなので、Delete より先に届くことは保証されない。
 * - 削除ジョブ（{@link queue/processors/db/delete-account}）でも念のため呼ぶ。
 *   リモートのアカウント削除はここだけを通る。2 回目は申請が無いので何もしない。
 *
 * @internal
 */
import type { User } from "@/models/entities/user.js";
import { FollowRequests, Users } from "@/models/index.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderFollow from "@/remote/activitypub/renderer/follow.js";
import renderReject from "@/remote/activitypub/renderer/reject.js";
import { deliver } from "@/queue/index.js";
import Logger from "@/services/logger.js";
import { invalidateUserShowRelationCache } from "@/services/invalidate-user-show-relation-cache.js";
import cancelFollowRequest from "./cancel.js";

/**
 * このモジュールのログ出力先。
 *
 * @internal
 */
const logger = new Logger("cancel-follow-requests-of-deleted-user");

/**
 * 削除されるユーザーが関わるフォロー申請（送った分・受けた分）を取り消す。
 *
 * @param user - 削除されるユーザー
 * @returns 取り消した申請の件数
 *
 * @remarks
 * - `receiveFollowRequest` 通知は `followRequestId` に CASCADE で紐づくため、
 *   申請を消すとその通知も DB 側で一緒に消える。
 * - **送った申請**は、通常の申請取り消し（`cancel.ts`）を通す。
 *   相手がリモートなら Undo(Follow) を送り、相手がローカルなら未処理の申請数の表示を更新させる。
 * - **受けた申請**は、通常の拒否（`rejectFollowRequest`）を通さない。申請した側に
 *   「申請が拒否された」通知と再確認の記録が作られ、実際の事情（相手が消えた）と合わないため。
 *   削除されるユーザーがローカルで申請者がリモートのときだけ Reject を送る。
 * - 1 件の失敗で残りを止めないよう、申請ごとに例外を受け止めてログに残す。
 *
 * @internal
 */
export async function cancelFollowRequestsOfDeletedUser(
	user: User,
): Promise<number> {
	let count = 0;

	// #region 削除されるユーザーが送った申請
	const sent = await FollowRequests.find({
		where: { followerId: user.id },
		select: ["id", "followeeId"],
	});
	for (const request of sent) {
		try {
			const followee = await Users.findOneBy({ id: request.followeeId });
			if (followee == null) {
				// 相手の行が無いなら通知・配送の宛先も無いので、申請だけ消す
				await FollowRequests.delete(request.id);
			} else {
				await cancelFollowRequest(followee, user);
			}
			count += 1;
		} catch (err) {
			logger.warn(`Failed to cancel follow request ${request.id}: ${err}`);
		}
	}
	// #endregion

	// #region 削除されるユーザーが受けた申請
	const received = await FollowRequests.find({
		where: { followeeId: user.id },
		select: ["id", "followerId", "requestId"],
	});
	for (const request of received) {
		try {
			const follower = await Users.findOneBy({ id: request.followerId });
			if (
				follower != null &&
				Users.isLocalUser(user) &&
				Users.isRemoteUser(follower)
			) {
				// 申請してきたリモートのサーバーに、申請が通らなかったことを伝える
				const content = renderActivity(
					renderReject(
						renderFollow(follower, user, request.requestId ?? undefined),
						user,
					),
				);
				deliver(user, content, follower.inbox);
			}
			await FollowRequests.delete(request.id);
			// 申請した側のプロフィール画面に「申請中」が残らないようにする
			await invalidateUserShowRelationCache(user.id, request.followerId);
			count += 1;
		} catch (err) {
			logger.warn(`Failed to remove follow request ${request.id}: ${err}`);
		}
	}
	// #endregion

	return count;
}
