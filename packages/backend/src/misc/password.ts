/**
 * @packageDocumentation
 *
 * パスワードのハッシュ化・検証。argon2 を主とし、旧 bcrypt ハッシュとの互換を保つ。
 *
 * @remarks
 * - **役割**: サインアップ・パスワード変更等でハッシュ化と compare を提供する。
 *
 * @see {@link api/common/signup} サインアップ
 * @internal
 */
import bcrypt from "bcryptjs";
import * as argon2 from "argon2";

/**
 * パスワードをハッシュ化する。
 * @internal
 */
export async function hashPassword(password: string): Promise<string> {
	return argon2.hash(password);
}

/**
 * 平文パスワードとハッシュを照合する。
 * @internal
 */
export async function comparePassword(
	password: string,
	hash: string,
): Promise<boolean> {
	if (isOldAlgorithm(hash)) return bcrypt.compare(password, hash);

	return argon2.verify(hash, password);
}

/**
 * 旧アルゴリズム（bcrypt）のハッシュかどうかを判定する。$2a$ または $2b$ で始まる。
 * @internal
 */
export function isOldAlgorithm(hash: string): boolean {
	return hash.startsWith("$2");
}
