/**
 * @packageDocumentation
 *
 * セキュリティキー（WebAuthn）で本人確認するための、チャレンジの発行と答えの確認。
 *
 * @remarks
 * - ログイン（server/api/private/signin.ts）の中に直接書かれていた処理を切り出したもの。
 *   アカウント削除の予約（i/account-deletion/request）でも、ログインと同じ確認をするために使う。
 * - 決まりはログインと同じ:
 *   - チャレンジは 1 回しか使えない（確かめるときに消す）。発行から 5 分で無効
 *   - キーの使用回数（signCount）が戻っていたら通さない（キーの複製を防ぐ）
 * - 失敗したときは、ログインが返していたのと同じエラー ID と HTTP ステータスを返す。
 *
 * @internal
 */
import { randomBytes } from "node:crypto";
import {
	AttestationChallenges,
	PasskeyLoginChallenges,
	UserSecurityKeys,
} from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import type { UserSecurityKey } from "@/models/entities/user-security-key.js";
import { genId } from "@/misc/gen-id.js";
import { hash, verifyLogin } from "../2fa.js";

/** チャレンジが有効な時間（ミリ秒） */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * セキュリティキーの答え（ブラウザの `navigator.credentials.get` の結果を 16 進にしたもの）。
 *
 * @internal
 */
export type SecurityKeyAssertion = {
	credentialId: string;
	authenticatorData: string;
	clientDataJSON: string;
	signature: string;
	challengeId: string;
	userHandle?: unknown;
};

/**
 * 確かめられなかった理由（ログインが返していたものと同じ）。
 *
 * @internal
 */
export type SecurityKeyAssertionFailure = { status: number; id: string };

/**
 * 送られてきた値が、セキュリティキーの答えの形をしているか。
 *
 * @param body - リクエストの中身
 * @returns 答えの形なら true
 * @internal
 */
export function isSecurityKeyAssertion(body: unknown): body is SecurityKeyAssertion {
	const b = body as Record<string, unknown> | null;
	return (
		b != null &&
		typeof b.credentialId === "string" &&
		typeof b.authenticatorData === "string" &&
		typeof b.clientDataJSON === "string" &&
		typeof b.signature === "string" &&
		typeof b.challengeId === "string"
	);
}

/**
 * 答えに使われたキーを探す。
 *
 * @param assertion - セキュリティキーの答え
 * @returns 見つかったキー。登録されていなければ null
 * @internal
 */
export async function findSecurityKeyForAssertion(
	assertion: SecurityKeyAssertion,
): Promise<UserSecurityKey | null> {
	const keyId = Buffer.from(
		assertion.credentialId.replace(/-/g, "+").replace(/_/g, "/"),
		"base64",
	).toString("hex");
	return await UserSecurityKeys.findOneBy({ id: keyId });
}

/**
 * セキュリティキーの答えを確かめる。確かめられたら、キーの使用回数と最後に使った日時を更新する。
 *
 * @param securityKey - {@link findSecurityKeyForAssertion} で見つけたキー
 * @param assertion - セキュリティキーの答え
 * @param userId - 確かめたいユーザー（キーの持ち主）
 * @returns 確かめられたら null。だめなら理由
 *
 * @remarks
 * チャレンジは、そのユーザー向けに発行したもの（{@link issueSecurityKeyChallenge}）か、
 * ユーザー名を入れないログイン（パスキー）向けのもののどちらでもよい（ログインと同じ）。
 *
 * @internal
 */
export async function verifySecurityKeyAssertion(
	securityKey: UserSecurityKey,
	assertion: SecurityKeyAssertion,
	userId: User["id"],
): Promise<SecurityKeyAssertionFailure | null> {
	if (securityKey.userId !== userId) {
		return { status: 403, id: "93b86c4b-72f9-40eb-9815-798928603d1e" };
	}

	if (assertion.userHandle != null) {
		if (typeof assertion.userHandle !== "string") {
			return { status: 400, id: "93b86c4b-72f9-40eb-9815-798928603d1e" };
		}
		const userHandle = Buffer.from(assertion.userHandle, "hex").toString("utf-8");
		if (userHandle !== userId) {
			return { status: 403, id: "93b86c4b-72f9-40eb-9815-798928603d1e" };
		}
	}

	const clientDataJSON = Buffer.from(assertion.clientDataJSON, "hex");
	const clientData = JSON.parse(clientDataJSON.toString("utf-8"));
	const challengeHash = hash(Buffer.from(clientData.challenge, "utf-8")).toString("hex");

	const userChallenge = await AttestationChallenges.findOneBy({
		userId,
		id: assertion.challengeId,
		registrationChallenge: false,
		challenge: challengeHash,
	});
	const globalChallenge = await PasskeyLoginChallenges.findOneBy({
		id: assertion.challengeId,
		challenge: challengeHash,
	});

	if (!userChallenge && !globalChallenge) {
		return { status: 403, id: "2715a88a-2125-4013-932f-aa6fe72792da" };
	}

	// チャレンジは 1 回しか使えない
	await AttestationChallenges.delete({ userId, id: assertion.challengeId });
	await PasskeyLoginChallenges.delete({ id: assertion.challengeId });

	const createdAt = userChallenge?.createdAt ?? globalChallenge?.createdAt;
	if (!createdAt || Date.now() - createdAt.getTime() >= CHALLENGE_TTL_MS) {
		return { status: 403, id: "2715a88a-2125-4013-932f-aa6fe72792da" };
	}

	const verificationResult = verifyLogin({
		publicKey: Buffer.from(securityKey.publicKey, "hex"),
		authenticatorData: Buffer.from(assertion.authenticatorData, "hex"),
		clientDataJSON,
		clientData,
		signature: Buffer.from(assertion.signature, "hex"),
		challenge: userChallenge?.challenge ?? globalChallenge!.challenge,
		requireUserVerification: false,
	});

	if (!verificationResult.isValid) {
		return { status: 403, id: "93b86c4b-72f9-40eb-9815-798928603d1e" };
	}

	// 使用回数が戻っていたら、キーが複製された疑いがあるので通さない
	if (securityKey.signCount > 0 && verificationResult.signCount <= securityKey.signCount) {
		return { status: 403, id: "93b86c4b-72f9-40eb-9815-798928603d1e" };
	}

	securityKey.lastUsed = new Date();
	securityKey.signCount = verificationResult.signCount;
	await UserSecurityKeys.save(securityKey);

	return null;
}

/**
 * そのユーザーのセキュリティキー向けのチャレンジを発行する。
 *
 * @param userId - ユーザー ID
 * @returns ブラウザに渡すチャレンジと、使えるキーの ID。キーが 1 つも無ければ null
 * @internal
 */
export async function issueSecurityKeyChallenge(userId: User["id"]): Promise<{
	challenge: string;
	challengeId: string;
	securityKeys: { id: string }[];
} | null> {
	const keys = await UserSecurityKeys.findBy({ userId });
	if (keys.length === 0) return null;

	const challenge = randomBytes(32)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	const challengeId = genId();

	await AttestationChallenges.insert({
		userId,
		id: challengeId,
		challenge: hash(Buffer.from(challenge, "utf-8")).toString("hex"),
		createdAt: new Date(),
		registrationChallenge: false,
	});

	return {
		challenge,
		challengeId,
		securityKeys: keys.map((key) => ({ id: key.id })),
	};
}
