/**
 * @packageDocumentation
 *
 * node_exporter の値を、サーバーメトリクスのウィジェットが使う形に変換する。
 *
 * @remarks
 * - 責務: 取得した値の「整理」と「前回との差分計算」だけ。通信や定期実行は
 *   {@link ../daemons/db-server-stats.ts} が受け持つ。テストしやすいように副作用を持たない。
 * - 出力の形と単位は web サーバ用の {@link ../daemons/server-stats.ts} にそろえる。
 *   そうすると、クライアントの表示部品（`widgets/server-metric/*.vue`）をそのまま使える。
 *   - `cpu`: 0〜1 の使用率
 *   - `mem.*`: バイト（`mem.used` だけは計算方法が web 側と違う。{@link memUsed} を参照）
 *   - `net.rx` / `net.tx`: 1 秒あたりのバイト数
 *   - `fs.r` / `fs.w`: 1 秒あたりの読み書きの回数（バイト数ではない）
 * - node_exporter の値は起動からの累計なので、2 回ぶんの値が無いと使用率は出せない。
 *
 * @internal
 */
import type { PrometheusSample } from "./prometheus-text.js";

/**
 * 読み取るメトリクス名。
 *
 * @remarks
 * これ以外の行はパーサーが値を解釈せずに読み飛ばす。項目を増やすときはここにも足す。
 *
 * @internal
 */
export const nodeExporterMetricNames: ReadonlySet<string> = new Set([
	"node_cpu_seconds_total",
	"node_memory_MemTotal_bytes",
	"node_memory_MemFree_bytes",
	"node_memory_MemAvailable_bytes",
	"node_memory_Buffers_bytes",
	"node_memory_Cached_bytes",
	"node_memory_Active_bytes",
	"node_memory_SwapTotal_bytes",
	"node_memory_SwapFree_bytes",
	"node_load1",
	"node_load5",
	"node_load15",
	"node_network_receive_bytes_total",
	"node_network_transmit_bytes_total",
	"node_disk_reads_completed_total",
	"node_disk_writes_completed_total",
	"node_filesystem_size_bytes",
	"node_filesystem_free_bytes",
]);

/**
 * どの NIC・ディスク・マウント先を見るかの指定。
 *
 * @remarks
 * 省略すると自動で選ぶ（NIC とディスクは累計の通信量・読み書き回数が最も多いもの、マウント先は `/`）。
 *
 * @internal
 */
export type NodeExporterTargetOptions = {
	/** NIC 名（例: `eth0`、`ens3`） */
	networkDevice?: string;
	/** ディスク名（例: `vda`） */
	diskDevice?: string;
	/** マウント先 @defaultValue `"/"` */
	mountpoint?: string;
};

/**
 * ある時点の node_exporter の値を整理したもの（累計値のまま）。
 *
 * @remarks
 * 値が取れなかった項目は `null`。`device` を持つ項目は、前回と同じ機器のときだけ差分を取る。
 *
 * @internal
 */
export type NodeExporterSnapshot = {
	/** 取得した時刻（ミリ秒）。差分の経過時間に使う */
	at: number;
	cpu: {
		/** 全コア・全モードの累計秒数 */
		totalSeconds: number;
		/** idle と iowait の累計秒数 */
		idleSeconds: number;
		/** 論理コア数 */
		cores: number;
	} | null;
	mem: {
		total: number;
		free: number;
		/** カーネルが見積もった「すぐ使える量」。古いカーネルでは取れないので null */
		available: number | null;
		buffers: number;
		cached: number;
		active: number;
		swapTotal: number;
		swapFree: number;
	} | null;
	load: { "1": number; "5": number; "15": number } | null;
	net: { device: string; rx: number; tx: number } | null;
	disk: { device: string; reads: number; writes: number } | null;
	fs: { mountpoint: string; size: number; free: number } | null;
};

/**
 * 配信する DB サーバの統計。`serverStats` と同じ形に、swap と load average を足したもの。
 *
 * @internal
 */
export type DbServerStats = {
	cpu: number;
	mem: { total: number; used: number; active: number };
	swap: { total: number; used: number };
	load: { "1": number; "5": number; "15": number } | null;
	net: { rx: number; tx: number };
	fs: { r: number; w: number };
};

/**
 * DB サーバの静的な情報。`server-info` と同じ形。
 *
 * @internal
 */
export type DbServerInfo = {
	cpu: { model: string; cores: number };
	mem: { total: number };
	fs: { total: number; used: number };
	net: { interface: string | null };
};

const roundCpu = (num: number) => Math.round(num * 1000) / 1000;
const round = (num: number) => Math.round(num * 10) / 10;

/** 自動選択で除外する NIC 名（ループバックやコンテナ用の仮想 NIC） */
const ignoredNetworkDevice = /^(lo|docker\d*|veth.*|br-.*|virbr\d*)$/;

