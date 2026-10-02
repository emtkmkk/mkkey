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
 * - プロフィールは、mkkey 側で名前・アイコン・バナーを変えたときに {@link upsertProfile} で書き直す
 *   （`services/i/update.ts` の `publishToFollowers` から呼ばれる）。
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
import { fetchMeta } from "@/misc/fetch-meta.js";
import { blobRefCid, prepareImageBlob } from "./blob.js";
import { appendEvent, lockSequencer } from "./sequencer.js";
import { nextTid } from "./tid.js";

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

/**
 * プロフィールを作るのに使う、ローカルユーザーの項目。
 *
 * @internal
 */
export type ProfileSourceUser = Pick<User, "username" | "name" | "avatarId" | "bannerId">;

/** firehose の `#commit` に入れる、レコード 1 件分の変更 */
type CommitOp = {
	action: "create" | "update" | "delete";
	path: string;
	cid: Cid | null;
	prev?: Cid;
};

// #endregion

// #region 定数

/** {@link deleteBridgeRecord} で消してよいレコードの種類 */
const DELETABLE_COLLECTIONS: readonly string[] = [
	"app.bsky.graph.follow",
	"app.bsky.feed.like",
];

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
 * @throws アイコン・バナーの変換に失敗したとき（{@link prepareImageBlob}）
 * @internal
 */
export async function ensureRepo(
	identity: Pick<AtprotoIdentity, "userId" | "repoCommitCid">,
	user: ProfileSourceUser,
): Promise<void> {
	if (identity.repoCommitCid != null) return;

	await writeRecords(identity.userId, [
		{
			action: WriteOpAction.Create,
			collection: "app.bsky.actor.profile",
			rkey: "self",
			record: await buildProfileRecord(identity.userId, user, null),
		},
	]);
}

/**
 * プロフィールを、mkkey 側の今の表示名・アイコン・バナーで書き直す。
 *
 * @remarks
 * - レポジトリがまだ無ければ {@link ensureRepo} と同じく作成する。
 * - `force` でなければ、今のレコードと表示名・説明文・アイコン・バナーが同じときは書かない（null を返す）。
 *   mkkey のプロフィール更新は、設定を 1 つ変えただけでも呼ばれるので、そのたびにコミットを作らないため。
 * - `force` は、Relay が最初のコミットを見逃したときのやり直しに使う。書き直すと新しい `#commit` が firehose に流れる。
 * - `createdAt` は最初に書いたときの値を引き継ぐ。
 *
 * @param identity - 対象の身元
 * @param user - プロフィールに使うユーザー情報
 * @param opts.force - 変わっていなくても書き直すか
 * @defaultValue `opts.force` は false
 * @returns 新しいコミット。書かなかったときは null
 * @throws アイコン・バナーの変換に失敗したとき（{@link prepareImageBlob}）
 * @throws {@link writeRecords} と同じ
 * @internal
 */
export async function upsertProfile(
	identity: Pick<AtprotoIdentity, "userId" | "repoCommitCid">,
	user: ProfileSourceUser,
	opts: { force?: boolean } = {},
): Promise<{ commitCid: string; rev: string } | null> {
	// レポジトリがまだ無ければ、プロフィールの作成そのものが新しい #commit になる
	if (identity.repoCommitCid == null) {
		return await writeRecords(identity.userId, [
			{
				action: WriteOpAction.Create,
				collection: "app.bsky.actor.profile",
				rkey: "self",
				record: await buildProfileRecord(identity.userId, user, null),
			},
		]);
	}

	const current = await readProfileRecord(identity.userId, identity.repoCommitCid);
	const next = await buildProfileRecord(
		identity.userId,
		user,
		typeof current?.createdAt === "string" ? current.createdAt : null,
	);
	if (!opts.force && current != null && isSameProfile(current, next)) return null;

	return await writeRecords(identity.userId, [
		{
			// 何かの理由でプロフィールが無くなっていたら、作り直す
			action: current == null ? WriteOpAction.Create : WriteOpAction.Update,
			collection: "app.bsky.actor.profile",
			rkey: "self",
			record: next,
		},
	]);
}

