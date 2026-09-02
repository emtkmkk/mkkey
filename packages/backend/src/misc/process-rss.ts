/**
 * @packageDocumentation
 *
 * 自プロセスの RSS を `/proc` から読む。
 *
 * @remarks
 * - **なぜ必要か**: `process.memoryUsage().rss` はこのアプリでは信用できない。
 *   libuv の `uv_resident_set_memory()` は `/proc/self/stat` を「最初の `)` までが
 *   comm」として切り出すが、{@link boot/index} が `process.title` を
 *   `Calckey (web) (worker) <0>` のように設定するため、15 文字で切られた comm が
 *   `Calckey (web) (` となり **括弧が閉じない**。結果としてフィールド位置がずれ、
 *   RSS のつもりで仮想サイズ相当の値（テラバイト級）が返る。
 * - **対処**: comm フィールドを持たない `/proc/self/statm` から resident ページ数を
 *   読む。実測で `VmRSS` と完全一致する。`heapUsed` 等 V8 内部の値は影響を受けない
 *   ので `process.memoryUsage()` のまま使ってよい。
 *
 * @internal
 */
import fs from "node:fs";
import os from "node:os";

/** Linux x86_64 のページサイズ。`getconf PAGESIZE` で確認済み。 */
const PAGE_SIZE = 4096;
/** 物理メモリの何倍までを「有り得る RSS」とみなすか（スワップ込みでも超えない値）。 */
const SANITY_FACTOR = 2;

/**
 * `/proc/self/statm` から RSS をバイト単位で読む。
 *
 * @returns RSS（バイト）。`/proc` が無い・読めない・解釈できない場合は null
 * @internal
 */
export function readProcRssBytes(): number | null {
	try {
		// statm: size resident shared text lib data dt （単位はページ）
		const fields = fs.readFileSync("/proc/self/statm", "utf8").split(" ");
		const residentPages = Number(fields[1]);
		if (!Number.isFinite(residentPages) || residentPages <= 0) return null;
		return residentPages * PAGE_SIZE;
	} catch {
		return null;
	}
}

/**
 * 信頼できる RSS を返す。`/proc` を優先し、駄目なら `process.memoryUsage().rss` に落ちる。
 *
 * @param fallbackRss - `process.memoryUsage().rss`
 * @returns RSS（バイト）。どちらも有り得ない値なら null
 * @internal
 */
export function resolveRssBytes(fallbackRss: number): number | null {
	const rss = readProcRssBytes() ?? fallbackRss;
	if (!Number.isFinite(rss) || rss <= 0) return null;
	// 上記のズレを踏んだ値（テラバイト級）を弾く
	if (rss > os.totalmem() * SANITY_FACTOR) return null;
	return rss;
}
