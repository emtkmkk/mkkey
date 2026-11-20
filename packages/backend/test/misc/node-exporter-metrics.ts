/**
 * @packageDocumentation
 *
 * Prometheus テキストのパーサーと、node_exporter の値から DB サーバの統計を計算する処理のテスト。
 *
 * @internal
 */
import * as assert from "assert";
import { parsePrometheusText } from "../../src/misc/prometheus-text.js";
import {
	computeDbServerStats,
	nodeExporterMetricNames,
	toDbServerInfo,
	toNodeExporterSnapshot,
} from "../../src/misc/node-exporter-metrics.js";

/** 2 コア・NIC 2 つ・ディスク 1 つの node_exporter の応答を作る。 */
function exporterText(v: {
	idle: number;
	user: number;
	iowait?: number;
	rx: number;
	tx: number;
	reads: number;
	writes: number;
	device?: string;
}): string {
	const device = v.device ?? "vda";
	return [
		"# HELP node_cpu_seconds_total Seconds the CPUs spent in each mode.",
		"# TYPE node_cpu_seconds_total counter",
		`node_cpu_seconds_total{cpu="0",mode="idle"} ${v.idle / 2}`,
		`node_cpu_seconds_total{cpu="0",mode="iowait"} ${(v.iowait ?? 0) / 2}`,
		`node_cpu_seconds_total{cpu="0",mode="user"} ${v.user / 2}`,
		`node_cpu_seconds_total{cpu="1",mode="idle"} ${v.idle / 2}`,
		`node_cpu_seconds_total{cpu="1",mode="iowait"} ${(v.iowait ?? 0) / 2}`,
		`node_cpu_seconds_total{cpu="1",mode="user"} ${v.user / 2}`,
		"node_memory_MemTotal_bytes 1.2e+10",
		"node_memory_MemFree_bytes 1e+09",
		"node_memory_Buffers_bytes 1e+08",
		"node_memory_Cached_bytes 4.9e+09",
		"node_memory_Active_bytes 7e+09",
		"node_memory_SwapTotal_bytes 2e+09",
		"node_memory_SwapFree_bytes 1.5e+09",
		"node_load1 1.5",
		"node_load5 1.25",
		"node_load15 1",
		`node_network_receive_bytes_total{device="lo"} 9e+12`,
		`node_network_transmit_bytes_total{device="lo"} 9e+12`,
		`node_network_receive_bytes_total{device="eth0"} ${v.rx}`,
		`node_network_transmit_bytes_total{device="eth0"} ${v.tx}`,
		`node_disk_reads_completed_total{device="${device}"} ${v.reads}`,
		`node_disk_writes_completed_total{device="${device}"} ${v.writes}`,
		`node_filesystem_size_bytes{device="/dev/vda1",fstype="ext4",mountpoint="/"} 1e+11`,
		`node_filesystem_free_bytes{device="/dev/vda1",fstype="ext4",mountpoint="/"} 4e+10`,
		`node_filesystem_size_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 1e+09`,
		`node_filesystem_free_bytes{device="tmpfs",fstype="tmpfs",mountpoint="/run"} 1e+09`,
		"",
	].join("\n");
}

/** テキストから時点の値を作る。 */
function snapshot(text: string, at: number) {
	return toNodeExporterSnapshot(
		parsePrometheusText(text, nodeExporterMetricNames),
		at,
	);
}