/**
 * `app.bsky.graph.follow` を書き込む。
 *
 * @remarks
 * - 同じ相手への follow がすでにあるかは見ない（何件でも書ける）。重複を防ぐのは呼び出し側の役目
 *   （本番の流れでは `atproto_record_map` の一意の索引で防ぐ）。
 * - レコードキーは TID。書いた順に並ぶ。
 *
 * @param userId - follow するローカルユーザー
 * @param subjectDid - follow する相手の DID
 * @returns 書いたレコードの URI と CID、新しいコミット
 * @throws {@link writeRecords} と同じ
 * @internal
 */
export async function createFollowRecord(
	userId: string,
	subjectDid: string,
): Promise<RepoWriteResult & { rev: string }> {
	const { rev, results } = await writeRecords(userId, [
		{
			action: WriteOpAction.Create,
			collection: "app.bsky.graph.follow",
			rkey: nextTid(),
			record: {
				$type: "app.bsky.graph.follow",
				subject: subjectDid,
				createdAt: new Date().toISOString(),
			},
		},
	]);
	return { ...results[0], rev };
}

/**
 * `app.bsky.feed.like` を書き込む。
 *
 * @remarks
 * 重複の扱いとレコードキーは {@link createFollowRecord} と同じ。
 *
 * @param userId - like するローカルユーザー
 * @param subject - like する投稿の URI と CID
 * @returns 書いたレコードの URI と CID、新しいコミット
 * @throws {@link writeRecords} と同じ
 * @internal
 */
export async function createLikeRecord(
	userId: string,
	subject: { uri: string; cid: string },
): Promise<RepoWriteResult & { rev: string }> {
	const { rev, results } = await writeRecords(userId, [
		{
			action: WriteOpAction.Create,
			collection: "app.bsky.feed.like",
			rkey: nextTid(),
			record: {
				$type: "app.bsky.feed.like",
				subject: { uri: subject.uri, cid: subject.cid },
				createdAt: new Date().toISOString(),
			},
		},
	]);
	return { ...results[0], rev };
}

/**
 * 自分のレポジトリの follow / like を消す。
 *
 * @remarks
 * - 消せるのは {@link DELETABLE_COLLECTIONS} の種類だけ。プロフィールは消させない
 *   （消すと Bluesky 側でアカウントの表示が崩れるため）。
 * - URI の DID が、このユーザーの DID と違うときは消さない（他人のレコードは消せないため）。
 *
 * @param identity - レポジトリの持ち主の身元
 * @param uri - 消すレコードの URI（`at://<自分の DID>/<collection>/<rkey>`）
 * @returns 新しいコミット
 * @throws URI の形がおかしいとき、他人の DID のとき、消せない種類のとき
 * @throws {@link writeRecords} と同じ（レコードが無いときを含む）
 * @internal
 */
