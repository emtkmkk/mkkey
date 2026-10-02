/**
 * @packageDocumentation
 *
 * Bluesky ブリッジの自前 PDS が外に見せる HTTP の窓口（XRPC と `/.well-known/atproto-did`）。
 *
 * @remarks
 * - 応えるのは、ホスト名が `atproto.pdsHostname`（例: `bsky.mkkey.net`）か、その下のハンドル（例: `alice.bsky.mkkey.net`）のときだけ。
 *   ほかのホスト名（`mkkey.net` など）では何もせず、次の処理に回す。ブリッジが無効なときも同じ。
 *   NB: このルーターは `well-known.ts` より前に登録すること。`well-known.ts` は知らない `.well-known` をすべて 404 にするため。
 * - 用意するのは、Relay と AppView がレポジトリと blob（アイコン・バナー）を読むのに要る読み取り用の窓口だけ。書き込みの窓口（ログイン・createRecord など）は無い。
 *   書き込みは mkkey の中からだけ行う（{@link ../../remote/atproto/repo.ts}）。
 * - firehose（`subscribeRepos`）は WebSocket なので、ここではなく {@link ./subscribe-repos.ts} で扱う。
 * - エラーは XRPC の決まりどおり `{ error, message }` の JSON で返す。
 * - TODO: `com.atproto.repo.getRecord` / `listRecords` / `describeRepo` を足す（AppView は使わないが、ツールによっては使う）。
 *
 * @see {@link https://atproto.com/specs/xrpc | XRPC の仕様}
 * @see {@link https://atproto.com/specs/sync | Sync の仕様}
 * @internal
 */

import Router from "@koa/router";
import type Koa from "koa";
import { In, IsNull, MoreThan, Not } from "typeorm";
import { parseCid, type Cid } from "@atproto/lex-data";
import { BlockMap, Repo, blocksToCarFile, getRecords } from "@atproto/repo";
import config from "@/config/index.js";
import { db } from "@/db/postgre.js";
import { AtprotoBlobs, AtprotoIdentities, AtprotoRepoBlocks } from "@/models/index.js";
import type { AtprotoIdentity } from "@/models/entities/atproto-identity.js";
import { getAtprotoConfig } from "@/remote/atproto/config.js";
import { DbRepoStorage } from "@/remote/atproto/repo-storage.js";

const router = new Router();

// #region 定数

/** CAR 形式の Content-Type */
const CAR_CONTENT_TYPE = "application/vnd.ipld.car";

/** listRepos で 1 回に返す数の既定値と上限 */
const LIST_REPOS_DEFAULT_LIMIT = 500;
const LIST_REPOS_MAX_LIMIT = 1000;

/** getBlocks で 1 回に受け付ける CID の上限 */
const GET_BLOCKS_MAX = 1000;

/** listBlobs で 1 回に返す数の既定値と上限 */
const LIST_BLOBS_DEFAULT_LIMIT = 500;
const LIST_BLOBS_MAX_LIMIT = 1000;

// #endregion

// #region ホスト名の振り分け

/**
 * PDS 本体のホスト名か（ハンドルのホスト名は含まない）。
 *
 * @param ctx - Koa のコンテキスト
 * @returns ブリッジが有効で、ホスト名が `pdsHostname` なら true
 * @internal
 */
function isPdsHost(ctx: Koa.Context): boolean {
	const { enabled, pdsHostname } = getAtprotoConfig();
	return enabled && ctx.hostname.toLowerCase() === pdsHostname;
}

/**
 * ハンドルのホスト名か（例: `alice.bsky.mkkey.net`）。
 *
 * @param ctx - Koa のコンテキスト
 * @returns ブリッジが有効で、ホスト名が `pdsHostname` のすぐ下なら true
 * @internal
 */
function isHandleHost(ctx: Koa.Context): boolean {
	const { enabled, pdsHostname } = getAtprotoConfig();
	return enabled && ctx.hostname.toLowerCase().endsWith(`.${pdsHostname}`);
}

// #endregion

// #region 応答の組み立て

/**
 * XRPC のエラーを返す。
 *
 * @param ctx - Koa のコンテキスト
 * @param status - HTTP のステータス
 * @param error - エラーの種類（例: `RepoNotFound`）
 * @param message - 説明
 * @internal
 */
function xrpcError(
	ctx: Koa.Context,
	status: number,
	error: string,
	message: string,
): void {
	ctx.status = status;
	ctx.body = { error, message };
}

