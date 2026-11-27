/**
 * @packageDocumentation
 *
 * 自分のアカウント削除の予約を取り消す API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/account-deletion/cancel`
 * - 予約中でも呼べる（server/api/call.ts の許可リスト）。予約中の専用画面の「予約を解除」が使う。
 * - 取り消したら、次の 20:00 を過ぎるまで再び予約できない（返り値の `reRequestableAt`）。
 *   申請と取り消しを繰り返して、管理者への通知がうるさくならないようにするため。
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

export const meta = {
	requireCredential: true,

	secure: true,

	description:
		"自分のアカウント削除の予約を取り消す。取り消したあとは、次の 20:00（日本時間）を過ぎるまで再び予約できない。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			reRequestableAt: { type: "string", optional: false, nullable: false, format: "date-time" },
		},
	},

	errors: {
		notScheduled: {
			message: "アカウントの削除を予約していません。",
			code: "NOT_SCHEDULED",
			id: "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const reRequestableAt = await cancelAccountDeletion(user.id);
		return { reRequestableAt: reRequestableAt.toISOString() };
	} catch (err) {
		if (err instanceof IdentifiableError && err.id === ACCOUNT_DELETION_ERRORS.notScheduled) {
			throw new ApiError(meta.errors.notScheduled);
		}
		throw err;
	}
});
