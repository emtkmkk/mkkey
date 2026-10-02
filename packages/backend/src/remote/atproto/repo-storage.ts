/**
 * @packageDocumentation
 *
 * 自前 PDS のレポジトリの中身（ブロック）を、PostgreSQL の `atproto_repo_block` に読み書きする置き場。
 *
 * @remarks
 * - `@atproto/repo` の `Repo` はこの置き場を通してブロックを読み書きする。中身の組み立て（MST・コミットの署名）はライブラリに任せる。
 * - 1 つの置き場 = 1 人のレポジトリ。ほかの人のブロックは読まない（ユーザーごとに分けて保存しているため）。
 * - 書き込みは、呼び出し側が始めたトランザクションの `EntityManager` を通す。コミットの保存と firehose の採番を、
 *   同じトランザクションで確定させるため（片方だけ残ると、Relay から見た中身と食い違う）。
 * - NOTE: 古いコミットでしか使わなくなったブロック（`removedCids`）は消さない。理由は {@link AtprotoRepoBlock} を参照。
 *
 * @see {@link ./repo.ts} レコードの書き込み
 * @internal
 */

import { In, type EntityManager } from "typeorm";
import { parseCid, type Cid } from "@atproto/lex-data";
import {
	BlockMap,
	ReadableBlockstore,
	type CommitData,
	type RepoStorage,
} from "@atproto/repo";
import { AtprotoIdentity } from "@/models/entities/atproto-identity.js";
import { AtprotoRepoBlock } from "@/models/entities/atproto-repo-block.js";

/**
 * 1 人分のレポジトリのブロックを、データベースに読み書きする置き場。
 *
 * @remarks
 * - 生成: `new DbRepoStorage(userId, manager)`。書き込みに使うときは、`manager` はトランザクションの中のものを渡す。
 * - 読むだけなら、`manager` に `db.manager` を渡してよい。
 *
 * @internal
 */
export class DbRepoStorage extends ReadableBlockstore implements RepoStorage {
	/**
	 * @param userId - レポジトリの持ち主（{@link AtprotoIdentity.userId}）
	 * @param manager - 読み書きに使う EntityManager
	 */
	constructor(
		private readonly userId: string,
		private readonly manager: EntityManager,
	) {
		super();
	}

	// #region 読み込み

	/**
	 * 最新のコミットの CID を返す。まだコミットが無ければ null。
	 *
	 * @returns 最新のコミットの CID
	 */
	public async getRoot(): Promise<Cid | null> {
		const identity = await this.manager.findOne(AtprotoIdentity, {
			where: { userId: this.userId },
			select: ["userId", "repoCommitCid"],
		});
		return identity?.repoCommitCid ? parseCid(identity.repoCommitCid) : null;
	}

	/**
	 * ブロック 1 個の中身を返す。
	 *
	 * @param cid - 読むブロックの CID
	 * @returns 中身。無ければ null
	 */
	public async getBytes(cid: Cid): Promise<Uint8Array | null> {
		const row = await this.manager.findOne(AtprotoRepoBlock, {
			where: { userId: this.userId, cid: cid.toString() },
			select: ["content"],
		});
		return row ? new Uint8Array(row.content) : null;
	}

	/**
	 * ブロックがあるかを返す。
	 *
	 * @param cid - 確かめるブロックの CID
	 * @returns あれば true
	 */
	public async has(cid: Cid): Promise<boolean> {
		const count = await this.manager.countBy(AtprotoRepoBlock, {
			userId: this.userId,
			cid: cid.toString(),
		});
		return count > 0;
	}

	/**
	 * 複数のブロックをまとめて読む。
	 *
	 * @param cids - 読むブロックの CID
	 * @returns 見つかったブロックと、見つからなかった CID
	 */
	public async getBlocks(
		cids: Cid[],
	): Promise<{ blocks: BlockMap; missing: Cid[] }> {
		const blocks = new BlockMap();
		if (cids.length === 0) return { blocks, missing: [] };

		const rows = await this.manager.find(AtprotoRepoBlock, {
			where: { userId: this.userId, cid: In(cids.map((c) => c.toString())) },
			select: ["cid", "content"],
		});
		const found = new Map(rows.map((r) => [r.cid, r.content]));

		// 渡された CID の順に、見つかったものと見つからなかったものに分ける
		const missing: Cid[] = [];
		for (const cid of cids) {
			const content = found.get(cid.toString());
			if (content) blocks.set(cid, new Uint8Array(content));
			else missing.push(cid);
		}
		return { blocks, missing };
	}

	// #endregion

	// #region 書き込み

	/**
	 * ブロックを 1 個保存する。すでにあれば何もしない（同じ CID なら中身も同じため）。
	 *
	 * @param cid - ブロックの CID
	 * @param block - 中身
	 * @param rev - このブロックが初めて出てきたコミットの rev
	 */
	public async putBlock(cid: Cid, block: Uint8Array, rev: string): Promise<void> {
		await this.putMany(new BlockMap([[cid, block]]), rev);
	}

	/**
	 * ブロックをまとめて保存する。すでにあるものは飛ばす。
	 *
	 * @param blocks - 保存するブロック
	 * @param rev - このブロックが初めて出てきたコミットの rev
	 */
	public async putMany(blocks: BlockMap, rev: string): Promise<void> {
		const rows: AtprotoRepoBlock[] = [];
		for (const [cid, bytes] of blocks) {
			rows.push({
				userId: this.userId,
				identity: null,
				cid: cid.toString(),
				repoRev: rev,
				size: bytes.byteLength,
				content: Buffer.from(bytes),
			});
		}
		if (rows.length === 0) return;

		// identity は関連の入れ物なので、保存する値からは外す
		await this.manager
			.createQueryBuilder()
			.insert()
			.into(AtprotoRepoBlock)
			.values(rows.map(({ identity: _identity, ...row }) => row))
			.orIgnore()
			.execute();
	}

	/**
	 * 最新のコミットを差し替える。
	 *
	 * @param cid - 新しいコミットの CID
	 * @param rev - 新しいコミットの rev
	 */
	public async updateRoot(cid: Cid, rev: string): Promise<void> {
		await this.manager.update(AtprotoIdentity, this.userId, {
			repoCommitCid: cid.toString(),
			repoRev: rev,
			updatedAt: new Date(),
		});
	}

	/**
	 * 作ったコミットを保存する（新しいブロックを入れてから、最新のコミットを差し替える）。
	 *
	 * @param commit - 作ったコミット
	 */
	public async applyCommit(commit: CommitData): Promise<void> {
		await this.putMany(commit.newBlocks, commit.rev);
		await this.updateRoot(commit.cid, commit.rev);
	}

	// #endregion
}