/**
 * クエリの値を 1 つの文字列として取り出す（同じ名前が複数あれば最初のもの）。
 *
 * @param ctx - Koa のコンテキスト
 * @param name - パラメーターの名前
 * @returns 値。無ければ undefined
 * @internal
 */
function queryString(ctx: Koa.Context, name: string): string | undefined {
	const v = ctx.query[name];
	return Array.isArray(v) ? v[0] : v;
}

/**
 * 公開してよいレポジトリを DID で探す。見つからなければエラーを返して null。
 *
 * @remarks
 * plc.directory に未登録の身元や、まだコミットが無い身元は「無い」として扱う。外から見て存在しないため。
 *
 * @param ctx - Koa のコンテキスト
 * @param opts.allowDeactivated - 止めた身元も返すか（`getRepoStatus` 用）
 * @returns 身元。見つからない・止まっているときは null（エラーは返し済み）
 * @internal
 */
async function findRepo(
	ctx: Koa.Context,
	opts: { allowDeactivated?: boolean } = {},
): Promise<(AtprotoIdentity & { repoCommitCid: string; repoRev: string }) | null> {
	const did = queryString(ctx, "did");
	if (!did) {
		xrpcError(ctx, 400, "InvalidRequest", "did is required");
		return null;
	}

	const identity = await AtprotoIdentities.findOneBy({ did });
	if (
		identity == null ||
		identity.plcRegisteredAt == null ||
		identity.repoCommitCid == null ||
		identity.repoRev == null
	) {
		xrpcError(ctx, 400, "RepoNotFound", `Could not find repo for DID: ${did}`);
		return null;
	}
	if (identity.status !== "active" && !opts.allowDeactivated) {
		xrpcError(ctx, 400, "RepoDeactivated", `Repo has been deactivated: ${did}`);
		return null;
	}
	return identity as AtprotoIdentity & { repoCommitCid: string; repoRev: string };
}

/**
 * 非同期に流れてくるバイト列を 1 つにまとめる。
 *
 * @param chunks - バイト列の流れ
 * @returns つなげたバイト列
 * @internal
 */
async function collectBytes(chunks: AsyncIterable<Uint8Array>): Promise<Buffer> {
	const parts: Uint8Array[] = [];
	for await (const chunk of chunks) parts.push(chunk);
	return Buffer.concat(parts);
}

// #endregion

// #region ハンドルの確認

/**
 * ハンドルのホスト名で、そのハンドルの DID を返す（HTTPS 方式のハンドルの確認）。
 *
 * @remarks
 * 例: `https://alice.bsky.mkkey.net/.well-known/atproto-did` → `did:plc:...`（本文だけの文字列）
 */
router.get("/.well-known/atproto-did", async (ctx, next) => {
	if (!isHandleHost(ctx)) return await next();

	const identity = await AtprotoIdentities.findOneBy({
		handle: ctx.hostname.toLowerCase(),
		status: "active",
		plcRegisteredAt: Not(IsNull()),
	});
	if (identity == null) {
		ctx.status = 404;
		return;
	}
	ctx.type = "text/plain";
	ctx.body = identity.did;
});

// #endregion

// #region サーバーの情報

/** 動いているかの確認 */
router.get("/xrpc/_health", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	ctx.body = { version: config.version };
});

/**
 * サーバーの情報。
 *
 * @remarks
 * アカウントの作成は受け付けないので、`inviteCodeRequired: true` にしておく（招待コードは発行しない）。
 */
router.get("/xrpc/com.atproto.server.describeServer", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const { pdsHostname } = getAtprotoConfig();
	ctx.body = {
		did: `did:web:${pdsHostname}`,
		availableUserDomains: [`.${pdsHostname}`],
		inviteCodeRequired: true,
		links: {},
		contact: {},
	};
});

/** このサーバーのハンドルを DID にする（ほかのサーバーのハンドルは扱わない） */
router.get("/xrpc/com.atproto.identity.resolveHandle", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const handle = queryString(ctx, "handle")?.toLowerCase();
	if (!handle) return xrpcError(ctx, 400, "InvalidRequest", "handle is required");

	const identity = await AtprotoIdentities.findOneBy({
		handle,
		status: "active",
		plcRegisteredAt: Not(IsNull()),
	});
	if (identity == null) {
		return xrpcError(ctx, 400, "HandleNotFound", "Unable to resolve handle");
	}
	ctx.body = { did: identity.did };
});

// #endregion

