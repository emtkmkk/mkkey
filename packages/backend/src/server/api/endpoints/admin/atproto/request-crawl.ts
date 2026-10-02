/**
 * @packageDocumentation
 *
 * 管理者が、Relay に自前 PDS を読みに来てもらうよう頼む API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/request-crawl`
 * - 設定（`atproto.relayHosts`）にある Relay すべてに送り、Relay ごとの結果を返す。
 * - 最初に 1 回呼べばよい。Relay から外れたときは、もう一度呼ぶ。
 *
 * @see {@link ../../../../../remote/atproto/crawl.ts} requestCrawl
 * @internal
 */
import define from "../../../define.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { requestCrawl } from "@/remote/atproto/crawl.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description: "Relay に、Bluesky ブリッジの自前 PDS を読みに来てもらうよう頼む。",
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const results = await requestCrawl();
	await insertModerationLog(me, "atprotoRequestCrawl", { results });
	return results;
});
