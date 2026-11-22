/**
 * @packageDocumentation
 *
 * TOTP（2 段階認証のワンタイムコード）を「1 回だけ使える」形で検証する。
 *
 * @remarks
 * GHSA-2m5x-5mp6-6vpq 対策: 以前は `speakeasy.totp.verify` だけで判定しており、
 * 一度使ったコードを有効期間内なら何度でも使えた。RFC 6238 5.2 節は、検証に成功したコードの
 * 2 回目の使用を拒否することを求めている。パスワードとコードを同時に盗まれた場合に、
 * 本人のサインイン直後にもう一度使われるのを防ぐ。
 *
 * 使用済みの記録は Redis に `2fa:used:<userId>:<時間枠の番号>` として置く
 * （ioredis の keyPrefix により実体は `mkkey.net:2fa:used:...`）。
 *
 * @internal
 */
import * as speakeasy from "speakeasy";
import { redisClient } from "@/db/redis.js";

/**
 * TOTP の 1 つの時間枠の長さ（秒）。speakeasy の既定値と同じ。
 * @internal
 */
const TIME_STEP_SEC = 30;

/**
 * 前後に何枠まで許すか。
 *
 * @remarks
 * 端末の時計のずれを吸収するため、従来（サインイン）と同じ前後 2 枠（±60 秒）を保つ。
 * 変えると、時計がずれた端末でサインインできなくなる人が出る。
 *
 * @internal
 */
const VALIDATION_WINDOW = 2;

/**
 * TOTP のコードを検証し、成功したら同じ時間枠のコードを以後使えないようにする。
 *
 * @remarks
 * - 時間枠ごとに記録するので、同じ枠のコードは 2 回目以降すべて失敗する。
 * - 記録の有効期限は、許している枠の範囲すべて（前後 {@link VALIDATION_WINDOW} 枠）が過ぎるまで。
 *   それより後は、そのコード自体が時間切れで通らない。
 * - NB: Redis に書けないときは例外が投げられ、サインインは失敗する（使い回しを許す方に倒さない）。
 *
 * @param userId - コードの持ち主のユーザー ID
 * @param secret - base32 の TOTP 秘密鍵
 * @param token - 利用者が入力したコード
 * @returns 正しく、かつ未使用のコードなら `true`
 * @throws Redis への書き込みに失敗した場合
 * @internal
 */
export async function verifyTotpOnce(
	userId: string,
	secret: string,
	token: unknown,
): Promise<boolean> {
	if (typeof token !== "string") return false;
	const normalizedToken = token.trim();
	if (normalizedToken === "") return false;

	// 判定と時間枠の番号の計算で同じ時刻を使う（枠の境目でずれないように）
	const nowSec = Math.floor(Date.now() / 1000);
	const result = speakeasy.totp.verifyDelta({
		secret,
		encoding: "base32",
		token: normalizedToken,
		window: VALIDATION_WINDOW,
		step: TIME_STEP_SEC,
		time: nowSec,
	});
	if (result == null) return false;

	// 一致した時間枠の番号。現在の枠から delta だけずれた枠のコードだった
	const step = Math.floor(nowSec / TIME_STEP_SEC) + result.delta;
	const ttlSec = TIME_STEP_SEC * (VALIDATION_WINDOW * 2 + 1);

	// NX: まだ記録が無いときだけ書ける。書けなければ使用済み
	const setResult = await redisClient.set(
		`2fa:used:${userId}:${step}`,
		"1",
		"EX",
		ttlSec,
		"NX",
	);
	return setResult === "OK";
}
