/**
 * @packageDocumentation
 *
 * 認証ユーザーのパスワードを変更する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/change-password`（POST `/api/i/change-password` で呼び出し）
 * - 認証必須。現在のパスワードと新しいパスワードでパスワードを更新する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { UserProfiles } from "@/models/index.js";
import { hashPassword, comparePassword } from "@/misc/password.js";

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		currentPassword: { type: "string" },
		newPassword: { type: "string", minLength: 1 },
	},
	required: ["currentPassword", "newPassword"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	// パスワードを照合する
	const same = await comparePassword(ps.currentPassword, profile.password!);

	if (!same) {
		throw new Error("incorrect password");
	}

	// パスワードのハッシュを生成する
	const hash = await hashPassword(ps.newPassword);

	await UserProfiles.update(user.id, {
		password: hash,
	});
});
