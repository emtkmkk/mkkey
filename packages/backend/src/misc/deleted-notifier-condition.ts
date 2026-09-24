/**
 * @packageDocumentation
 *
 * 削除済みアカウントからの通知を、通知一覧などから除外するための条件を作る。
 *
 * @remarks
 * - 通知の行そのものは消さず、取得時のクエリで隠す（アカウント削除ジョブを重くしないため）。
 * - アカウント削除に関する通知（{@link DELETED_NOTIFIER_EXEMPT_TYPES}）は、
 *   通知元が削除済みでも表示する。削除を知らせること自体が目的のため。
 * - 通知一覧 API と未読まとめメールで条件がずれないよう、この関数を共通で使う。
 *
 * @internal
 */
import { Brackets } from "typeorm";
import type { notificationTypes } from "@/types.js";

/**
 * 通知元が削除済みでも表示する通知の種類。
 *
 * @remarks
 * - `followedAccountWasDeleted`: フォロー先のアカウント削除通知。
 * - `userWasUnfollowed`: 削除ジョブが、削除ユーザーのフォロー先（フォロー返しなし）へ送る。
 *   NB: 削除前に通常のフォロー解除で届いたものも区別できないため一緒に残る。
 *
 * @internal
 */
export const DELETED_NOTIFIER_EXEMPT_TYPES: readonly (typeof notificationTypes)[number][] =
	["followedAccountWasDeleted", "userWasUnfollowed"];

/**
 * 削除済みの通知元からの通知を除外する条件を返す。
 *
 * @remarks
 * クエリ側で `notification.notifier` を `notifierAlias` として leftJoin していること。
 * 通知元が無い通知（app 通知など）はすべて通す。
 *
 * @param notifierAlias - notifier を join したときの別名
 * @returns `andWhere` に渡せる条件
 * @internal
 */
export function createDeletedNotifierCondition(notifierAlias = "notifier") {
	return new Brackets((qb) => {
		qb.where(`${notifierAlias}.id IS NULL`)
			.orWhere(`${notifierAlias}.isDeleted = FALSE`)
			.orWhere("notification.type IN (:...deletedNotifierExemptTypes)", {
				deletedNotifierExemptTypes: DELETED_NOTIFIER_EXEMPT_TYPES,
			});
	});
}
