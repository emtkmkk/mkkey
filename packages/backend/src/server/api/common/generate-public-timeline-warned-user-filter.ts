/**
 * @packageDocumentation
 *
 * 公開TL系で「警告ユーザの投稿」を閲覧者設定に応じてクエリ段階で除外するための条件。
 *
 * @remarks
 * - 閲覧者が `showWarnedUsersInPublicTimeline` を ON のときは何も付与しない。
 * - 未ログインは常に除外側（effective false）。
 * - ソーシャル（hybrid）では閲覧者が投稿者をフォローしているノートは除外しない。
 *
 * @internal
 */
import { Brackets } from "typeorm";
import type { SelectQueryBuilder } from "typeorm";
import { UserProfiles } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";

/**
 * `note.user` を `user` エイリアスで join 済みのクエリに警告投稿除外条件を付与する。
 *
 * @param query - ノート取得クエリビルダ
 * @param me - 閲覧者（未ログインは null）
 * @param options.socialFollowingException - true のときフォロー済み投稿者は警告でも通す
 */
export async function applyPublicTimelineWarnedUserFilter<
	T extends Record<string, unknown>,
>(
	query: SelectQueryBuilder<T>,
	me: { id: User["id"] } | null | undefined,
	options: { socialFollowingException: boolean },
): Promise<void> {
	let showWarned = false;
	if (me) {
		const profile = await UserProfiles.findOneBy({ userId: me.id });
		showWarned = profile?.showWarnedUsersInPublicTimeline === true;
	}
	if (showWarned) {
		return;
	}

	// 警告投稿の除外: 閲覧設定 OFF かつ（通常ユーザの投稿のみ OR 閲覧者がフォロー中の投稿者）
	query.andWhere(
		new Brackets((qb) => {
			qb.where('"user"."isModerationWarning" = false');
			if (options.socialFollowingException && me) {
				qb.orWhere(
					`EXISTS (SELECT 1 FROM "following" f WHERE f."followerId" = :warnTimelineMeId AND f."followeeId" = note."userId")`,
					{ warnTimelineMeId: me.id },
				);
			}
		}),
	);
}
