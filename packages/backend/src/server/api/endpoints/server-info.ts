/**
 * @packageDocumentation
 *
 * web サーバのマシン情報（CPU・メモリ・ディスク）を返すエンドポイント。
 *
 * @remarks
 * - サーバーメトリクスのウィジェットが、グラフの上限値（総メモリなど）を知るために使う。
 * - 管理者向けの詳細版は `admin/server-info`。
 * - CHANGED: 2026-11 から、ログインしていないと使えない（以前は未ログインでも取得できた）。
 *   統計の配信チャンネル（`serverStats` など）も同時にログイン必須にしている。
 *
 * @internal
 */
import * as os from "node:os";
import si from "systeminformation";
import define from "../define.js";

/**
 * エンドポイントの設定。
 *
 * @remarks
 * マシンの構成は外部に見せる必要がないため、ログイン必須にしている。
 * アプリトークンからも使えるように `read:account` を要求する。
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
	const memStats = await si.mem();
	const fsStats = await si.fsSize();

	return {
		machine: os.hostname(),
		cpu: {
			model: os.cpus()[0].model,
			cores: os.cpus().length,
		},
		mem: {
			total: memStats.total,
		},
		fs: {
			total: fsStats[0].size,
			used: fsStats[0].used,
		},
	};
});
