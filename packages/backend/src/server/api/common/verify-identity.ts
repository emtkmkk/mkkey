/**
 * @packageDocumentation
 *
 * 大事な操作（アカウント削除の予約など）の前に、ログインと同じ本人確認をする。
 *
 * @remarks
 * ログインの方法ごとに、確かめるものを変える（ログインと同じ決まり）。
 *
 * | ログインの方法 | 確かめるもの |
 * | --- | --- |
 * | パスワード | パスワード |
 * | パスワード＋2 段階認証 | パスワードと、ワンタイムコードかセキュリティキーのどちらか |
 * | パスワードを使わずセキュリティキーだけ（パスワードレス） | セキュリティキー |
 *
 * - ワンタイムコードは使い回せない確認（{@link verifyTotpOnce}）を使う。
 * - セキュリティキーは、事前に {@link issueSecurityKeyChallenge} で発行したチャレンジへの答えを確かめる。
 *
 * @internal
 */
import { UserProfiles } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { comparePassword } from "@/misc/password.js";
import { verifyTotpOnce } from "@/misc/verify-totp-once.js";
import {
	findSecurityKeyForAssertion,
	isSecurityKeyAssertion,
	verifySecurityKeyAssertion,
} from "./security-key-assertion.js";

/**
 * 本人確認で受け取る値（API のパラメータの一部）。
 *
 * @internal
 */
export type IdentityProof = {
	password?: string;
	/** ワンタイムコード */
	token?: string;
	/** セキュリティキーの答え（security-key-assertion.ts の SecurityKeyAssertion の形） */
	credential?: unknown;
};

/**
 * 本人確認の結果。
 *
 * - `ok`: 確かめられた
 * - `incorrectPassword`: パスワードが違う
 * - `secondFactorRequired`: 2 段階目（ワンタイムコードかセキュリティキー）が無い・違う
 * - `securityKeyRequired`: パスワードレスの人で、セキュリティキーの答えが無い・違う
 *
 * @internal
 */
export type IdentityVerificationResult =
	| "ok"
	| "incorrectPassword"
	| "secondFactorRequired"
	| "securityKeyRequired";

/**
 * API の `paramDef.properties` に入れる、本人確認のパラメータ。
 *
 * @internal
 */
export const identityProofParams = {
	password: { type: "string", description: "パスワード（パスワードレスの人は不要）。" },
	token: {
		type: "string",
		nullable: true,
		description: "2 段階認証のワンタイムコード。",
	},
	credential: {
		type: "object",
		nullable: true,
		description:
			"セキュリティキーの答え（credentialId・authenticatorData・clientDataJSON・signature・challengeId）。",
	},
} as const;

/**
 * ログインと同じ本人確認をする。
 *
 * @param user - 確かめたいユーザー（ログイン中の本人）
 * @param proof - 送られてきた本人確認の値
 * @returns 確かめた結果
 * @internal
 */
export async function verifyIdentity(
	user: ILocalUser,
	proof: IdentityProof,
): Promise<IdentityVerificationResult> {
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	const verifyKey = async (): Promise<boolean> => {
		if (!isSecurityKeyAssertion(proof.credential)) return false;
		const securityKey = await findSecurityKeyForAssertion(proof.credential);
		if (securityKey == null) return false;
		return (
			(await verifySecurityKeyAssertion(securityKey, proof.credential, user.id)) ==
			null
		);
	};

	// パスワードレスの人は、セキュリティキーで確かめる
	if (profile.usePasswordLessLogin) {
		return (await verifyKey()) ? "ok" : "securityKeyRequired";
	}

	if (
		typeof proof.password !== "string" ||
		profile.password == null ||
		!(await comparePassword(proof.password, profile.password))
	) {
		return "incorrectPassword";
	}

	if (!profile.twoFactorEnabled) return "ok";

	// 2 段階認証: ワンタイムコードかセキュリティキーのどちらか
	if (proof.token != null) {
		const verified =
			profile.twoFactorSecret != null &&
			(await verifyTotpOnce(user.id, profile.twoFactorSecret, proof.token));
		return verified ? "ok" : "secondFactorRequired";
	}
	return (await verifyKey()) ? "ok" : "secondFactorRequired";
}