// #region レポジトリの読み取り（com.atproto.sync.*）

/** 最新のコミットの CID と rev */
router.get("/xrpc/com.atproto.sync.getLatestCommit", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx);
	if (identity == null) return;
	ctx.body = { cid: identity.repoCommitCid, rev: identity.repoRev };
});

/** レポジトリの状態（止めたものも答える） */
router.get("/xrpc/com.atproto.sync.getRepoStatus", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx, { allowDeactivated: true });
	if (identity == null) return;

	const active = identity.status === "active";
	ctx.body = active
		? { did: identity.did, active, rev: identity.repoRev }
		: { did: identity.did, active, status: identity.status };
});

/**
 * 公開しているレポジトリの一覧。
 *
 * @remarks
 * DID の順に並べ、`cursor` は最後に返した DID。止めたものも `active: false` で入れる（Relay が状態を知るため）。
 */
router.get("/xrpc/com.atproto.sync.listRepos", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();

	const limitRaw = Number(queryString(ctx, "limit") ?? LIST_REPOS_DEFAULT_LIMIT);
	const limit = Number.isInteger(limitRaw)
		? Math.min(Math.max(limitRaw, 1), LIST_REPOS_MAX_LIMIT)
		: LIST_REPOS_DEFAULT_LIMIT;
	const cursor = queryString(ctx, "cursor");

	const rows = await AtprotoIdentities.find({
		where: {
			plcRegisteredAt: Not(IsNull()),
			repoCommitCid: Not(IsNull()),
			...(cursor ? { did: MoreThan(cursor) } : {}),
		},
		order: { did: "ASC" },
		take: limit,
	});

	ctx.body = {
		repos: rows.map((r) =>
			r.status === "active"
				? { did: r.did, head: r.repoCommitCid, rev: r.repoRev, active: true }
				: {
						did: r.did,
						head: r.repoCommitCid,
						rev: r.repoRev,
						active: false,
						status: r.status,
				  },
		),
		// まだ続きがありそうなときだけ cursor を返す
		...(rows.length === limit ? { cursor: rows[rows.length - 1].did } : {}),
	};
});

/**
 * レポジトリ全体（または、ある rev より後の差分）を CAR で返す。
 *
 * @remarks
 * - NOTE: 古いコミットでしか使わないブロックも消していないので、全体を返すときはそれも入る。
 *   受け取る側は根から辿れるブロックだけを使うので、余分に入っていても困らない。
 * - OPTIMIZE: 今は全部をメモリに載せてから返す。follow / like だけなら小さいが、大きくなったら流しながら返す形にする。
 */
router.get("/xrpc/com.atproto.sync.getRepo", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx);
	if (identity == null) return;

	// rev（TID）は文字列の順がそのまま時間の順になるので、文字列で比べてよい
	const since = queryString(ctx, "since");
	const rows = await AtprotoRepoBlocks.find({
		where: {
			userId: identity.userId,
			...(since ? { repoRev: MoreThan(since) } : {}),
		},
		select: ["cid", "content"],
	});

	const blocks = new BlockMap();
	for (const row of rows) {
		blocks.set(parseCid(row.cid), new Uint8Array(row.content));
	}
	ctx.type = CAR_CONTENT_TYPE;
	ctx.body = Buffer.from(
		await blocksToCarFile(parseCid(identity.repoCommitCid), blocks),
	);
});

/** レコード 1 件と、コミットからそのレコードまでの証明を CAR で返す */
router.get("/xrpc/com.atproto.sync.getRecord", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx);
	if (identity == null) return;

	const collection = queryString(ctx, "collection");
	const rkey = queryString(ctx, "rkey");
	if (!collection || !rkey) {
		return xrpcError(ctx, 400, "InvalidRequest", "collection and rkey are required");
	}

	const storage = new DbRepoStorage(identity.userId, db.manager);
	const commitCid = parseCid(identity.repoCommitCid);

	// 無いレコードは、証明を返さずにエラーにする（公式 PDS と同じ）
	const repo = await Repo.load(storage, commitCid);
	if ((await repo.data.get(`${collection}/${rkey}`)) == null) {
		return xrpcError(ctx, 404, "RecordNotFound", "Could not locate record");
	}

	ctx.type = CAR_CONTENT_TYPE;
	ctx.body = await collectBytes(
		getRecords(storage, commitCid, [{ collection, rkey }]),
	);
});

