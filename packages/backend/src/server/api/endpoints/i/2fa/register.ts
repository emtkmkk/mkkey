/**
 * @packageDocumentation
 *
 * 2FA（TOTP）の登録を開始する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/2fa/register`（POST `/api/i/2fa/register` で呼び出し）
 * - 認証必須。パスワード確認後、TOTP 用のシークレットと QR コード用データを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import * as speakeasy from "speakeasy";
import * as QRCode from "qrcode";
import config from "@/config/index.js";
import { UserProfiles } from "@/models/index.js";
import define from "../../../define.js";
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

	// ユーザーの秘密鍵を生成する
	const secret = speakeasy.generateSecret({
		length: 32,
	});

	await UserProfiles.update(user.id, {
		twoFactorTempSecret: secret.base32,
	});

	// 認証器URLのデータURLを取得する
	const url = speakeasy.otpauthURL({
		secret: secret.base32,
		encoding: "base32",
		label: user.username,
		issuer: config.host,
	});
	const dataUrl = await QRCode.toDataURL(url);

	return {
		qr: dataUrl,
		url,
		secret: secret.base32,
		label: user.username,
		issuer: config.host,
	};
});
