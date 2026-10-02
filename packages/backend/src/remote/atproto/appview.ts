/**
 * @packageDocumentation
 *
 * 公開 AppView（ログイン無しで使える Bluesky の読み取り API）などに問い合わせ、Bluesky ユーザーや投稿の情報を調べる。
 *
 * @remarks
 * - follow には相手の DID、like には投稿の URI と CID の組（`subject`）が要る。
 *   人が渡しやすいハンドルや `bsky.app` の URL から、これらを引くのがこのファイルの役目。
 * - 問い合わせ先は設定の `atproto.appViewUrl`（既定は `https://public.api.bsky.app`）。
 * - Bluesky ユーザーの取り込み（{@link ./actor.ts}）でも、プロフィールと PDS の場所を引くのに使う。
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

/**
 * AppView の `app.bsky.actor.getProfile` が返すプロフィール（使う項目だけ）。
 *
 * @remarks
 * AppView が返す値をそのまま信じず、使う側で形を確かめること（{@link fetchProfile} が最低限の確認をする）。
 *
 * @internal
 */
export type BlueskyProfile = {
	did: string;
	/** 今のハンドル。確かめられなかった人は `handle.invalid` */
	handle: string;
	displayName?: string;
	description?: string;
	/** アイコンの画像 URL（Bluesky の CDN） */
	avatar?: string;
	/** バナーの画像 URL（Bluesky の CDN） */
	banner?: string;
	followersCount?: number;
	followsCount?: number;
	postsCount?: number;
	/** プロフィールに付いた印（本人が付けたものと、モデレーションが付けたもの） */
	labels?: { val: string; src: string }[];
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
	return (await fetchProfile(actor)).did;
}

/**
 * ハンドルか DID から、プロフィールを引く。
 *
 * @remarks
 * - 先頭の `@` は付いていてもよい。
 * - AppView はハンドルを確かめた結果を返す（確かめられなければ `handle.invalid`）ので、ハンドルは自分で確かめ直さない。
 *
 * @param actor - ハンドルか DID
 * @returns プロフィール
 * @throws AppView に見つからないとき（停止・削除されたアカウントを含む）、応答の形がおかしいとき
 * @internal
 */
export async function fetchProfile(actor: string): Promise<BlueskyProfile> {
	const { appViewUrl } = getAtprotoConfig();
	const normalized = actor.trim().replace(/^@/, "");

	const profile = (await getJson(
		`${appViewUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(
			normalized,
		)}`,
	)) as Partial<BlueskyProfile>;
	if (
		typeof profile.did !== "string" ||
		!profile.did.startsWith("did:") ||
		typeof profile.handle !== "string"
	) {
		throw new Error(`actor not found: ${actor}`);
	}
	return profile as BlueskyProfile;
}

/**
 * DID の文書から、アカウントを置いている PDS のホスト名を引く。
 *
 * @remarks
 * - `did:plc` は plc.directory に、`did:web` はそのドメインの `/.well-known/did.json` に問い合わせる。
 * - 記録のためだけに使うので、調べられなかったときは例外にせず null を返す。
 *
 * @param did - 対象の DID
 * @returns PDS のホスト名。調べられなかったときは null
 * @internal
 */
export async function fetchPdsHost(did: string): Promise<string | null> {
	const { plcUrl } = getAtprotoConfig();

	let url: string;
	if (did.startsWith("did:plc:")) {
		url = `${plcUrl}/${encodeURIComponent(did)}`;
	} else if (did.startsWith("did:web:")) {
		url = `https://${did.slice("did:web:".length)}/.well-known/did.json`;
	} else {
		return null;
	}

	try {
		const doc = (await getJson(url)) as {
			service?: { id?: unknown; serviceEndpoint?: unknown }[];
		};
		const pds = doc.service?.find((s) => s.id === "#atproto_pds");
		return typeof pds?.serviceEndpoint === "string"
			? new URL(pds.serviceEndpoint).hostname
			: null;
	} catch {
		// 記録用の値なので、取れなくても先に進める
		return null;
	}
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
