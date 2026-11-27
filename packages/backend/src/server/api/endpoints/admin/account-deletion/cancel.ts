/**
 * @packageDocumentation
 *
 * 管理者が、ユーザーのアカウント削除の予約を取り消す API エンドポイント。
 *
 * @remarks
 * - **API パス**: `admin/account-deletion/cancel`
 * - 管理者だけが使える。取り消しの決まりは本人が取り消すときと同じ
 *   （次の 20:00 を過ぎるまで再び予約できない。管理者全員に通知する）。
 * - すぐに削除したいときは、今までどおり `admin/delete-account` を使う。
 *
 * @see {@link services/account-deletion-schedule} 取り消し
 * @internal
 */
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import {
	ACCOUNT_DELETION_ERRORS,
	cancelAccountDeletion,
} from "@/services/account-deletion-schedule.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,

	description: "ユーザーのアカウント削除の予約を取り消す（管理者のみ）。",

	errors: {
		notScheduled: {
			message: "このユーザーはアカウントの削除を予約していません。",
			code: "NOT_SCHEDULED",
			id: "0d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f3a",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	try {
		await cancelAccountDeletion(ps.userId);
	} catch (err) {
		if (err instanceof IdentifiableError && err.id === ACCOUNT_DELETION_ERRORS.notScheduled) {
			throw new ApiError(meta.errors.notScheduled);
		}
		throw err;
	}

	insertModerationLog(me, "cancelAccountDeletion", { targetId: ps.userId });
});
