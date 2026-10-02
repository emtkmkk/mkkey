/**
 * @packageDocumentation
 *
 * DID:plc の操作（PLC operation）を組み立てて署名し、plc.directory に登録する。
 *
 * @remarks
 * - `@did-plc/lib` は使わない（古い依存を抱えていて、backend の TypeScript 4.9 で型が通らないため）。
 *   仕様は {@link https://web.plc.directory/spec/v0.1/did-plc | did:plc の仕様} を参照。
 * - 今作るのは「最初の操作（genesis）」だけ。mkkey の username は変えられないのでハンドルも変わらず、
 *   更新の操作は今のところ要らない。
 *   TODO: アカウント削除のときに DID を止める tombstone の操作を足す（`prev` に直前の操作の CID が要る）。
 * - 署名は決まった値になる（同じ鍵・同じ中身なら同じ署名）。そのため、登録に失敗しても、保存した鍵から
 *   同じ操作を作り直して再送できる。作り直した DID が保存済みのものと違えば、何かが変わっているので送らない。
 *   NB: 再送の前には {@link isPlcRegistered} で、実は登録済みでないかを確かめる。
 *
 * @see {@link ./identity.ts} 身元の発行
 * @internal
 */

import { Secp256k1Keypair, sha256 } from "@atproto/crypto";
import { cborEncode } from "@atproto/lex-cbor";
import { getResponse, StatusError } from "@/misc/fetch.js";
import config from "@/config/index.js";
import { getAtprotoConfig } from "./config.js";

// #region 型

/**
 * 署名前の PLC の操作。
 *
 * @remarks
 * キーの名前と中身は仕様どおり。順番は CBOR にするときにそろえられるので気にしなくてよい。
 *
 * @internal
 */
export type UnsignedPlcOperation = {
	type: "plc_operation";
	/** この DID を操作できる鍵（`did:key:...`） */
	rotationKeys: string[];
	/** レポジトリの署名を確かめる鍵 */
	verificationMethods: { atproto: string };
	/** ハンドル（`at://alice.bsky.mkkey.net`） */
	alsoKnownAs: string[];
	/** PDS の場所 */
	services: {
		atproto_pds: { type: "AtprotoPersonalDataServer"; endpoint: string };
	};
	/** 直前の操作の CID。最初の操作では null */
	prev: string | null;
};

/**
 * 署名済みの PLC の操作。
 *
 * @internal
 */
export type SignedPlcOperation = UnsignedPlcOperation & {
	/** 署名（base64url、パディング無し） */
	sig: string;
};

// #endregion

// #region 操作の組み立て

/**
 * 最初の操作（genesis）を組み立てて署名し、DID を計算する。
 *
 * @remarks
 * DID は「署名済みの操作を CBOR にして SHA-256 を取り、base32 にした先頭 24 文字」に `did:plc:` を付けたもの。
 *
 * @param args.signingKey - レポジトリの署名に使う鍵
 * @param args.rotationKey - この操作に署名する鍵（DID を操作できる鍵）
 * @param args.handle - ハンドル（例: `alice.bsky.mkkey.net`）
 * @returns 署名済みの操作と DID
 * @internal
 */
export async function createGenesisOperation(args: {
	signingKey: Secp256k1Keypair;
	rotationKey: Secp256k1Keypair;
	handle: string;
}): Promise<{ op: SignedPlcOperation; did: string }> {
	const { pdsHostname } = getAtprotoConfig();

	const unsigned: UnsignedPlcOperation = {
		type: "plc_operation",
		rotationKeys: [args.rotationKey.did()],
		verificationMethods: { atproto: args.signingKey.did() },
		alsoKnownAs: [`at://${args.handle}`],
		services: {
			atproto_pds: {
				type: "AtprotoPersonalDataServer",
				endpoint: `https://${pdsHostname}`,
			},
		},
		prev: null,
	};

	// 署名前の操作を CBOR にして、rotation 鍵で署名する
	const sig = await args.rotationKey.sign(cborEncode(unsigned));
	const op: SignedPlcOperation = {
		...unsigned,
		sig: Buffer.from(sig).toString("base64url"),
	};

	// 署名済みの操作から DID を計算する
	const hash = await sha256(cborEncode(op));
	const did = `did:plc:${base32Encode(hash).slice(0, 24)}`;

	return { op, did };
}

// #endregion

// #region 登録

/**
 * DID が plc.directory に登録済みかを確かめる。
 *
 * @remarks
 * 前回の登録が「送ったが応答を受け取れなかった」で終わっていると、実は登録済みのことがある。
 * 最初の操作を送り直す前に、これで確かめる。
 *
 * @param did - 確かめる DID
 * @returns 登録済みなら true、まだなら false
 * @throws 404 以外の失敗（plc.directory が止まっているなど）
 * @internal
 */
export async function isPlcRegistered(did: string): Promise<boolean> {
	const { plcUrl } = getAtprotoConfig();

	try {
		await getResponse({
			url: `${plcUrl}/${encodeURIComponent(did)}`,
			method: "GET",
			headers: {
				"User-Agent": config.userAgent,
				Accept: "application/json",
			},
			timeout: 10 * 1000,
		});
		return true;
	} catch (err) {
		// 404 は「まだ無い」。それ以外は分からないので呼び出し側に任せる
		if (err instanceof StatusError && err.statusCode === 404) return false;
		throw err;
	}
}

/**
 * plc.directory に操作を送る。
 *
 * @remarks
 * - NB: 最初の操作を送り直す前に、{@link isPlcRegistered} で登録済みでないかを確かめること。
 *   登録済みの DID に最初の操作をもう一度送ったときの扱いは、仕様で決まっていない。
 * - plc.directory はハンドルや PDS が実在するかを確かめない。確かめるのは Relay や AppView の側。
 *
 * @param did - 操作の対象の DID
 * @param op - 署名済みの操作
 * @throws plc.directory が成功以外を返したとき（`StatusError`）
 * @internal
 */
export async function submitPlcOperation(
	did: string,
	op: SignedPlcOperation,
): Promise<void> {
	const { plcUrl } = getAtprotoConfig();

	await getResponse({
		url: `${plcUrl}/${encodeURIComponent(did)}`,
		method: "POST",
		body: JSON.stringify(op),
		headers: {
			"User-Agent": config.userAgent,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		timeout: 10 * 1000,
	});
}

// #endregion

// #region 変換処理

/** base32 の文字（RFC 4648 の小文字。did:plc はこれを使う） */
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * バイト列を base32（小文字・パディング無し）にする。
 *
 * @remarks
 * `multiformats` を入れずに済ませるため、自前で書いている。5 ビットずつ取り出して 1 文字にする。
 *
 * @param bytes - 変換するバイト列
 * @returns base32 の文字列
 * @internal
 */
export function base32Encode(bytes: Uint8Array): string {
	let out = "";
	let buffer = 0;
	let bits = 0;
	for (const byte of bytes) {
		// 8 ビットずつ足していき、5 ビットたまるたびに 1 文字出す
		buffer = (buffer << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
			bits -= 5;
		}
		// 使い終わった上位のビットを捨てて、数が大きくなりすぎないようにする
		buffer &= (1 << bits) - 1;
	}
	// 余ったビットは、右を 0 で埋めて 1 文字にする
	if (bits > 0) {
		out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
	}
	return out;
}

// #endregion