export async function deleteBridgeRecord(
	identity: Pick<AtprotoIdentity, "userId" | "did">,
	uri: string,
): Promise<{ commitCid: string; rev: string }> {
	const match = uri.trim().match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
	if (match == null) throw new Error(`not an at:// record URI: ${uri}`);
	const [, did, collection, rkey] = match;

	// #region 入力チェック
	if (did !== identity.did) throw new Error("the record belongs to another DID");
	if (!DELETABLE_COLLECTIONS.includes(collection)) {
		throw new Error(`cannot delete records of ${collection}`);
	}
	// #endregion

	return await writeRecords(identity.userId, [
		{ action: WriteOpAction.Delete, collection, rkey },
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
 * - 表示名・固定の説明文・アイコン・バナーを入れる。mkkey の自己紹介は入れない（どういうアカウントかを分かりやすくするため）。
 * - 文字数は、書記素ではなく文字（コードポイント）で数えて切る。絵文字の組み合わせでは少し短めに切れるが、上限は超えない。
 *
 * @param userId - レポジトリの持ち主（blob の持ち主）
 * @param user - 対象のユーザー
 * @param createdAt - 引き継ぐ作成日時。初めて作るときは null
 * @returns `app.bsky.actor.profile` のレコード
 * @throws アイコン・バナーの変換に失敗したとき（{@link prepareImageBlob}）
 * @internal
 */
async function buildProfileRecord(
	userId: string,
	user: ProfileSourceUser,
	createdAt: string | null,
): Promise<LexMap> {
	const displayName = [...(user.name || user.username)]
		.slice(0, PROFILE_DISPLAY_NAME_MAX)
		.join("");
	const instanceName = (await fetchMeta()).name || config.host;

	const avatar = user.avatarId
		? await prepareImageBlob(userId, user.avatarId, "avatar")
		: null;
	const banner = user.bannerId
		? await prepareImageBlob(userId, user.bannerId, "banner")
		: null;

	return {
		$type: "app.bsky.actor.profile",
		displayName,
		description: buildProfileDescription(instanceName, `${config.url}/@${user.username}`),
		...(avatar ? { avatar } : {}),
		...(banner ? { banner } : {}),
		createdAt: createdAt ?? new Date().toISOString(),
	};
}

/**
 * プロフィールの説明文（固定文）を作る。
 *
 * @remarks
 * - 相手が「誰が、なぜフォローしてきたのか」と「嫌なときにどうすればよいか」が分かるようにする。
 * - 取り込んだ投稿はフォロワー限定のノートなので、ブロックされたら、そのアカウントの持ち主の mkkey 上のフォローを外せば
 *   その人にだけ見えなくなる。ほかにフォローしている人がいれば、その人には見え続けるので「取り込みを止める」とは書かない。
 * - Bluesky の上限は 256 書記素。今の文は 220 文字ほど（サーバー名とユーザー名による。ユーザー名は最大 20 文字なので 240 文字ほどまで）。文言を変えるときは上限に注意すること。
 *
 * @param instanceName - サーバーの名前（例: `もこきー`）
 * @param profileUrl - mkkey 上のプロフィールの URL
 * @returns 説明文
 * @internal
 */
function buildProfileDescription(instanceName: string, profileUrl: string): string {
	return [
		`Fediverse サーバー「${instanceName}」(${config.host}) のユーザーです。`,
		profileUrl,
		"",
		`このユーザは、あなたの投稿を${instanceName}内で見たいと思っている様です。`,
		`${instanceName}内であなたの投稿が確認できるのは、このアカウントのようにあなたをフォローしている人だけです。`,
		"ご希望でない場合は、お手数ですがこのアカウントをブロックしてください。",
		"このアカウントの持ち主に対して、あなたの投稿を表示しないようにします。",
	].join("\n");
}

/**
 * 今のプロフィールのレコードを読む。
 *
 * @param userId - レポジトリの持ち主
 * @param commitCid - 今の最新のコミットの CID
 * @returns レコード。無ければ null
 * @internal
 */
async function readProfileRecord(
	userId: string,
	commitCid: string,
): Promise<Record<string, unknown> | null> {
	const repo = await Repo.load(new DbRepoStorage(userId, db.manager), parseCid(commitCid));
	const record = await repo.getRecord("app.bsky.actor.profile", "self");
	return record != null && typeof record === "object"
		? (record as Record<string, unknown>)
		: null;
}

/**
 * 2 つのプロフィールで、見た目に関わる中身が同じかを比べる。
 *
 * @remarks
 * `createdAt` は比べない。アイコン・バナーは CID で比べる。
 *
 * @param a - 今のレコード
 * @param b - 新しく作ったレコード
 * @returns 同じなら true
 * @internal
 */
function isSameProfile(a: Record<string, unknown>, b: LexMap): boolean {
	return (
		a.displayName === b.displayName &&
		a.description === b.description &&
		blobRefCid(a.avatar) === blobRefCid(b.avatar) &&
		blobRefCid(a.banner) === blobRefCid(b.banner)
	);
}

// #endregion
