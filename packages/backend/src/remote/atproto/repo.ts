/**
 * @packageDocumentation
 *
 * 自前 PDS のレポジトリにレコードを書き込み、コミットを作って firehose に流す。
 *
 * @remarks
 * - 書くのは、プロフィール（`app.bsky.actor.profile`）・`app.bsky.graph.follow`・`app.bsky.feed.like` だけ。投稿は書かない。
 * - 1 回の {@link writeRecords} = 1 コミット = firehose の `#commit` 1 件。
 * - コミットの保存と firehose の採番は、同じトランザクションで確定させる。片方だけ残ると、
 *   Relay が受け取った内容と `getRepo` で返す内容が食い違う。
 * - ロックの順番は「採番のロック → 身元の行」で固定する。ほかの書き込みも同じ順番にすること（逆にすると止まり合う）。
 * - Sync v1.1 に合わせて、`#commit` には `prevData`（直前の MST の根）と、更新・削除の `prev`（直前のレコードの CID）、
 *   変更を確かめるのに要る既存のブロック（`relevantBlocks`）を入れる。
 * - TODO: プロフィールを、mkkey 側の名前の変更に合わせて書き直す（今は最初に作ったときのまま）。
 *
 * @see {@link ./repo-storage.ts} ブロックの置き場
 * @see {@link ./sequencer.ts} firehose の採番
 * @internal
 */

import { Secp256k1Keypair } from "@atproto/crypto";
import { cidForLex } from "@atproto/lex-cbor";
import { parseCid, type Cid } from "@atproto/lex-data";
import {
	BlockMap,
	Repo,
	WriteOpAction,
	blocksToCarFile,
	type CommitData,
	type LexMap,
	type RecordCreateOp,
	type RecordWriteOp,
} from "@atproto/repo";
import config from "@/config/index.js";
import { db } from "@/db/postgre.js";
import { AtprotoIdentity } from "@/models/entities/atproto-identity.js";
import type { User } from "@/models/entities/user.js";
import { DbRepoStorage } from "./repo-storage.js";
import { appendEvent, lockSequencer } from "./sequencer.js";

// #region 型

/**
 * 書き込んだレコード 1 件の結果。
 *
 * @internal
 */
export type RepoWriteResult = {
	/** レコードの URI（`at://<did>/<collection>/<rkey>`） */
	uri: string;
	/** レコードの CID。削除したときは null */
	cid: string | null;
};

/** firehose の `#commit` に入れる、レコード 1 件分の変更 */
type CommitOp = {
	action: "create" | "update" | "delete";
	path: string;
	cid: Cid | null;
	prev?: Cid;
};

// #endregion

// #region 公開メソッド

/**
 * レコードを書き込み、コミットを作って firehose に流す。
 *
 * @remarks
 * - 最初のコミット（まだレポジトリが無い）のときは、作成（create）だけを受け付ける。
 * - すでにあるレコードの作成や、無いレコードの更新・削除は例外にする（何も書かない）。
 *
 * @param userId - レポジトリの持ち主（ローカルユーザー）
 * @param writes - 書き込むレコード（1 件以上）
 * @returns 新しいコミットと、書き込んだレコードの URI・CID（`writes` と同じ順番）
 * @throws 身元が無い・止まっている・plc.directory に未登録のとき
 * @throws 書き込みの内容がレポジトリの今の状態と合わないとき
 * @internal
 */
export async function writeRecords(
	userId: string,
	writes: RecordWriteOp[],
): Promise<{ commitCid: string; rev: string; results: RepoWriteResult[] }> {
	if (writes.length === 0) throw new Error("no writes");

	return await db.transaction(async (manager) => {
		// 採番のロック → 身元の行、の順に取る（ファイル先頭の説明を参照）
		await lockSequencer(manager);
		const identity = await manager.findOne(AtprotoIdentity, {
			where: { userId },
			lock: { mode: "pessimistic_write" },
		});

		// #region 入力チェック
		if (identity == null) throw new Error("no atproto identity for the user");
		if (identity.status !== "active") throw new Error("the identity is not active");
		if (identity.plcRegisteredAt == null) {
			throw new Error("the DID is not registered to PLC yet");
		}
		// #endregion

		const key = await Secp256k1Keypair.import(identity.signingPrivateKey);
		const storage = new DbRepoStorage(userId, manager);

		// コミットを作る（まだ保存はしない）
		const { commit, ops, prevData } =
			identity.repoCommitCid == null
				? await formatFirstCommit(storage, identity.did, key, writes)
				: await formatNextCommit(
						storage,
						parseCid(identity.repoCommitCid),
						key,
						writes,
				  );

		await storage.applyCommit(commit);

		// firehose に流す。ブロックは、新しく作ったものと、変更を確かめるのに要る既存のもの
		const blocks = new BlockMap();
		blocks.addMap(commit.newBlocks);
		blocks.addMap(commit.relevantBlocks);
		await appendEvent(manager, identity.did, "commit", {
			repo: identity.did,
			commit: commit.cid,
			rev: commit.rev,
			since: commit.since,
			blocks: await blocksToCarFile(commit.cid, blocks),
			ops,
			blobs: [],
			prevData: prevData ?? undefined,
			// 古い仕様の項目。今は常に false を入れる決まり
			rebase: false,
			// follow / like しか書かないので、大きすぎて中身を省くことは起きない
			tooBig: false,
			time: new Date().toISOString(),
		});

		return {
			commitCid: commit.cid.toString(),
			rev: commit.rev,
			results: ops.map((op) => ({
				uri: `at://${identity.did}/${op.path}`,
				cid: op.cid?.toString() ?? null,
			})),
		};
	});
}

