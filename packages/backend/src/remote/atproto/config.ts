/**
 * @packageDocumentation
 *
 * Bluesky（AT Protocol）ブリッジの設定を、既定値を補った形で返す。
 *
 * @remarks
 * - `config.atproto` を直接読まず、必ずここを通す。既定値を 1 か所にまとめるため。
 * - 設定ファイルは起動時に 1 回だけ読まれるので、結果は最初の呼び出しで作って使い回す。
 * - ブリッジの範囲: Bluesky ユーザーの検索・フォロー・投稿の取り込みと、follow / like の送信だけ。mkkey の投稿は送らない。
 *
 * @see {@link ../../config/types.ts | Source.atproto} 設定の説明
 * @internal
 */

import config from "@/config/index.js";

// #region 型

/**
 * 既定値を補ったブリッジ設定。
 *
 * @remarks
 * `enabled` が false のとき、ほかの値は使わない（ホスト名が空でもよい）。
 *
 * @internal
 */
export type AtprotoConfig = {
	/** ブリッジを動かすか */
	enabled: boolean;
	/** 自前 PDS のホスト名（例: `bsky.mkkey.net`） */
	pdsHostname: string;
	/** Bluesky ユーザーを保存するときの `user.host` */
	bridgeHost: string;
	/** DID:plc のディレクトリの URL（末尾の `/` なし） */
	plcUrl: string;
	/** 公開 AppView の URL（末尾の `/` なし） */
	appViewUrl: string;
	/** Jetstream の購読 URL */
	jetstreamUrl: string;
	/** requestCrawl を送る Relay のホスト名 */
	relayHosts: string[];
	/** 一般公開するか。false の間は、Bluesky ユーザーを新しく取り込めるのは管理者用 API だけ */
	publicAccess: boolean;
};

// #endregion

// #region 定数

/** 既定の DID:plc ディレクトリ */
const DEFAULT_PLC_URL = "https://plc.directory";
/** 既定の公開 AppView。ログイン無しで使える */
const DEFAULT_APPVIEW_URL = "https://public.api.bsky.app";
/** 既定の Jetstream（Bluesky 社の公開インスタンス） */
const DEFAULT_JETSTREAM_URL =
	"wss://jetstream2.us-east.bsky.network/subscribe";
/** 既定の Relay */
const DEFAULT_RELAY_HOSTS = ["bsky.network"];

// #endregion

/** 一度作った設定の置き場所。設定ファイルは起動中に変わらないので使い回す */
let cached: AtprotoConfig | null = null;

/**
 * 既定値を補ったブリッジ設定を返す。
 *
 * @remarks
 * - `enabled: true` なのに `pdsHostname` が無いときは、起動直後に気づけるよう例外にする。
 * - ホスト名は小文字にそろえる。`user.host` は小文字で保存されているため。
 *
 * @returns ブリッジ設定
 * @throws `enabled: true` で `pdsHostname` が未指定のとき
 * @internal
 */
export function getAtprotoConfig(): AtprotoConfig {
	if (cached) return cached;

	const src = config.atproto ?? {};
	const enabled = src.enabled === true;
	const pdsHostname = (src.pdsHostname ?? "").trim().toLowerCase();

	// 有効なのにホスト名が無いと、ハンドルも保存先の host も作れない
	if (enabled && !pdsHostname) {
		throw new Error("atproto.enabled is true, but atproto.pdsHostname is not set.");
	}

	cached = {
		enabled,
		pdsHostname,
		bridgeHost: (src.bridgeHost ?? pdsHostname).trim().toLowerCase(),
		plcUrl: trimTrailingSlash(src.plcUrl ?? DEFAULT_PLC_URL),
		appViewUrl: trimTrailingSlash(src.appViewUrl ?? DEFAULT_APPVIEW_URL),
		jetstreamUrl: src.jetstreamUrl ?? DEFAULT_JETSTREAM_URL,
		relayHosts: src.relayHosts ?? DEFAULT_RELAY_HOSTS,
		publicAccess: src.publicAccess === true,
	};
	return cached;
}

/**
 * URL の末尾の `/` を取り除く。
 *
 * @param url - 対象の URL
 * @returns 末尾の `/` を除いた URL
 * @internal
 */
function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, "");
}
