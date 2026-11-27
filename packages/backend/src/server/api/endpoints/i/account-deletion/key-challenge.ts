/**
 * @packageDocumentation
 *
 * アカウント削除の予約の本人確認に使う、セキュリティキーのチャレンジを発行する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/account-deletion/key-challenge`
 * - 返したチャレンジにブラウザがキーで答え、その答えを `i/account-deletion/request` の `credential` に入れる。
 * - チャレンジは 5 分で無効になり、1 回しか使えない（ログインと同じ。server/api/common/security-key-assertion.ts）。
 *
 * @internal
 */
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { issueSecurityKeyChallenge } from "../../../common/security-key-assertion.js";

export const meta = {
	requireCredential: true,

	secure: true,

	limit: {
		duration: 60 * 60 * 1000,
		max: 30,
	},

	description:
		"アカウント削除の予約の本人確認に使う、セキュリティキーのチャレンジを発行する。",

	errors: {
		noSecurityKeys: {
			message: "セキュリティキーが登録されていません。",
			code: "NO_SECURITY_KEYS",
			id: "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const issued = await issueSecurityKeyChallenge(user.id);
	if (issued == null) throw new ApiError(meta.errors.noSecurityKeys);
	return issued;
});
