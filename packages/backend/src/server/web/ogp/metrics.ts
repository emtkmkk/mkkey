/**
 * @packageDocumentation
 *
 * OGP 画像生成用のフォントメトリクス。sfnt の `cmap` / `hmtx` から文字送り幅を直接読む。
 *
 * @remarks
 * - **役割**: satori が使うのと同じフォントファイルを解析し、テキストの描画幅(px)を求める。
 *   表示名の切り詰め位置を決めるために必要。
 * - **なぜ自前で測るか**: satori の `text-overflow: ellipsis` はテキストにしか効かず、
 *   行末が画像（横長のカスタム絵文字など）の場合に `…` が出ない。幅を実測して自前で
 *   切り詰めることで、絵文字で終わる表示名にも省略記号を付けられる。
 * - **精度**: GPOS のカーニングは無視する。日本語主体の表示名では実害がなく、
 *   切り詰め位置が 1px 前後ずれるだけで見た目に影響しない。
 * - 未収録文字は `.notdef`（豆腐）の送り幅で数える。豆腐も描画上は場所を取るため。
 *
 * @internal
 */

/** 解析済みフォントから文字送り幅を引くためのインターフェース */
export type FontMetrics = {
	/** フォントの em あたりのユニット数 */
	unitsPerEm: number;
	/** 指定のコードポイントがフォントに収録されているか */
	hasGlyph: (codePoint: number) => boolean;
	/**
	 * 文字列の描画幅を求める。
	 *
	 * @param str - 対象の文字列
	 * @param fontSize - 描画時のフォントサイズ(px)
	 * @returns 描画幅(px)
	 */
	width: (str: string, fontSize: number) => number;
};

type TableRecord = { off: number; len: number };

/**
 * 必須テーブルを取り出す。無ければどのテーブルが欠けているか分かる形で失敗させる。
 *
 * @internal
 */
function requireTable(
	tables: Record<string, TableRecord>,
	name: string,
): TableRecord {
	const table = tables[name];
	if (!table) throw new Error(`ogp/metrics: ${name} テーブルが無い`);
	return table;
}

/**
 * OTF / TTF のバイナリからメトリクスを読み出す。
 *
 * @param buf - フォントファイルの内容
 * @returns 送り幅を引ける {@link FontMetrics}
 * @throws 対応する `cmap` サブテーブルが無い場合
 */
export function loadFontMetrics(buf: Buffer): FontMetrics {
	const tables: Record<string, TableRecord> = {};
	const numTables = buf.readUInt16BE(4);
	for (let i = 0; i < numTables; i++) {
		const o = 12 + i * 16;
		tables[buf.toString("ascii", o, o + 4)] = {
			off: buf.readUInt32BE(o + 8),
			len: buf.readUInt32BE(o + 12),
		};
	}

	const head = requireTable(tables, "head");
	const hhea = requireTable(tables, "hhea");
	const hmtx = requireTable(tables, "hmtx");
	const cmap = requireTable(tables, "cmap");

	const unitsPerEm = buf.readUInt16BE(head.off + 18);
	const numHMetrics = buf.readUInt16BE(hhea.off + 34);

	// hmtx は numHMetrics 件の (advanceWidth, lsb)。以降のグリフは最後の advanceWidth を共有する
	const advanceOf = (gid: number): number =>
		buf.readUInt16BE(hmtx.off + Math.min(gid, numHMetrics - 1) * 4);

	const glyphOf = buildGlyphLookup(buf, cmap.off);

	return {
		unitsPerEm,
		hasGlyph: (cp) => glyphOf(cp) !== 0,
		width(str, fontSize) {
			let units = 0;
			for (const ch of str) units += advanceOf(glyphOf(ch.codePointAt(0)!));
			return (units / unitsPerEm) * fontSize;
		},
	};
}

/**
 * `cmap` から Unicode 系サブテーブルを選び、コードポイント→グリフ ID の関数を作る。
 *
 * @param buf - フォントファイルの内容
 * @param cmapOff - `cmap` テーブルの先頭オフセット
 * @returns コードポイントを受けてグリフ ID を返す関数（未収録は 0）
 * @internal
 */
function buildGlyphLookup(
	buf: Buffer,
	cmapOff: number,
): (codePoint: number) => number {
	const n = buf.readUInt16BE(cmapOff + 2);
	let best: { off: number; format: number } | null = null;
	let bestScore = -1;

	for (let i = 0; i < n; i++) {
		const rec = cmapOff + 4 + i * 8;
		const platformId = buf.readUInt16BE(rec);
		const encodingId = buf.readUInt16BE(rec + 2);
		const off = cmapOff + buf.readUInt32BE(rec + 4);
		const format = buf.readUInt16BE(off);

		// BMP 外まで引ける format 12 を優先する
		let score = -1;
		if (platformId === 3 && encodingId === 10 && format === 12) score = 4;
		else if (platformId === 0 && format === 12) score = 3;
		else if (platformId === 3 && encodingId === 1 && format === 4) score = 2;
		else if (platformId === 0 && format === 4) score = 1;

		if (score > bestScore) {
			bestScore = score;
			best = { off, format };
		}
	}

	if (!best || bestScore < 0) {
		throw new Error("ogp/metrics: 対応する cmap サブテーブルが無い");
	}
	return best.format === 12
		? buildFormat12(buf, best.off)
		: buildFormat4(buf, best.off);
}

/**
 * cmap format 12（セグメント化された UCS-4 マッピング）を引く関数を作る。
 *
 * @internal
 */
function buildFormat12(
	buf: Buffer,
	off: number,
): (codePoint: number) => number {
	const nGroups = buf.readUInt32BE(off + 12);
	const base = off + 16;
	return (cp) => {
		let lo = 0;
		let hi = nGroups - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const g = base + mid * 12;
			const start = buf.readUInt32BE(g);
			const end = buf.readUInt32BE(g + 4);
			if (cp < start) hi = mid - 1;
			else if (cp > end) lo = mid + 1;
			else return buf.readUInt32BE(g + 8) + (cp - start);
		}
		return 0;
	};
}

/**
 * cmap format 4（BMP 用のセグメントマッピング）を引く関数を作る。
 *
 * @internal
 */
function buildFormat4(buf: Buffer, off: number): (codePoint: number) => number {
	const segCountX2 = buf.readUInt16BE(off + 6);
	const segCount = segCountX2 / 2;
	const endO = off + 14;
	const startO = endO + segCountX2 + 2;
	const deltaO = startO + segCountX2;
	const rangeO = deltaO + segCountX2;

	return (cp) => {
		if (cp > 0xffff) return 0;
		for (let i = 0; i < segCount; i++) {
			if (buf.readUInt16BE(endO + i * 2) < cp) continue;
			const start = buf.readUInt16BE(startO + i * 2);
			if (cp < start) return 0;
			const rangeOffset = buf.readUInt16BE(rangeO + i * 2);
			if (rangeOffset === 0) {
				return (cp + buf.readInt16BE(deltaO + i * 2)) & 0xffff;
			}
			const gid = buf.readUInt16BE(
				rangeO + i * 2 + rangeOffset + (cp - start) * 2,
			);
			return gid === 0 ? 0 : (gid + buf.readInt16BE(deltaO + i * 2)) & 0xffff;
		}
		return 0;
	};
}
