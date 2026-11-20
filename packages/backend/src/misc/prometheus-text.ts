/**
 * @packageDocumentation
 *
 * Prometheus のテキスト形式（node_exporter の `/metrics` の応答）を読み取る小さなパーサー。
 *
 * @remarks
 * - DB サーバのメトリクス表示（{@link ../daemons/db-server-stats.ts}）のためだけに使う。
 * - 必要なメトリクス名だけを渡せば、それ以外の行は値を解釈せずに読み飛ばす。
 * - `# HELP` / `# TYPE` などのコメント行と、末尾のタイムスタンプは使わない。
 * - 依存パッケージを増やさないため自前で実装している。形式の細部（エスケープなど）は
 *   node_exporter が出力する範囲だけを扱う。
 *
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 * @internal
 */

/**
 * テキスト形式の 1 行ぶんの値。
 *
 * @internal
 */
export type PrometheusSample = {
	/** メトリクス名（例: `node_cpu_seconds_total`） */
	name: string;
	/** ラベル（例: `{ cpu: "0", mode: "idle" }`）。ラベルが無ければ空オブジェクト */
	labels: Record<string, string>;
	/** 値。`NaN` / `+Inf` / `-Inf` もそのまま数値で表す */
	value: number;
};

/**
 * Prometheus のテキスト形式を読み取り、値の一覧を返す。
 *
 * @remarks
 * 読み取れない行は例外にせず読み飛ばす。1 行の不具合で全体の表示が止まらないようにするため。
 *
 * @param text - `/metrics` の応答本文
 * @param wanted - 読み取るメトリクス名。省略するとすべての行を読む
 * @returns 読み取れた値の一覧（出現順）
 * @example
 * ```ts
 * parsePrometheusText('node_load1 0.5\n', new Set(["node_load1"]));
 * // => [{ name: "node_load1", labels: {}, value: 0.5 }]
 * ```
 * @internal
 */
export function parsePrometheusText(
	text: string,
	wanted?: ReadonlySet<string>,
): PrometheusSample[] {
	const samples: PrometheusSample[] = [];
	for (const rawLine of text.split("\n")) {
		const line = rawLine.trim();
		// 空行とコメント行（# HELP / # TYPE を含む）は使わない
		if (line === "" || line.startsWith("#")) continue;

		// メトリクス名は `{` か空白の直前まで
		const nameEnd = line.search(/[{\s]/);
		if (nameEnd <= 0) continue;
		const name = line.slice(0, nameEnd);
		if (wanted && !wanted.has(name)) continue;

		let rest = line.slice(nameEnd);
		let labels: Record<string, string> = {};
		if (rest.startsWith("{")) {
			const parsed = parseLabels(rest);
			if (parsed == null) continue;
			labels = parsed.labels;
			rest = rest.slice(parsed.length);
		}

		// 残りは「値 [タイムスタンプ]」。タイムスタンプは使わない
		const valueText = rest.trim().split(/\s+/)[0];
		const value = parseValue(valueText);
		if (value == null) continue;

		samples.push({ name, labels, value });
	}
	return samples;
}

/**
 * `{a="1",b="2"}` の形のラベル部分を読み取る。
 *
 * @remarks
 * 値の中の `\"`、`\\`、`\n` のエスケープを戻す。閉じ括弧が無いなど形式が崩れていれば `null`。
 *
 * @param text - `{` から始まる文字列
 * @returns ラベルと、`}` までを含めた読み取った文字数。読めなければ `null`
 * @internal
 */
function parseLabels(
	text: string,
): { labels: Record<string, string>; length: number } | null {
	const labels: Record<string, string> = {};
	let i = 1;
	while (i < text.length) {
		// 区切りの空白とカンマを飛ばす
		while (i < text.length && (text[i] === "," || text[i] === " ")) i++;
		if (text[i] === "}") return { labels, length: i + 1 };

		// ラベル名は `=` の直前まで
		const eq = text.indexOf("=", i);
		if (eq < 0) return null;
		const key = text.slice(i, eq).trim();
		if (text[eq + 1] !== '"') return null;

		// 値は次のエスケープされていない `"` まで
		let value = "";
		let j = eq + 2;
		for (; j < text.length; j++) {
			const ch = text[j];
			if (ch === "\\" && j + 1 < text.length) {
				const next = text[j + 1];
				value += next === "n" ? "\n" : next;
				j++;
			} else if (ch === '"') {
				break;
			} else {
				value += ch;
			}
		}
		if (j >= text.length) return null;
		labels[key] = value;
		i = j + 1;
	}
	return null;
}

/**
 * 値の文字列を数値にする。
 *
 * @param text - 値の文字列（`1.5e+09`、`NaN`、`+Inf` など）
 * @returns 数値。読めなければ `null`
 * @internal
 */
function parseValue(text: string | undefined): number | null {
	if (text == null || text === "") return null;
	if (text === "+Inf" || text === "Inf") return Number.POSITIVE_INFINITY;
	if (text === "-Inf") return Number.NEGATIVE_INFINITY;
	if (text === "NaN") return Number.NaN;
	const value = Number(text);
	return Number.isNaN(value) ? null : value;
}
