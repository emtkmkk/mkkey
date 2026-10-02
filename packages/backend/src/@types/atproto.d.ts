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

declare module "@atproto/lex-data" {
	/**
	 * CID（中身から決まる識別子）。
	 *
	 * @remarks
	 * `toString()` で `bafyrei...` の形になる。比べるときは `equals` か文字列にしてから比べる（オブジェクトの `===` は使えない）。
	 */
	export interface Cid {
		readonly bytes: Uint8Array;
		toString(): string;
		equals(other: unknown): boolean;
	}

	/** 文字列の CID を読む。形が正しくなければ例外 */
	export function parseCid(input: string): Cid;
}

declare module "@atproto/lex-cbor" {
	import type { Cid } from "@atproto/lex-data";

	/** AT Protocol で使う値（JSON に近いが、バイト列と CID も入れられる） */
	export type LexValue =
		| null
		| boolean
		| number
		| string
		| Uint8Array
		| Cid
		| LexValue[]
		| { [key: string]: LexValue | undefined };

	/** DAG-CBOR で符号化する（キーの順番などは規則どおりにそろえられる） */
	export function cborEncode(value: LexValue): Uint8Array;

	/** DAG-CBOR を読む（CID は {@link Cid} として戻る） */
	export function cborDecode(bytes: Uint8Array): LexValue;

	/** 値を DAG-CBOR にしたときの CID を計算する */
	export function cidForLex(value: LexValue): Promise<Cid>;
}

declare module "@atproto/repo" {
	import type { Cid } from "@atproto/lex-data";
	import type { LexValue } from "@atproto/lex-cbor";
	import type { Secp256k1Keypair } from "@atproto/crypto";

	// #region 値の入れ物

	/** レコードの中身（キーが文字列のオブジェクト） */
	export type LexMap = { [key: string]: LexValue | undefined };

	/** CID → バイト列の入れ物 */
	export class BlockMap implements Iterable<[Cid, Uint8Array]> {
		constructor(entries?: Iterable<readonly [Cid, Uint8Array]>);
		set(cid: Cid, bytes: Uint8Array): BlockMap;
		get(cid: Cid): Uint8Array | undefined;
		has(cid: Cid): boolean;
		/** ほかの入れ物の中身を足す（自分自身を返す） */
		addMap(toAdd: BlockMap): BlockMap;
		get size(): number;
		[Symbol.iterator](): Iterator<[Cid, Uint8Array]>;
	}

	/** CID の集まり */
	export class CidSet {
		size(): number;
		toList(): Cid[];
	}

	// #endregion

	// #region 書き込み

	/** 書き込みの種類。実際の値は `"create"` / `"update"` / `"delete"` */
	export enum WriteOpAction {
		Create = "create",
		Update = "update",
		Delete = "delete",
	}

	export type RecordCreateOp = {
		action: WriteOpAction.Create;
		collection: string;
		rkey: string;
		record: LexMap;
	};
	export type RecordUpdateOp = {
		action: WriteOpAction.Update;
		collection: string;
		rkey: string;
		record: LexMap;
	};
	export type RecordDeleteOp = {
		action: WriteOpAction.Delete;
		collection: string;
		rkey: string;
	};
	export type RecordWriteOp = RecordCreateOp | RecordUpdateOp | RecordDeleteOp;

	/**
	 * 作ったコミット。
	 *
	 * @remarks
	 * - `newBlocks` にはコミット自身のブロックも入る。
	 * - `relevantBlocks` は、変更を確かめるのに要る既存の MST のブロック（Sync v1.1 の firehose で一緒に送る）。
	 */
	export type CommitData = {
		cid: Cid;
		rev: string;
		since: string | null;
		prev: Cid | null;
		newBlocks: BlockMap;
		relevantBlocks: BlockMap;
		removedCids: CidSet;
	};

	// #endregion

	// #region 保存先

	/** ブロックを読む側の土台。`getBytes` / `has` / `getBlocks` を書けば、ほかの読み方は用意される */
	export abstract class ReadableBlockstore {
		abstract getBytes(cid: Cid): Promise<Uint8Array | null>;
		abstract has(cid: Cid): Promise<boolean>;
		abstract getBlocks(
			cids: Cid[],
		): Promise<{ blocks: BlockMap; missing: Cid[] }>;
	}

	/** レポジトリの保存先（使う分だけ） */
	export interface RepoStorage extends ReadableBlockstore {
		getRoot(): Promise<Cid | null>;
		putBlock(cid: Cid, block: Uint8Array, rev: string): Promise<void>;
		putMany(blocks: BlockMap, rev: string): Promise<void>;
		updateRoot(cid: Cid, rev: string): Promise<void>;
		applyCommit(commit: CommitData): Promise<void>;
	}

	// #endregion

	// #region レポジトリ

	/** MST（レコードの索引の木） */
	export class MST {
		/** `<collection>/<rkey>` のレコードの CID。無ければ null */
		get(key: string): Promise<Cid | null>;
		/** 木の根の CID */
		getPointer(): Promise<Cid>;
	}

	/** 署名済みのコミットの中身 */
	export type Commit = {
		did: string;
		version: 3;
		/** MST の根の CID（Sync v1.1 の `prevData` に使う） */
		data: Cid;
		rev: string;
		prev: Cid | null;
		sig: Uint8Array;
	};

	export class Repo {
		cid: Cid;
		commit: Commit;
		data: MST;
		/** 最初のコミットを作る（保存はしない） */
		static formatInitCommit(
			storage: RepoStorage,
			did: string,
			keypair: Secp256k1Keypair,
			initialWrites?: RecordCreateOp[],
		): Promise<CommitData>;
		/** 保存先からレポジトリを読む */
		static load(storage: RepoStorage, cid?: Cid): Promise<Repo>;
		/** 次のコミットを作る（保存はしない） */
		formatCommit(
			toWrite: RecordWriteOp | RecordWriteOp[],
			keypair: Secp256k1Keypair,
		): Promise<CommitData>;
	}

	// #endregion

	// #region CAR

	/** ブロックを CAR 形式のバイト列にする */
	export function blocksToCarFile(
		root: Cid | null,
		blocks: BlockMap,
	): Promise<Uint8Array>;

	/** レコードと、コミットからそのレコードまでの証明（MST の経路）を CAR で書き出す */
	export function getRecords(
		storage: ReadableBlockstore,
		commitCid: Cid,
		paths: { collection: string; rkey: string }[],
	): AsyncIterable<Uint8Array>;

	// #endregion
}
