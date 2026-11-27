/**
 * @packageDocumentation
 *
 * セキュリティキー（WebAuthn）で本人確認するときの、ブラウザ側の処理。
 *
 * @remarks
 * - サーバーが発行したチャレンジにキーで答え、サーバーに送る形（16 進）にする。
 * - ログイン（components/MkSignin.vue）と、アカウント削除の予約（pages/settings/delete-account.vue）で使う。
 * - サーバー側で確かめる処理は backend の server/api/common/security-key-assertion.ts。
 *
 * @internal
 */
import { byteify, hexify } from "@/scripts/2fa";

/**
 * サーバーが発行したチャレンジ（`signin` や `i/account-deletion/key-challenge` が返すもの）。
 *
 * @internal
 */
export type SecurityKeyChallenge = {
	challenge: string;
	challengeId: string;
	securityKeys: { id: string }[];
};

/**
 * サーバーに送る、セキュリティキーの答え。
 *
 * @internal
 */
export type SecurityKeyAssertionPayload = {
	signature: string;
	authenticatorData: string;
	clientDataJSON: string;
	credentialId: string;
	challengeId: string;
};

/**
 * チャレンジにセキュリティキーで答える。
 *
 * @param challengeData - サーバーが発行したチャレンジ
 * @returns サーバーに送る答え
 * @throws キーの操作を取り消したとき・時間切れのとき（ブラウザの例外のまま）
 *
 * @example
 * ```ts
 * const challengeData = await os.api("i/account-deletion/key-challenge", {});
 * const assertion = await getSecurityKeyAssertion(challengeData);
 * ```
 *
 * @internal
 */
export async function getSecurityKeyAssertion(
	challengeData: SecurityKeyChallenge,
): Promise<SecurityKeyAssertionPayload> {
	const credential = (await navigator.credentials.get({
		publicKey: {
			challenge: byteify(challengeData.challenge, "base64"),
			allowCredentials: challengeData.securityKeys.map((key) => ({
				id: byteify(key.id, "hex"),
				type: "public-key",
				transports: ["usb", "nfc", "ble", "internal"],
			})),
			timeout: 60 * 1000,
			userVerification: "preferred",
		},
	})) as PublicKeyCredential;
	const response = credential.response as AuthenticatorAssertionResponse;

	return {
		signature: hexify(response.signature),
		authenticatorData: hexify(response.authenticatorData),
		clientDataJSON: hexify(response.clientDataJSON),
		credentialId: credential.id,
		challengeId: challengeData.challengeId,
	};
}
