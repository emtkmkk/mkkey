/**
 * @packageDocumentation
 *
 * 再フォロー確認ダイアログの表示と承認後の API 呼び出し。
 *
 * @remarks
 * - Web UI のフォローボタン専用。API クライアントからの following/create では使わない。
 *
 * @internal
 */
import type * as Misskey from "calckey-js";
import * as os from "@/os";
import { i18n } from "@/i18n";

/** 再フォロー確認の判定に使うユーザー relation フィールド */
export type FollowReconfirmUser = Pick<
	Misskey.entities.UserDetailed,
	| "id"
	| "needsFollowReconfirm"
	| "followReconfirmReason"
	| "name"
	| "username"
>;

/**
 * 再フォロー確認が必要なら 7 秒待ちの確認ダイアログを出す。
 *
 * @param user - フォロー対象ユーザー
 * @returns 続行してよいなら true
 * @internal
 */
export async function confirmFollowReconfirmIfNeeded(
	user: FollowReconfirmUser,
): Promise<boolean> {
	if (user.needsFollowReconfirm !== true) {
		return true;
	}

	const text =
		user.followReconfirmReason === "wasForciblyUnfollowed"
			? i18n.t("followReconfirmAfterForciblyUnfollowed", {
					name: user.name || user.username,
				})
			: i18n.t("followReconfirmAfterRejected", {
					name: user.name || user.username,
				});

	const { canceled } = await os.confirm({
		type: "warning",
		text,
		wait: 7,
	});

	return !canceled;
}

/**
 * 再フォロー確認を承認したあと、サーバー側の follow_reconfirm レコードを削除する。
 *
 * @param userId - フォロー対象ユーザー ID
 * @returns 更新後の pack 結果（失敗時は null）
 * @internal
 */
export async function ackFollowReconfirmAfterFollow(
	userId: string,
): Promise<Misskey.entities.UserDetailed | null> {
	try {
		return await os.api("following/ack-reconfirm", { userId });
	} catch (err) {
		console.error(err);
		return null;
	}
}

/**
 * ローカルの再フォロー確認フラグをクリアする。
 *
 * @param user - 更新対象ユーザー
 * @internal
 */
export function clearFollowReconfirmFlags(user: FollowReconfirmUser): void {
	user.needsFollowReconfirm = false;
	user.followReconfirmReason = undefined;
}
