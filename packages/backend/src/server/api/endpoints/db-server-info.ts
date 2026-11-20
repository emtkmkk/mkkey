/**
 * @packageDocumentation
 *
 * DB サーバのマシン情報（CPU・メモリ・ディスク）を返すエンドポイント。
 *
 * @remarks
 * - 「DB サーバーメトリクス」ウィジェットが、グラフの上限値（総メモリなど）を知るために使う。
 *   返す形は {@link ./server-info.ts} と同じ（`machine` は無い）。
 * - 値は master の {@link ../../../daemons/db-server-stats.ts} が持っている最新のものを Xev で問い合わせて返す。
 *   呼ばれるたびに DB サーバへ取りに行くことはしない（DB サーバに負荷をかけないため）。
 * - 設定 `dbServerMetrics` が無いとき、まだ一度も取得できていないとき、取得が続けて失敗しているときは `null`。
 *
 * @internal
 */
import Xev from "xev";
import config from "@/config/index.js";
import type { DbServerInfo } from "@/misc/node-exporter-metrics.js";
import define from "../define.js";

const ev = new Xev();

/** master からの返事を待つ上限（ミリ秒） */
const replyTimeoutMs = 2000;

/**
 * エンドポイントの設定。
 *
 * @remarks
 * `server-info` と同じく、ログイン必須で `read:account` を要求する。
 *
 * @internal
 */
export const meta = {
	requireCredential: true,

	kind: "read:account",

	tags: ["meta"],
} as const;

/**
 * 引数の定義。引数は取らない。
 *
 * @internal
 */
export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	// 設定が無ければデーモンは動いていないので、問い合わせずに返す
	if (!config.dbServerMetrics?.url) return null;
	return await requestDbServerInfo();
});

/**
 * master のデーモンに、最新の静的な情報を問い合わせる。
 *
 * @remarks
 * 返事が来なければ（master の起動直後など）{@link replyTimeoutMs} で諦めて `null` を返す。
 *
 * @returns 最新の静的な情報。分からなければ `null`
 * @internal
 */
function requestDbServerInfo(): Promise<DbServerInfo | null> {
	return new Promise((resolve) => {
		const id = Math.random().toString(36).slice(2, 10);
		const eventName = `dbServerInfo:${id}`;
		const onReply = (info: DbServerInfo | null) => {
			clearTimeout(timer);
			resolve(info ?? null);
		};
		const timer = setTimeout(() => {
			ev.removeListener(eventName, onReply);
			resolve(null);
		}, replyTimeoutMs);
		ev.once(eventName, onReply);
		ev.emit("requestDbServerInfo", { id });
	});
}
