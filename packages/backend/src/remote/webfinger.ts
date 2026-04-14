/**
 * @packageDocumentation
 *
 * WebFinger（`/.well-known/webfinger`）の取得。
 *
 * @remarks
 * - **役割**: `resource` に応じた JRD を取得する。短 TTL のメモリキャッシュで同一クエリの並列・連打を抑える。
 * - **失敗時**: キャッシュしない（`Cache.fetch` の fetcher が throw した場合は保存されず、結合先も同じ例外）。
 *
 * @internal
 */
import { createHash } from "node:crypto";
import { URL } from "node:url";
import { getJson } from "@/misc/fetch.js";
import { query as urlQuery } from "@/prelude/url.js";
import { Cache } from "@/misc/cache.js";

const WEBFINGER_CACHE_TTL_MS = 600_000;

type ILink = {
	href: string;
	rel?: string;
};

type IWebFinger = {
	links: ILink[];
	subject: string;
};

const webfingerResponseCache = new Cache<IWebFinger>(WEBFINGER_CACHE_TTL_MS);

function webfingerCacheKey(query: string): string {
	return createHash("sha256").update(query, "utf8").digest("hex");
}

export default async function (query: string): Promise<IWebFinger> {
	const url = genUrl(query);
	const key = webfingerCacheKey(query);
	return await webfingerResponseCache.fetch(key, async () => {
		return (await getJson(
			url,
			"application/jrd+json, application/json",
		)) as IWebFinger;
	});
}

function genUrl(query: string) {
	if (query.match(/^https?:\/\//)) {
		const u = new URL(query);
		return `${u.protocol}//${u.hostname}/.well-known/webfinger?${urlQuery({
			resource: query,
		})}`;
	}

	const m = query.match(/^([^@]+)@(.*)/);
	if (m) {
		const hostname = m[2];
		return `https://${hostname}/.well-known/webfinger?${urlQuery({
			resource: `acct:${query}`,
		})}`;
	}

	throw new Error(`Invalid query (${query})`);
}