/** 指定したブロックを CAR で返す */
router.get("/xrpc/com.atproto.sync.getBlocks", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx);
	if (identity == null) return;

	// 同じ CID が重なっていると件数の比べ方がずれるので、先に重なりを除く
	const raw = ctx.query.cids;
	const cidStrs = [...new Set(Array.isArray(raw) ? raw : raw ? [raw] : [])].slice(
		0,
		GET_BLOCKS_MAX,
	);

	// 形の正しくない CID が混じっていたら、まとめてエラーにする
	let cids: Cid[];
	try {
		cids = cidStrs.map((c) => parseCid(c));
	} catch {
		return xrpcError(ctx, 400, "InvalidRequest", "invalid cid");
	}

	const rows = await AtprotoRepoBlocks.find({
		where: { userId: identity.userId, cid: In(cids.map((c) => c.toString())) },
		select: ["cid", "content"],
	});
	if (rows.length !== cids.length) {
		return xrpcError(ctx, 400, "BlockNotFound", "Could not find all blocks");
	}

	const blocks = new BlockMap();
	for (const row of rows) {
		blocks.set(parseCid(row.cid), new Uint8Array(row.content));
	}
	ctx.type = CAR_CONTENT_TYPE;
	ctx.body = Buffer.from(await blocksToCarFile(null, blocks));
});

// #endregion

// #region blob

/**
 * blob（プロフィールのアイコン・バナー）の中身を返す。
 *
 * @remarks
 * - Bluesky の画像配信（CDN）は、DID の文書に書いた PDS（ここ）へ、この窓口で画像を取りに来る。
 * - 中身は CID で決まって変わらないので、長くキャッシュさせてよい。
 * - 公式 PDS と同じく、ブラウザがこの応答を HTML などとして解釈しないようにするヘッダーを付ける。
 */
router.get("/xrpc/com.atproto.sync.getBlob", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx);
	if (identity == null) return;

	const cid = queryString(ctx, "cid");
	if (!cid) return xrpcError(ctx, 400, "InvalidRequest", "cid is required");

	const blob = await AtprotoBlobs.findOne({
		where: { userId: identity.userId, cid },
		select: ["mimeType", "content"],
	});
	if (blob == null) return xrpcError(ctx, 404, "BlobNotFound", "Blob not found");

	ctx.set("Cache-Control", "public, max-age=31536000, immutable");
	ctx.set("X-Content-Type-Options", "nosniff");
	ctx.set("Content-Security-Policy", "default-src 'none'; sandbox");
	ctx.type = blob.mimeType;
	ctx.body = blob.content;
});

/**
 * レポジトリの持ち主の blob の CID を一覧で返す。
 *
 * @remarks
 * - 並びは CID の文字列順。`cursor` には、前の応答の最後の CID を渡す。
 * - NOTE: `since`（ある rev より後に足した blob だけ）は見ない。blob は rev を持っていないため。
 *   全部を返しても、受け取る側は余分なものを取りに来るだけで困らない。
 */
router.get("/xrpc/com.atproto.sync.listBlobs", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	const identity = await findRepo(ctx);
	if (identity == null) return;

	const limit = Math.min(
		Math.max(Number(queryString(ctx, "limit")) || LIST_BLOBS_DEFAULT_LIMIT, 1),
		LIST_BLOBS_MAX_LIMIT,
	);
	const cursor = queryString(ctx, "cursor");

	const rows = await AtprotoBlobs.find({
		where: {
			userId: identity.userId,
			...(cursor ? { cid: MoreThan(cursor) } : {}),
		},
		select: ["cid"],
		order: { cid: "ASC" },
		take: limit,
	});

	ctx.body = {
		cids: rows.map((r) => r.cid),
		// 1 回分いっぱいに返したときだけ、続きがあるかもしれないので cursor を付ける
		...(rows.length === limit ? { cursor: rows[rows.length - 1].cid } : {}),
	};
});

// #endregion

// #region その他の XRPC

/**
 * 用意していない XRPC は 501 にする（PDS 本体のホスト名のときだけ）。
 *
 * @remarks
 * `subscribeRepos` は WebSocket として先に扱われるので、ここには来ない。
 * ただし WebSocket でなく普通の HTTP で来たときはここに来て 501 になる。
 */
router.all("/xrpc/(.*)", async (ctx, next) => {
	if (!isPdsHost(ctx)) return await next();
	xrpcError(ctx, 501, "MethodNotImplemented", "Method Not Implemented");
});

// #endregion

export default router;
