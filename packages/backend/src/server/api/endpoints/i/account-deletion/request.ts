/**
 * @packageDocumentation
 *
 * 自分のアカウントの削除を予約する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/account-deletion/request`（`i/delete-account` も同じ動き）
 * - ログインと同じ本人確認をする（server/api/common/verify-identity.ts）。
 *   パスワード、2 段階認証ならワンタイムコードかセキュリティキー、パスワードレスならセキュリティキー。
 * - 予約すると、日本時間 2:00 の定期ジョブが予定日時に削除する。予定日時の決め方は
 *   misc/account-deletion-schedule.ts（20:00 より前なら翌日 2:00、以降なら翌々日 2:00）。
 * - 予約中は、予約の取り消しのほかは何もできなくなる。
 *
 * @see {@link services/account-deletion-schedule} 予約
 * @internal
 */
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import {
	ACCOUNT_DELETION_ERRORS,
	requestAccountDeletion,
} from "@/services/account-deletion-schedule.js";
import {
	identityProofParams,
	verifyIdentity,
} from "../../../common/verify-identity.js";

export const meta = {
	requireCredential: true,

	secure: true,

	// パスワードの総当たりを防ぐ
	limit: {
		duration: 60 * 60 * 1000,
		max: 10,
	},

	description:
		"自分のアカウントの削除を予約する。ログインと同じ本人確認が要る。予約中は、予約の取り消しのほかは何もできなくなる。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			scheduledAt: { type: "string", optional: false, nullable: false, format: "date-time" },
		},
	},

	errors: {
		incorrectPassword: {
			message: "パスワードが違います。",
			code: "INCORRECT_PASSWORD",
			id: "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
		},
		secondFactorRequired: {
			message: "2 段階認証のコードかセキュリティキーが必要です。",
			code: "SECOND_FACTOR_REQUIRED",
			id: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b",
		},
		securityKeyRequired: {
			message: "セキュリティキーでの確認が必要です。",
			code: "SECURITY_KEY_REQUIRED",
			id: "8a9b0c1d-2e3f-4a4b-8c5d-6e7f8a9b0c1d",
		},
		alreadyScheduled: {
			message: "すでにアカウントの削除を予約しています。",
			code: "ALREADY_SCHEDULED",
			id: "9f3c1a2e-4b5d-4e6f-8a7b-1c2d3e4f5a6b",
		},
		tooSoonAfterCancel: {
			message: "予約を解除したばかりのため、まだ削除を申請できません。",
			code: "TOO_SOON_AFTER_CANCEL",
			id: "2a4b6c8d-0e1f-4a3b-9c5d-7e8f9a0b1c2d",
		},
		notAllowed: {
			message: "このアカウントは削除を予約できません。",
			code: "NOT_ALLOWED",
			id: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		...identityProofParams,
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const verification = await verifyIdentity(user, {
		password: ps.password,
		token: ps.token ?? undefined,
		credential: ps.credential ?? undefined,
	});
	if (verification !== "ok") throw new ApiError(meta.errors[verification]);

	try {
		const scheduledAt = await requestAccountDeletion(user);
		return { scheduledAt: scheduledAt.toISOString() };
	} catch (err) {
		if (err instanceof IdentifiableError) {
			if (err.id === ACCOUNT_DELETION_ERRORS.alreadyScheduled)
				throw new ApiError(meta.errors.alreadyScheduled);
			if (err.id === ACCOUNT_DELETION_ERRORS.tooSoonAfterCancel)
				throw new ApiError(meta.errors.tooSoonAfterCancel);
			if (err.id === ACCOUNT_DELETION_ERRORS.notAllowed)
				throw new ApiError(meta.errors.notAllowed);
		}
		throw err;
	}
});
