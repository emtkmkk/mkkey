/**
 * @packageDocumentation
 *
 * ActivityPub リクエストの署名検証。secure/private モード時の必須署名・ブロック判定を行う。
 *
 * @remarks
 * - **役割**: inbox 受信時に署名の有無・妥当性を判定し、ブロックインスタンスを拒否する。
 *
 * @see {@link queue/processors/inbox} Inbox ジョブ
 * @internal
 */
import { URL } from "url";
import httpSignature, { IParsedSignature } from "@peertube/http-signature";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { toPuny } from "@/misc/convert-host.js";
import DbResolver from "@/remote/activitypub/db-resolver.js";
import { getApId } from "@/remote/activitypub/type.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";
import type { IncomingMessage } from "http";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { UserPublickey } from "@/models/entities/user-publickey.js";
import { verify } from "node:crypto";
import { toSingle } from "@/prelude/array.js";
import { createHash } from "node:crypto";

/**
 * リクエストに署名が含まれるかを判定し、missing / optional / invalid / supplied / unneeded を返す。
 * @internal
 */
export async function hasSignature(req: IncomingMessage): Promise<string> {
	const meta = await fetchMeta();
	const required = meta.secureMode || meta.privateMode;

	try {
		httpSignature.parseRequest(req, { headers: [] });
	} catch (e) {
		if (e instanceof Error && e.name === "MissingHeaderError") {
			return required ? "missing" : "optional";
		}
		return "invalid";
	}
	return required ? "supplied" : "unneeded";
}

export async function checkFetch(req: IncomingMessage): Promise<number> {
	const meta = await fetchMeta();
	if (meta.secureMode || meta.privateMode) {
		if (req.headers.host !== config.host) return 400;

		let signature;

		try {
			signature = httpSignature.parseRequest(req, {
				headers: ["(request-target)", "host", "date"],
			});
		} catch (e) {
			return 401;
		}

		const keyId = new URL(signature.keyId);
		const host = toPuny(keyId.hostname);

		if (await shouldBlockInstance(host, meta)) {
			return 403;
		}

		if (
			meta.privateMode &&
			host !== config.host &&
			!meta.allowedHosts.includes(host)
		) {
			return 403;
		}

		const keyIdLower = signature.keyId.toLowerCase();
		if (keyIdLower.startsWith("acct:")) {
			// Old keyId is no longer supported.
			return 401;
		}

		const dbResolver = new DbResolver();

		// HTTP-Signature keyIdを元にDBから取得
		let authUser = await dbResolver.getAuthUserFromKeyId(signature.keyId);

		// keyIdでわからなければ、resolveしてみる
		if (authUser == null) {
			try {
				keyId.hash = "";
				authUser = await dbResolver.getAuthUserFromApId(
					getApId(keyId.toString()),
				);
			} catch (e) {
				// できなければ駄目
				return 403;
			}
		}

		// publicKey がなくても終了
		if (authUser?.key == null) {
			return 403;
		}

		// もう一回チェック
		if (authUser.user.host !== host) {
			return 403;
		}

		// HTTP-Signatureの検証
		let httpSignatureValidated = httpSignature.verifySignature(
			signature,
			authUser.key.keyPem,
		);

		// If signature validation failed, try refetching the actor
		if (!httpSignatureValidated) {
			authUser.key = await dbResolver.refetchPublicKeyForApId(authUser.user);

			if (authUser.key == null) {
				return 403;
			}

			httpSignatureValidated = httpSignature.verifySignature(
				signature,
				authUser.key.keyPem,
			);
		}

		if (!httpSignatureValidated) {
			return 403;
		}

		return verifySignature(signature, authUser.key) ? 200 : 401;
	}
	return 200;
}

/**
 * リクエストの HTTP 署名から送信ユーザーを特定し、署名を暗号検証して返す。
 *
 * @remarks
 * GHSA-grwc-c762-gcvp 対策:
 * 以前はこの関数が `httpSignature.parseRequest(req, { headers: [] })` で
 * 署名ヘッダを「パースするだけ」で暗号検証を行っておらず、攻撃者が他者の
 * keyId を名乗る偽の署名ヘッダを付けるだけで、フォロワー限定ノート等の
 * アクセス制御をすり抜けられた。
 * `checkFetch` と同様に、署名対象ヘッダ `(request-target)`/`host`/`date` を
 * 要求した上で `verifySignature` で実際に検証し、検証に失敗した場合は
 * `null`（＝認証不可）を返すようにした。
 *
 * @param req - 受信した HTTP リクエスト
 * @returns 検証に成功した送信ユーザーと公開鍵。署名が無い/不正な場合は `null`。
 * @internal
 */
export async function getSignatureUser(req: IncomingMessage): Promise<{
	user: CacheableRemoteUser;
	key: UserPublickey | null;
} | null> {
	let signature: IParsedSignature;
	try {
		signature = httpSignature.parseRequest(req, {
			headers: ["(request-target)", "host", "date"],
		});
	} catch (e) {
		return null;
	}

	const keyId = new URL(signature.keyId);
	const dbResolver = new DbResolver();

	// Retrieve from DB by HTTP-Signature keyId
	let authUser = await dbResolver.getAuthUserFromKeyId(signature.keyId);

	// Resolve if failed to retrieve by keyId
	if (authUser == null) {
		try {
			keyId.hash = "";
			authUser = await dbResolver.getAuthUserFromApId(
				getApId(keyId.toString()),
			);
		} catch (e) {
			return null;
		}
	}

	// 公開鍵が取得できなければ署名を検証できないため拒否する
	if (authUser?.key == null) {
		return null;
	}

	// HTTP 署名の暗号検証。失敗時は公開鍵を再取得して再検証する（鍵ローテーション対策）
	let httpSignatureValidated = httpSignature.verifySignature(
		signature,
		authUser.key.keyPem,
	);
	if (!httpSignatureValidated) {
		authUser.key = await dbResolver.refetchPublicKeyForApId(authUser.user);
		if (authUser.key == null) {
			return null;
		}
		httpSignatureValidated = httpSignature.verifySignature(
			signature,
			authUser.key.keyPem,
		);
	}

	// node:crypto による二重検証も併用し、いずれか失敗すれば認証不可とする
	if (!httpSignatureValidated || !verifySignature(signature, authUser.key)) {
		return null;
	}

	return authUser;
}

export function verifySignature(
	sig: IParsedSignature,
	key: UserPublickey,
): boolean {
	if (!["hs2019", "rsa-sha256"].includes(sig.algorithm.toLowerCase()))
		return false;
	try {
		return verify(
			"rsa-sha256",
			Buffer.from(sig.signingString, "utf8"),
			key.keyPem,
			Buffer.from(sig.params.signature, "base64"),
		);
	} catch {
		// Algo not supported
		return false;
	}
}

export function verifyDigest(
	body: string,
	digest: string | string[] | undefined,
): boolean {
	digest = toSingle(digest);
	if (
		body == null ||
		digest == null ||
		!digest.toLowerCase().startsWith("sha-256=")
	)
		return false;

	return (
		createHash("sha256").update(body).digest("base64") === digest.substring(8)
	);
}
