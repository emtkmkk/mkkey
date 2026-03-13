/**
 * @packageDocumentation
 *
 * パスワードリセットを要求する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `reset-password`（POST `/api/reset-password` で呼び出し）
 * - 認証不要。メールアドレスを送るとリセット用トークン付きメールを送信する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishMainStream } from "@/services/stream.js";
import { Users, UserProfiles, PasswordResetRequests } from "@/models/index.js";
import define from "../define.js";
import { ApiError } from "../error.js";
import { hashPassword } from "@/misc/password.js";

export const meta = {
	tags: ["reset password"],

	requireCredential: false,

	description: "Complete the password reset that was previously requested.",

	errors: {},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		token: { type: "string" },
		password: { type: "string" },
	},
	required: ["token", "password"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const req = await PasswordResetRequests.findOneByOrFail({
		token: ps.token,
	});

	// 発行してから30分以上経過していたら無効
	if (Date.now() - req.createdAt.getTime() > 1000 * 60 * 30) {
		throw new Error(); // TODO
	}

	// パスワードのハッシュを生成する
	const hash = await hashPassword(ps.password);

	await UserProfiles.update(req.userId, {
		password: hash,
	});

	PasswordResetRequests.delete(req.id);
});
