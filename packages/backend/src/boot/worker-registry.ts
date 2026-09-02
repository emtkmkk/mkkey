/**
 * @packageDocumentation
 *
 * クラスタワーカーの役割（mode / index / proxy）をプライマリ側で保持するレジストリ。
 *
 * @remarks
 * - **なぜ必要か**: `cluster.fork(env)` に渡した環境変数は、プライマリ側の
 *   `worker.process`（`ChildProcess`）からは読み出せない。`ChildProcess` に `env`
 *   プロパティは存在せず、実行時は常に `undefined` になる（Node v19 で実測）。
 *   このためワーカー終了時に「どの役割のワーカーが死んだか」を復元できず、
 *   役割不明として再 fork を諦めるしかなかった。
 * - **やること**: fork した時点で役割を `worker.id` 引きで覚えておき、
 *   終了ハンドラから引けるようにする。プライマリ専用の状態。
 *
 * @see {@link master} fork 時に {@link registerWorker} を呼ぶ
 * @see {@link boot/index} 終了時に {@link getWorkerInfo} で役割を引く
 * @internal
 */

/** ワーカーの役割。`cluster.fork` に渡す環境変数と同じ形。 */
export type WorkerInfo = {
	mode: "web" | "queue";
	/** ワーカースロットの番号（文字列。ログとスロットキーに使う） */
	index: string;
	/** プロキシ用 web ワーカーなら "1"、通常は "0" */
	proxy: string;
};

/** `worker.id` -> 役割。プライマリプロセスのみが触る。 */
const registry = new Map<number, WorkerInfo>();

/**
 * fork したワーカーの役割を記録する。
 * @param workerId - `cluster.fork()` が返した `worker.id`
 * @param info - そのワーカーの役割
 * @internal
 */
export function registerWorker(workerId: number, info: WorkerInfo): void {
	registry.set(workerId, info);
}

/**
 * 記録済みのワーカーの役割を返す。
 * @param workerId - 対象の `worker.id`
 * @returns 役割。未登録なら undefined
 * @internal
 */
export function getWorkerInfo(workerId: number): WorkerInfo | undefined {
	return registry.get(workerId);
}

/**
 * 終了したワーカーの記録を捨てる。
 * @param workerId - 対象の `worker.id`
 * @internal
 */
export function unregisterWorker(workerId: number): void {
	registry.delete(workerId);
}