describe("parsePrometheusText", () => {
	it("正常系：ラベル無し・ラベル付き・タイムスタンプ付きの行を読み取る", () => {
		const samples = parsePrometheusText(
			[
				"# HELP x help",
				"node_load1 0.5",
				'node_cpu_seconds_total{cpu="0",mode="idle"} 123.5 1700000000000',
				"",
			].join("\n"),
		);
		assert.deepStrictEqual(samples, [
			{ name: "node_load1", labels: {}, value: 0.5 },
			{
				name: "node_cpu_seconds_total",
				labels: { cpu: "0", mode: "idle" },
				value: 123.5,
			},
		]);
	});

	it("正常系：wanted を渡した場合、それ以外のメトリクスを読み飛ばす", () => {
		const samples = parsePrometheusText(
			"node_load1 1\nnode_load5 2\n",
			new Set(["node_load5"]),
		);
		assert.deepStrictEqual(samples.map((s) => s.name), ["node_load5"]);
	});

	it("正常系：ラベル値のエスケープ（\\\" \\\\ \\n）を戻し、値中の , や } を区切りと見なさない", () => {
		const [sample] = parsePrometheusText(
			'm{a="x\\"y",b="c\\\\d",c="e\\nf",d="g,}h"} 1\n',
		);
		assert.deepStrictEqual(sample.labels, {
			a: 'x"y',
			b: "c\\d",
			c: "e\nf",
			d: "g,}h",
		});
	});

	it("正常系：NaN と +Inf / -Inf を数値として読む", () => {
		const values = parsePrometheusText("a NaN\nb +Inf\nc -Inf\n").map((s) => s.value);
		assert.ok(Number.isNaN(values[0]));
		assert.strictEqual(values[1], Number.POSITIVE_INFINITY);
		assert.strictEqual(values[2], Number.NEGATIVE_INFINITY);
	});

	it("異常系：値が読めない行と閉じ括弧の無い行は読み飛ばし、他の行は読み取る", () => {
		const samples = parsePrometheusText(
			'a abc\nb{x="1" 2\nc 3\n',
		);
		assert.deepStrictEqual(samples, [{ name: "c", labels: {}, value: 3 }]);
	});

	it("境界値：CRLF の改行でも値を読み取る", () => {
		const samples = parsePrometheusText("a 1\r\nb 2\r\n");
		assert.deepStrictEqual(samples.map((s) => s.value), [1, 2]);
	});
});