/**
 * パーサーの出力を、時点の値（累計値）に整理する。
 *
 * @param samples - {@link parsePrometheusText} の出力
 * @param at - 取得した時刻（ミリ秒）
 * @param options - 見る機器の指定
 * @returns 整理した値
 * @internal
 */
export function toNodeExporterSnapshot(
	samples: PrometheusSample[],
	at: number,
	options: NodeExporterTargetOptions = {},
): NodeExporterSnapshot {
	const single = (name: string): number | null =>
		samples.find((s) => s.name === name)?.value ?? null;

	// #region CPU
	let cpu: NodeExporterSnapshot["cpu"] = null;
	const cpuSamples = samples.filter((s) => s.name === "node_cpu_seconds_total");
	if (cpuSamples.length > 0) {
		const cores = new Set(cpuSamples.map((s) => s.labels.cpu)).size;
		let totalSeconds = 0;
		let idleSeconds = 0;
		for (const s of cpuSamples) {
			totalSeconds += s.value;
			// iowait は「ディスク待ちで何もしていない」時間なので、使用中に数えない
			if (s.labels.mode === "idle" || s.labels.mode === "iowait") {
				idleSeconds += s.value;
			}
		}
		cpu = { totalSeconds, idleSeconds, cores };
	}
	// #endregion

	// #region メモリ
	let mem: NodeExporterSnapshot["mem"] = null;
	const memTotal = single("node_memory_MemTotal_bytes");
	if (memTotal != null) {
		mem = {
			total: memTotal,
			free: single("node_memory_MemFree_bytes") ?? 0,
			available: single("node_memory_MemAvailable_bytes"),
			buffers: single("node_memory_Buffers_bytes") ?? 0,
			cached: single("node_memory_Cached_bytes") ?? 0,
			active: single("node_memory_Active_bytes") ?? 0,
			swapTotal: single("node_memory_SwapTotal_bytes") ?? 0,
			swapFree: single("node_memory_SwapFree_bytes") ?? 0,
		};
	}

	const load1 = single("node_load1");
	const load =
		load1 == null
			? null
			: {
					"1": load1,
					"5": single("node_load5") ?? 0,
					"15": single("node_load15") ?? 0,
				};
	// #endregion

	// #region ネットワーク・ディスク
	const net = pickDevice(
		samples,
		"node_network_receive_bytes_total",
		"node_network_transmit_bytes_total",
		options.networkDevice,
		(device) => !ignoredNetworkDevice.test(device),
	);
	const disk = pickDevice(
		samples,
		"node_disk_reads_completed_total",
		"node_disk_writes_completed_total",
		options.diskDevice,
		() => true,
	);
	// #endregion

	// #region ファイルシステム
	const mountpoint = options.mountpoint ?? "/";
	const fsSize = samples.find(
		(s) =>
			s.name === "node_filesystem_size_bytes" &&
			s.labels.mountpoint === mountpoint,
	);
	const fsFree = samples.find(
		(s) =>
			s.name === "node_filesystem_free_bytes" &&
			s.labels.mountpoint === mountpoint,
	);
	const fs =
		fsSize && fsFree
			? { mountpoint, size: fsSize.value, free: fsFree.value }
			: null;
	// #endregion

	return {
		at,
		cpu,
		mem,
		load,
		net: net ? { device: net.device, rx: net.a, tx: net.b } : null,
		disk: disk ? { device: disk.device, reads: disk.a, writes: disk.b } : null,
		fs,
	};
}

/**
 * `device` ラベルを持つ 2 つのメトリクスから、見る機器を 1 つ選ぶ。
 *
 * @remarks
 * 指定があればその機器を使う。無ければ、2 つの値の合計が最も大きい機器を選ぶ
 * （普段いちばん使われている NIC・ディスクを表示したいため）。
 *
 * @param samples - パーサーの出力
 * @param nameA - 1 つ目のメトリクス名（受信 / 読み込み）
 * @param nameB - 2 つ目のメトリクス名（送信 / 書き込み）
 * @param wantedDevice - 指定された機器名
 * @param allowAuto - 自動選択の候補にしてよいか
 * @returns 選んだ機器と 2 つの値。候補が無ければ `null`
 * @internal
 */
function pickDevice(
	samples: PrometheusSample[],
	nameA: string,
	nameB: string,
	wantedDevice: string | undefined,
	allowAuto: (device: string) => boolean,
): { device: string; a: number; b: number } | null {
	const byDevice = new Map<string, { a: number; b: number }>();
	for (const s of samples) {
		if (s.name !== nameA && s.name !== nameB) continue;
		const device = s.labels.device;
		if (device == null) continue;
		const entry = byDevice.get(device) ?? { a: 0, b: 0 };
		if (s.name === nameA) entry.a = s.value;
		else entry.b = s.value;
		byDevice.set(device, entry);
	}

	if (wantedDevice != null) {
		const entry = byDevice.get(wantedDevice);
		return entry ? { device: wantedDevice, ...entry } : null;
	}

	let best: { device: string; a: number; b: number } | null = null;
	for (const [device, entry] of byDevice) {
		if (!allowAuto(device)) continue;
		if (best == null || entry.a + entry.b > best.a + best.b) {
			best = { device, ...entry };
		}
	}
	return best;
}

