/**
 * @packageDocumentation
 *
 * 2FA（TOTP）を無効化する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/2fa/unregister`（POST `/api/i/2fa/unregister` で呼び出し）
 * - 認証必須。パスワード確認後、TOTP 2FA を解除する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { UserProfiles, Users } from "@/models/index.js";
import { comparePassword } from "@/misc/password.js";

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		password: { type: "string" },
	},
	required: ["password"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	// パスワードを照合する
	const same = await comparePassword(ps.password, profile.password!);

	if (!same) {
		throw new Error("incorrect password");
	}

	await UserProfiles.update(user.id, {
		twoFactorSecret: null,
		twoFactorEnabled: false,
	});

	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);
});