/**
 * レポジトリがまだ無ければ、プロフィールだけを入れた最初のコミットを作る。
 *
 * @remarks
 * すでにレポジトリがあれば何もしない。身元を有効にしたときに呼ぶ。
 *
 * @param identity - 対象の身元
 * @param user - プロフィールに使うユーザー情報
 * @internal
 */
export async function ensureRepo(
	identity: Pick<AtprotoIdentity, "userId" | "repoCommitCid">,
	user: Pick<User, "username" | "name">,
): Promise<void> {
	if (identity.repoCommitCid != null) return;

	await writeRecords(identity.userId, [
		{
			action: WriteOpAction.Create,
			collection: "app.bsky.actor.profile",
			rkey: "self",
			record: buildProfileRecord(user),
		},
	]);
}

// #endregion

// #region コミットの組み立て

/**
 * 最初のコミットを作る。
 *
 * @param storage - ブロックの置き場
 * @param did - レポジトリの DID
 * @param key - 署名用の鍵
 * @param writes - 書き込むレコード（作成だけ）
 * @returns コミットと firehose 用の変更の一覧
 * @throws 作成以外の書き込みが入っているとき
 * @internal
 */
async function formatFirstCommit(
	storage: DbRepoStorage,
	did: string,
	key: Secp256k1Keypair,
	writes: RecordWriteOp[],
): Promise<{ commit: CommitData; ops: CommitOp[]; prevData: null }> {
	const creates = writes.filter(
		(w): w is RecordCreateOp => w.action === WriteOpAction.Create,
	);
	if (creates.length !== writes.length) {
		throw new Error("the first commit can only create records");
	}

	const commit = await Repo.formatInitCommit(storage, did, key, creates);
	const ops: CommitOp[] = [];
	for (const w of creates) {
		ops.push({
			action: "create",
			path: `${w.collection}/${w.rkey}`,
			cid: await cidForLex(w.record),
		});
	}
	return { commit, ops, prevData: null };
}

/**
 * 2 回目以降のコミットを作る。
 *
 * @remarks
 * 更新・削除では、firehose に入れるため、書き込む前のレコードの CID（`prev`）を先に引いておく。
 *
 * @param storage - ブロックの置き場
 * @param rootCid - 今の最新のコミットの CID
 * @param key - 署名用の鍵
 * @param writes - 書き込むレコード
 * @returns コミット・firehose 用の変更の一覧・直前の MST の根
 * @throws すでにあるレコードを作ろうとしたとき、無いレコードを更新・削除しようとしたとき
 * @internal
 */
async function formatNextCommit(
	storage: DbRepoStorage,
	rootCid: Cid,
	key: Secp256k1Keypair,
	writes: RecordWriteOp[],
): Promise<{ commit: CommitData; ops: CommitOp[]; prevData: Cid }> {
	const repo = await Repo.load(storage, rootCid);

	const ops: CommitOp[] = [];
	for (const w of writes) {
		const path = `${w.collection}/${w.rkey}`;
		const prev = await repo.data.get(path);

		// 今の状態と合わない書き込みは、ライブラリに渡す前に止める（どれがおかしいかを分かるようにするため）
		if (w.action === WriteOpAction.Create) {
			if (prev != null) throw new Error(`record already exists: ${path}`);
			ops.push({ action: "create", path, cid: await cidForLex(w.record) });
		} else if (w.action === WriteOpAction.Update) {
			if (prev == null) throw new Error(`record not found: ${path}`);
			ops.push({ action: "update", path, cid: await cidForLex(w.record), prev });
		} else {
			if (prev == null) throw new Error(`record not found: ${path}`);
			ops.push({ action: "delete", path, cid: null, prev });
		}
	}

	const commit = await repo.formatCommit(writes, key);
	return { commit, ops, prevData: repo.commit.data };
}

// #endregion

// #region 変換処理

/** プロフィールの表示名の上限（Bluesky の決まり。書記素の数） */
const PROFILE_DISPLAY_NAME_MAX = 64;

/**
 * プロフィールのレコードを作る。
 *
 * @remarks
 * - 表示名と、mkkey のプロフィールへのリンクだけを入れる。アイコンは入れない（画像の blob を扱わないため）。
 * - 文字数は、書記素ではなく文字（コードポイント）で数えて切る。絵文字の組み合わせでは少し短めに切れるが、上限は超えない。
 *
 * @param user - 対象のユーザー
 * @returns `app.bsky.actor.profile` のレコード
 * @internal
 */
function buildProfileRecord(user: Pick<User, "username" | "name">): LexMap {
	const displayName = [...(user.name || user.username)]
		.slice(0, PROFILE_DISPLAY_NAME_MAX)
		.join("");
	const profileUrl = `${config.url}/@${user.username}`;

	return {
		$type: "app.bsky.actor.profile",
		displayName,
		description: `${config.host} のユーザーです（Bluesky ブリッジ）。このアカウントは follow と like だけを行います。\n${profileUrl}`,
		createdAt: new Date().toISOString(),
	};
}

// #endregion
