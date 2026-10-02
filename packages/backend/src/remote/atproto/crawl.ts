/**
 * @packageDocumentation
 *
 * Relay に、自前 PDS を読みに来てもらうよう頼む（`com.atproto.sync.requestCrawl`）。
 *
 * @remarks
 * - Relay は頼まれると、自前 PDS の `subscribeRepos` につないで、以後の出来事を受け取るようになる。
 * - 今は管理者用 API（`admin/atproto/request-crawl`）から手で呼ぶ。最初に 1 回呼べばよい。
 *   NOTE: Relay は長くつながらない PDS を外すことがある。外れたら、もう一度呼ぶ。
 *   IDEA: 定期的に（1 日 1 回など）自動で呼ぶ。
 * - Relay には、新しい PDS が持てるアカウントの数に上限がある（評判に応じて増える）。
 *
 * @see {@link https://atproto.com/specs/sync | Sync の仕様}
 * @internal
 */

import config from "@/config/index.js";
import { getResponse } from "@/misc/fetch.js";
import { getAtprotoConfig } from "./config.js";

/**
 * Relay 1 か所への頼みの結果。
 *
 * @internal
 */
export type RequestCrawlResult = {
	/** Relay のホスト名 */
	relay: string;
	/** 受け付けられたか */
	ok: boolean;
	/** 失敗したときの理由 */
	error?: string;
};

/**
 * 設定にある Relay すべてに requestCrawl を送る。
 *
 * @remarks
 * 1 か所が失敗しても、ほかの Relay には送る。結果は Relay ごとに返す。
 *
 * @returns Relay ごとの結果
 * @throws ブリッジが無効なとき
 * @internal
 */
export async function requestCrawl(): Promise<RequestCrawlResult[]> {
	const { enabled, pdsHostname, relayHosts } = getAtprotoConfig();
	if (!enabled) throw new Error("the Bluesky bridge is disabled (atproto.enabled)");

	const results: RequestCrawlResult[] = [];
	for (const relay of relayHosts) {
		try {
			await getResponse({
				url: `https://${relay}/xrpc/com.atproto.sync.requestCrawl`,
				method: "POST",
				body: JSON.stringify({ hostname: pdsHostname }),
				headers: {
					"User-Agent": config.userAgent,
					"Content-Type": "application/json",
				},
				timeout: 10 * 1000,
			});
			results.push({ relay, ok: true });
		} catch (err) {
			// 失敗した Relay の理由を残して、次の Relay に進む
			results.push({ relay, ok: false, error: String(err) });
		}
	}
	return results;
}