/**
 * 2 回ぶんの値から、配信する統計を計算する。
 *
 * @remarks
 * - CPU とメモリが取れていなければ `null`（グラフの形を保てないため）。
 * - 経過時間が 0 以下のとき、または累計値が減っているとき（node_exporter や OS の再起動）は
 *   `null` を返し、その回は配信しない。
 * - NIC・ディスクが前回と違う機器になったときは、その項目だけ 0 にする。
 *
 * @param prev - 前回の値
 * @param cur - 今回の値
 * @returns 配信する統計。計算できなければ `null`
 * @internal
 */
export function computeDbServerStats(
	prev: NodeExporterSnapshot,
	cur: NodeExporterSnapshot,
): DbServerStats | null {
	const elapsedSec = (cur.at - prev.at) / 1000;
	if (!(elapsedSec > 0)) return null;
	if (!(prev.cpu && cur.cpu && cur.mem)) return null;

	const cpuTotal = cur.cpu.totalSeconds - prev.cpu.totalSeconds;
	const cpuIdle = cur.cpu.idleSeconds - prev.cpu.idleSeconds;
	if (cpuTotal < 0 || cpuIdle < 0) return null;
	// 間隔が短すぎて CPU 時間が進んでいないときは 0% とみなす
	const cpu = cpuTotal > 0 ? Math.min(1, Math.max(0, 1 - cpuIdle / cpuTotal)) : 0;

	/** 同じ機器の累計値の差を 1 秒あたりにする。機器が変わったか値が減ったときは 0 */
	const perSec = <T extends { device: string }>(
		a: T | null,
		b: T | null,
		pick: (x: T) => number,
	): number => {
		if (!(a && b) || a.device !== b.device) return 0;
		const delta = pick(b) - pick(a);
		return delta < 0 ? 0 : delta / elapsedSec;
	};

	const m = cur.mem;
	return {
		cpu: roundCpu(cpu),
		mem: {
			total: round(m.total),
			used: round(Math.max(0, memUsed(m))),
			active: round(m.active),
		},
		swap: {
			total: round(m.swapTotal),
			used: round(Math.max(0, m.swapTotal - m.swapFree)),
		},
		load: cur.load,
		net: {
			rx: round(perSec(prev.net, cur.net, (x) => x.rx)),
			tx: round(perSec(prev.net, cur.net, (x) => x.tx)),
		},
		fs: {
			r: round(perSec(prev.disk, cur.disk, (x) => x.reads)),
			w: round(perSec(prev.disk, cur.disk, (x) => x.writes)),
		},
	};
}

/**
 * 使用中のメモリ量を求める。
 *
 * @remarks
 * `MemTotal − MemAvailable`（今の `free` コマンドの used と同じ考え方）を使う。
 * NB: web 側（{@link ../daemons/server-stats.ts}）の「used − buffers − cached」とは、わざと変えている。
 * PostgreSQL の shared_buffers は共有メモリ（Shmem）で、Linux では `Cached` に数えられる。
 * そのため Cached を引くと、shared_buffers（mk1 では約 6GB）が丸ごと「使っていない」扱いになってしまう。
 * MemAvailable は、Shmem のように解放できないキャッシュを差し引いて見積もられているので、この問題が起きない。
 * MemAvailable が取れない古いカーネルのときだけ、web 側と同じ計算にする。
 *
 * @param m - メモリの値
 * @returns 使用中のメモリ量（バイト）
 * @internal
 */
function memUsed(m: NonNullable<NodeExporterSnapshot["mem"]>): number {
	if (m.available != null) return m.total - m.available;
	return m.total - m.free - m.buffers - m.cached;
}

/**
 * 1 回ぶんの値から、DB サーバの静的な情報を作る。
 *
 * @param cur - 今回の値
 * @param cpuModel - CPU の型番（node_exporter では取れないので設定から渡す）
 * @returns 静的な情報。CPU・メモリ・ファイルシステムのどれかが取れていなければ `null`
 * @internal
 */
export function toDbServerInfo(
	cur: NodeExporterSnapshot,
	cpuModel: string,
): DbServerInfo | null {
	if (!(cur.cpu && cur.mem && cur.fs)) return null;
	return {
		cpu: { model: cpuModel, cores: cur.cpu.cores },
		mem: { total: cur.mem.total },
		fs: { total: cur.fs.size, used: Math.max(0, cur.fs.size - cur.fs.free) },
		net: { interface: cur.net?.device ?? null },
	};
}
