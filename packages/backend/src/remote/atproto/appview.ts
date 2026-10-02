/**
 * @packageDocumentation
 *
 * 公開 AppView（ログイン無しで使える Bluesky の読み取り API）に問い合わせ、follow / like の宛先を調べる。
 *
 * @remarks
 * - follow には相手の DID、like には投稿の URI と CID の組（`subject`）が要る。
 *   人が渡しやすいハンドルや `bsky.app` の URL から、これらを引くのがこのファイルの役目。
 * - 問い合わせ先は設定の `atproto.appViewUrl`（既定は `https://public.api.bsky.app`）。
 * - 今は試験用の管理者 API（`admin/atproto/test-write`）だけが使う。
 *   NOTE: Bluesky ユーザーの解決（実装手順 6）でも使い回す想定。
 *
 * @see {@link ./config.ts} 問い合わせ先の設定
 * @internal
 */

import { getJson } from "@/misc/fetch.js";
import { getAtprotoConfig } from "./config.js";

// #region 型

/**
 * like の `subject` に入れる、投稿の URI と CID の組。
 *
 * @internal
 */
export type StrongRef = {
	/** 投稿の URI（`at://<DID>/app.bsky.feed.post/<rkey>`。DID の形にそろえてある） */
	uri: string;
	/** 投稿の CID */
	cid: string;
};

// #endregion

// #region 定数

/** `bsky.app` の投稿 URL（`https://bsky.app/profile/<ハンドルか DID>/post/<rkey>`） */
const BSKY_APP_POST_URL =
	/^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/;

/** 投稿の `at://` URI（`at://<ハンドルか DID>/app.bsky.feed.post/<rkey>`） */
const AT_POST_URI = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/?#]+)$/;

// #endregion

// #region 公開メソッド

/**
 * ハンドルか DID から、相手の DID を引く。
 *
 * @remarks
 * - 先頭の `@` は付いていてもよい。
 * - DID を渡したときも AppView に問い合わせる。Bluesky に実在しない DID に follow を書かないため。
 *
 * @param actor - ハンドル（例: `alice.bsky.social`）か DID（例: `did:plc:xxx`）
 * @returns 相手の DID
 * @throws AppView に見つからないとき
 * @internal
 */
export async function resolveActorDid(actor: string): Promise<string> {
	const { appViewUrl } = getAtprotoConfig();
	const normalized = actor.trim().replace(/^@/, "");

	const profile = (await getJson(
		`${appViewUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(
			normalized,
		)}`,
	)) as { did?: unknown };
	if (typeof profile.did !== "string" || !profile.did.startsWith("did:")) {
		throw new Error(`actor not found: ${actor}`);
	}
	return profile.did;
}

/**
 * 投稿の URL か URI から、like の `subject` に入れる URI と CID の組を引く。
 *
 * @remarks
 * - `https://bsky.app/profile/<ハンドルか DID>/post/<rkey>` と `at://...` の両方を受け付ける。
 * - ハンドルで書かれていても、返す URI は DID の形にする。ハンドルは変わることがあるため。
 *
 * @param post - 投稿の URL か `at://` URI
 * @returns 投稿の URI と CID
 * @throws 形がどちらでもないとき、AppView に投稿が見つからないとき
 * @internal
 */
export async function resolvePostRef(post: string): Promise<StrongRef> {
	const { appViewUrl } = getAtprotoConfig();

	const match = post.trim().match(BSKY_APP_POST_URL) ?? post.trim().match(AT_POST_URI);
	if (match == null) throw new Error(`not a Bluesky post URL or URI: ${post}`);
	const [, actor, rkey] = match;

	const did = actor.startsWith("did:") ? actor : await resolveActorDid(actor);
	const uri = `at://${did}/app.bsky.feed.post/${rkey}`;

	const res = (await getJson(
		`${appViewUrl}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`,
	)) as { posts?: { uri?: unknown; cid?: unknown }[] };
	const found = res.posts?.[0];
	if (found == null || typeof found.cid !== "string") {
		throw new Error(`post not found: ${post}`);
	}
	return { uri, cid: found.cid };
}

// #endregion
