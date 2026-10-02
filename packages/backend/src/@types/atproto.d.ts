/**
 * @packageDocumentation
 *
 * Bluesky ブリッジで使う `@atproto/*` ライブラリの型定義（使う分だけ）。
 *
 * @remarks
 * - ライブラリに付いている型定義は TypeScript 5.7 以降の書き方（`Uint8Array<ArrayBuffer>` など）を使っていて、
 *   backend の TypeScript 4.9 では読めない。また backend の `moduleResolution: "node"` は `exports` を見ないため、
 *   型の場所も見つけられない。そのため、tsconfig は変えずに、使う関数だけをここで宣言する。
 * - WARNING: ここの宣言が実物とずれていても、型チェックもビルドも通ってしまい、実行して初めて分かる。
 *   ライブラリを更新したら、次の手順で確かめること。
 *   1. `node_modules/@atproto/<名前>/dist/` の `.d.ts` と、ここの宣言を見比べる（引数・戻り値・`async` か）
 *   2. 本番と同じ Node（今は 19.9）で、DID の発行とレポジトリの書き込みを一通り動かす
 * - 宣言を足すのは、実際に使うものだけにする。使わなくなったものは消す。
 *
 * @see {@link ../remote/atproto/plc.ts} PLC の操作
 * @internal
 */

declare module "@atproto/crypto" {
	/** secp256k1 の鍵の組（署名用・PLC 用の両方で使う） */
	export class Secp256k1Keypair {
		/** 新しい鍵を作る。`exportable: true` にしないと `export()` できない */
		static create(opts?: { exportable?: boolean }): Promise<Secp256k1Keypair>;
		/** 秘密鍵（バイト列、または 16 進数の文字列）から鍵を読み込む */
		static import(
			privKey: Uint8Array | string,
			opts?: { exportable?: boolean },
		): Promise<Secp256k1Keypair>;
		/** JWT のアルゴリズム名（`ES256K`） */
		jwtAlg: string;
		/** 公開鍵の `did:key:...` 形式 */
		did(): string;
		/** 署名する（low-S の compact 形式、64 バイト） */
		sign(msg: Uint8Array): Promise<Uint8Array>;
		/** 秘密鍵をバイト列で取り出す */
		export(): Promise<Uint8Array>;
	}

	/** SHA-256 を計算する */
	export function sha256(input: Uint8Array | string): Promise<Uint8Array>;

	/** `did:key:...` の公開鍵で署名を確かめる */
	export function verifySignature(
		didKey: string,
		data: Uint8Array,
		sig: Uint8Array,
	): Promise<boolean>;
}

declare module "@atproto/lex-cbor" {
	/** AT Protocol で使う値（JSON に近いが、バイト列と CID も入れられる） */
	export type LexValue =
		| null
		| boolean
		| number
		| string
		| Uint8Array
		| LexValue[]
		| { [key: string]: LexValue | undefined };

	/** CID（中身から決まる識別子）。`toString()` で `bafyrei...` の形になる */
	export interface CborCid {
		toString(): string;
	}

	/** DAG-CBOR で符号化する（キーの順番などは規則どおりにそろえられる） */
	export function cborEncode(value: LexValue): Uint8Array;

	/** DAG-CBOR を読む */
	export function cborDecode(bytes: Uint8Array): LexValue;

	/** 値を DAG-CBOR にしたときの CID を計算する */
	export function cidForLex(value: LexValue): Promise<CborCid>;
}