describe("node-exporter-metrics", () => {
	describe("toNodeExporterSnapshot", () => {
		it("正常系：lo を除いて最も通信量の多い NIC と、/ のファイルシステムを選ぶ", () => {
			const snap = snapshot(
				exporterText({ idle: 100, user: 50, rx: 1000, tx: 2000, reads: 10, writes: 20 }),
				0,
			);
			assert.strictEqual(snap.net?.device, "eth0");
			assert.strictEqual(snap.disk?.device, "vda");
			assert.strictEqual(snap.fs?.size, 1e11);
			assert.strictEqual(snap.cpu?.cores, 2);
		});

		it("正常系：機器を指定した場合、その機器を使う", () => {
			const snap = toNodeExporterSnapshot(
				parsePrometheusText(
					exporterText({ idle: 1, user: 1, rx: 1, tx: 1, reads: 1, writes: 1 }),
				),
				0,
				{ networkDevice: "lo", mountpoint: "/run" },
			);
			assert.strictEqual(snap.net?.device, "lo");
			assert.strictEqual(snap.fs?.mountpoint, "/run");
		});

		it("異常系：指定した機器が無い場合、その項目は null になる", () => {
			const snap = toNodeExporterSnapshot(
				parsePrometheusText(
					exporterText({ idle: 1, user: 1, rx: 1, tx: 1, reads: 1, writes: 1 }),
				),
				0,
				{ diskDevice: "sda", mountpoint: "/data" },
			);
			assert.strictEqual(snap.disk, null);
			assert.strictEqual(snap.fs, null);
		});
	});

	describe("computeDbServerStats", () => {
		it("正常系：前回との差から CPU 使用率・メモリ・1 秒あたりの量を計算する", () => {
			const prev = snapshot(
				exporterText({ idle: 100, user: 50, rx: 1000, tx: 2000, reads: 10, writes: 20 }),
				0,
			);
			// 5 秒で idle が 6 秒・iowait が 2 秒・user が 2 秒進んだ → 使用率 20%
			const cur = snapshot(
				exporterText({
					idle: 106,
					iowait: 2,
					user: 52,
					rx: 6000,
					tx: 4500,
					reads: 60,
					writes: 45,
				}),
				5000,
			);
			const stats = computeDbServerStats(prev, cur);
			assert.deepStrictEqual(stats, {
				cpu: 0.2,
				mem: { total: 1.2e10, used: 6e9, active: 7e9 },
				swap: { total: 2e9, used: 5e8 },
				load: { "1": 1.5, "5": 1.25, "15": 1 },
				net: { rx: 1000, tx: 500 },
				fs: { r: 10, w: 5 },
			});
		});

		it("正常系：MemAvailable がある場合、used は MemTotal − MemAvailable になる（共有メモリを使用中に数える）", () => {
			// Cached 4.9GB のうち多くが shared_buffers（Shmem）で解放できず、MemAvailable は 3GB しかない状態
			const withAvailable = (text: string) =>
				text.replace(
					"node_memory_MemFree_bytes 1e+09",
					"node_memory_MemFree_bytes 1e+09\nnode_memory_MemAvailable_bytes 3e+09",
				);
			const base = { idle: 100, user: 50, rx: 1, tx: 1, reads: 1, writes: 1 };
			const stats = computeDbServerStats(
				snapshot(withAvailable(exporterText(base)), 0),
				snapshot(withAvailable(exporterText({ ...base, idle: 105 })), 5000),
			);
			assert.strictEqual(stats?.mem.used, 9e9);
		});

		it("異常系：累計値が減った場合（再起動）、null を返す", () => {
			const prev = snapshot(
				exporterText({ idle: 100, user: 50, rx: 1, tx: 1, reads: 1, writes: 1 }),
				0,
			);
			const cur = snapshot(
				exporterText({ idle: 1, user: 1, rx: 1, tx: 1, reads: 1, writes: 1 }),
				5000,
			);
			assert.strictEqual(computeDbServerStats(prev, cur), null);
		});

		it("異常系：ディスクが前回と違う機器になった場合、読み書きは 0 にする", () => {
			const prev = snapshot(
				exporterText({ idle: 100, user: 50, rx: 1, tx: 1, reads: 10, writes: 10 }),
				0,
			);
			const cur = snapshot(
				exporterText({
					idle: 110,
					user: 50,
					rx: 1,
					tx: 1,
					reads: 99,
					writes: 99,
					device: "vdb",
				}),
				5000,
			);
			assert.deepStrictEqual(computeDbServerStats(prev, cur)?.fs, { r: 0, w: 0 });
		});

		it("境界値：経過時間が 0 の場合、null を返す", () => {
			const text = exporterText({ idle: 1, user: 1, rx: 1, tx: 1, reads: 1, writes: 1 });
			assert.strictEqual(
				computeDbServerStats(snapshot(text, 1000), snapshot(text, 1000)),
				null,
			);
		});

		it("境界値：CPU 時間が進んでいない場合、使用率は 0 になる", () => {
			const text = exporterText({ idle: 1, user: 1, rx: 1, tx: 1, reads: 1, writes: 1 });
			assert.strictEqual(
				computeDbServerStats(snapshot(text, 0), snapshot(text, 5000))?.cpu,
				0,
			);
		});
	});

	describe("toDbServerInfo", () => {
		it("正常系：server-info と同じ形の静的な情報を返す", () => {
			const snap = snapshot(
				exporterText({ idle: 1, user: 1, rx: 1, tx: 1, reads: 1, writes: 1 }),
				0,
			);
			assert.deepStrictEqual(toDbServerInfo(snap, "Icelake"), {
				cpu: { model: "Icelake", cores: 2 },
				mem: { total: 1.2e10 },
				fs: { total: 1e11, used: 6e10 },
				net: { interface: "eth0" },
			});
		});

		it("異常系：ファイルシステムが取れていない場合、null を返す", () => {
			const snap = toNodeExporterSnapshot([], 0);
			assert.strictEqual(toDbServerInfo(snap, ""), null);
		});
	});
});
