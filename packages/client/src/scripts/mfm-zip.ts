/**
 * @packageDocumentation
 *
 * MFM 関数 `$[zip …]` の変換処理。
 *
 * 文中で 2 回以上出てくる、2 文字以上の部分をなるべく長いものから選び、
 * 本文に出てこない記号（α, β, …, ☆, ★ …）に置き換える。対応表を先頭に 1 行ずつ出し、
 * 空行を 1 つ（改行 2 回）挟んでから置き換えた本文を続ける。
 *
 * 例: `$[zip こんにちは世界、こんにちは世界]` →
 * ```
 * α=`こんにちは世界`
 *
 * α、α
 * ```
 *
 * @remarks
 * 判断の軸: 「元の文に問題なく戻せること」を最優先し、次に「戻しやすさ」を優先する。
 *
 * 決定事項:
 * - 置き換えるのは最大 {@link MAX_REPLACEMENTS} 個。
 * - 選ぶ順は「長い方」→「出てくる回数が多い方」→「先に出てくる方」。
 * - 回数は重ならないように数える（「あああ」の中の「ああ」は 1 回）。
 * - 一度置き換えた部分は次の候補にしない。対応表の中でさらに置き換えることもしない。
 * - 空白や改行もふつうの 1 文字として扱う。対応表では `\n` や `\s` と書く（{@link escapeForTable}）。
 * - 大文字と小文字、全角と半角は区別する。
 * - 見た目の 1 文字（濁点の組み合わせなど）は途中で切らない。
 * - 置き換えるのはただの文字の部分だけ。絵文字・メンション・URL・ほかの MFM などは対象にせず、またいで置き換えることもしない。
 * - 選んだ部分にバッククォート（`）が入っていたら、何も変換しない（対応表のインラインコードが壊れるため）。
 * - 対象の文字が {@link MAX_LENGTH} 文字を超えるときと、置き換えるものが無いときは、何も変換しない。
 *
 * NOTE: 対応表を `` ` `` で囲むのは、MFM のインラインコードとして中身がそのまま表示され、
 * 中に MFM の記号が入っていても解釈されないようにするため。インラインコードは改行を含められないので、
 * 改行は `\n` と書く。
 * NOTE: 置き換えてもかえって文字数が増えるもの（2 文字が 2 回など）も、条件を満たせば置き換える。
 * NOTE: 対応表は `$[zip …]` を書いた位置に出る（投稿全体の先頭ではない）。
 * REVIEW: 全角空白は対応表でもそのまま出している。見分けにくいなら別の書き方を決める。
 *
 * @internal
 */
import * as mfm from "mfm-js";

// #region 定数

/**
 * 1 回の `$[zip …]` で置き換える最大の個数。
 *
 * @internal
 */
const MAX_REPLACEMENTS = 20;

/**
 * 変換する文字数の上限（見た目の文字数）。
 *
 * @remarks
 * 候補探しは文字数の 2 乗に比例して重くなる（3000 文字で 1 回あたり約 450 万回の比較）。
 * これを超えるときは何も変換しない。
 *
 * @internal
 */
const MAX_LENGTH = 3000;

/**
 * 置き換え先に使う記号の候補（使う順）。
 *
 * @remarks
 * 本文に一度でも出てくる記号は使わない。そうしないと、元に戻すときに区別できなくなるため。
 * 末尾ほど優先度が低い。ギリシャ文字の語末形 ς は σ と紛らわしいので入れていない。
 *
 * @internal
 */
const LABEL_CANDIDATES = [
	..."αβγδεζηθικλμνξοπρστυφχψω",
	..."☆★○●◎◇◆□■△▲▽▼♪♭♯",
];

// #endregion

// #region 公開関数

/**
 * `$[zip …]` の中身を、繰り返しを記号に置き換えた文に変換する。
 *
 * @param text - `$[zip …]` の中身（MFM の文字列）
 * @returns 対応表 + 空行 + 置き換えた本文。変換しない条件に当たったときは `text` をそのまま返す
 * @internal
 */
export function zipText(text: string): string {
	const nodes = mfm.parse(text);

	// 置き換え対象になるのは text ノードだけ。ノードごとに見た目の 1 文字単位へ分ける
	const textNodes: mfm.MfmText[] = [];
	mfm.inspect(nodes, (node) => {
		if (node.type === "text" && node.props.text) textNodes.push(node);
	});
	const segments = textNodes.map((node) => splitGraphemes(node.props.text));

	const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
	if (totalLength > MAX_LENGTH) return text;

	// 本文（MFM の記号も含めた全体）に出てこない記号だけをラベルに使う
	const labels = LABEL_CANDIDATES.filter((label) => !text.includes(label));

	const picks = pickRepeats(segments, Math.min(MAX_REPLACEMENTS, labels.length));
	if (picks.length === 0) return text;

	// 対応表をインラインコードで書くので、バッククォートを含むものがあれば変換をやめる
	if (picks.some((pick) => pick.text.includes("`"))) return text;

	// 各ノードの文字列を、置き換え位置にラベルを入れて組み立て直す
	textNodes.forEach((node, nodeIndex) => {
		const chars = segments[nodeIndex];
		const starts = new Map<number, { label: string; length: number }>();
		picks.forEach((pick, pickIndex) => {
			for (const occ of pick.occurrences) {
				if (occ.segment === nodeIndex) {
					starts.set(occ.start, { label: labels[pickIndex], length: pick.length });
				}
			}
		});

		let out = "";
		for (let i = 0; i < chars.length; ) {
			const hit = starts.get(i);
			if (hit) {
				out += hit.label;
				i += hit.length;
			} else {
				out += chars[i];
				i++;
			}
		}
		node.props.text = out;
	});

	const table = picks
		.map((pick, i) => `${labels[i]}=\`${escapeForTable(pick.text)}\``)
		.join("\n");

	return `${table}\n\n${mfm.toString(nodes)}`;
}

// #endregion

// #region 候補探し

/**
 * 置き換えに選んだ 1 つの繰り返し。
 *
 * @internal
 */
interface RepeatPick {
	/** 置き換える文字列 */
	text: string;
	/** 見た目の文字数 */
	length: number;
	/** 置き換える位置（重ならないもの、2 つ以上） */
	occurrences: { segment: number; start: number }[];
}

/**
 * 置き換える繰り返しを、優先順に最大 `limit` 個選ぶ。
 *
 * @remarks
 * 全部のノードを 1 列に並べ、文字ごとに番号を振って比べる。ノードの境目と、置き換え済みの位置には
 * ほかと決して一致しない番号（負の番号、毎回別）を置くので、境目をまたぐ候補や、置き換え済みの部分を
 * 含む候補はできない。
 *
 * 1 回ごとに「重ならずに 2 回以上出てくる、いちばん長い部分」の長さを求め、その長さの候補の中から
 * 回数が多いもの → 先に出てくるもの を選ぶ。
 * OPTIMIZE: 毎回 O(n²) で探し直している。3000 文字 × 20 回なら問題ない速さだが、上限を上げるなら接尾辞配列などを検討する。
 *
 * @param segments - text ノードごとの、見た目の 1 文字ずつの配列
 * @param limit - 選ぶ最大の個数
 * @returns 選んだ繰り返し（選んだ順）
 * @internal
 */
function pickRepeats(segments: string[][], limit: number): RepeatPick[] {
	// 文字 → 番号。同じ文字は同じ番号になる
	const ids = new Map<string, number>();
	const seq: number[] = [];
	const origin: { segment: number; start: number }[] = [];
	let sentinel = -1;

	segments.forEach((chars, segment) => {
		chars.forEach((ch, start) => {
			let id = ids.get(ch);
			if (id === undefined) {
				id = ids.size;
				ids.set(ch, id);
			}
			seq.push(id);
			origin.push({ segment, start });
		});
		// ノードの境目。どの文字とも一致しない
		seq.push(sentinel--);
		origin.push({ segment: -1, start: -1 });
	});

	const picks: RepeatPick[] = [];
	while (picks.length < limit) {
		const length = longestRepeatLength(seq);
		if (length < 2) break;

		const best = bestCandidate(seq, length);
		if (!best) break;

		const chars = best.positions[0];
		const textOfPick = Array.from({ length }, (_, k) => {
			const o = origin[chars + k];
			return segments[o.segment][o.start];
		}).join("");

		picks.push({
			text: textOfPick,
			length,
			occurrences: best.positions.map((p) => origin[p]),
		});

		// 置き換えた位置は、次から候補に入らないようにする
		for (const p of best.positions) {
			for (let k = 0; k < length; k++) seq[p + k] = sentinel--;
		}
	}

	return picks;
}

/**
 * 重ならずに 2 回以上出てくる部分のうち、いちばん長いものの長さを返す。
 *
 * @remarks
 * `lcp[j]` に「位置 i と位置 j から何文字一致するか」を入れ、i を後ろから前へ動かして 1 行ずつ更新する。
 * 2 つの出現が重ならない長さは `j - i` までなので、それで頭打ちにする。
 *
 * @param seq - 文字番号の列（負の番号はどこにも一致しない）
 * @returns 長さ。見つからなければ 0
 * @internal
 */
function longestRepeatLength(seq: number[]): number {
	const n = seq.length;
	const lcp = new Int32Array(n + 1);
	let best = 0;

	for (let i = n - 1; i >= 0; i--) {
		// j を小さい順に上書きすると、lcp[j + 1] はまだ「i + 1 の行」の値のまま読める
		for (let j = i + 1; j < n; j++) {
			if (seq[i] >= 0 && seq[i] === seq[j]) {
				lcp[j] = lcp[j + 1] + 1;
				const usable = Math.min(lcp[j], j - i);
				if (usable > best) best = usable;
			} else {
				lcp[j] = 0;
			}
		}
		lcp[n] = 0;
	}

	return best;
}

/**
 * 長さ `length` の候補の中から、回数が多いもの → 先に出てくるもの を 1 つ選ぶ。
 *
 * @param seq - 文字番号の列
 * @param length - 候補の長さ
 * @returns 選んだ候補の出現位置（重ならないもの、先頭から順）。2 回以上のものが無ければ `null`
 * @internal
 */
function bestCandidate(
	seq: number[],
	length: number,
): { positions: number[] } | null {
	const found = new Map<string, { positions: number[]; lastEnd: number }>();

	for (let i = 0; i + length <= seq.length; i++) {
		const part = seq.slice(i, i + length);
		if (part.some((id) => id < 0)) continue;

		const key = part.join(",");
		const entry = found.get(key);
		if (!entry) {
			found.set(key, { positions: [i], lastEnd: i + length });
		} else if (i >= entry.lastEnd) {
			// 左から順に、前の出現と重ならないものだけ数える
			entry.positions.push(i);
			entry.lastEnd = i + length;
		}
	}

	let best: number[] | null = null;
	for (const { positions } of found.values()) {
		if (positions.length < 2) continue;
		// Map は最初に見つけた順なので、回数が同じなら先に出てくる方が残る
		if (!best || positions.length > best.length) best = positions;
	}

	return best ? { positions: best } : null;
}

// #endregion

// #region 文字の扱い

/**
 * 文字列を見た目の 1 文字ずつに分ける。
 *
 * @remarks
 * `Intl.Segmenter` が無い環境では、コードポイント単位で分ける（結合文字は切れることがある）。
 *
 * @param text - 分ける文字列
 * @returns 見た目の 1 文字ずつの配列
 * @internal
 */
function splitGraphemes(text: string): string[] {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
		return Array.from(segmenter.segment(text), (s) => s.segment);
	}
	return [...text];
}

/**
 * 対応表に書くために、見えにくい文字を記号で書き換える。
 *
 * @remarks
 * 元に戻せるように、`\` 自体も `\\` にする（元の文に `\n` という 2 文字があっても区別できる）。
 *
 * @param text - 置き換える文字列
 * @returns 書き換えた文字列
 * @internal
 */
function escapeForTable(text: string): string {
	return text
		.replaceAll("\\", "\\\\")
		.replaceAll("\r", "\\r")
		.replaceAll("\n", "\\n")
		.replaceAll("\t", "\\t")
		.replaceAll(" ", "\\s");
}

// #endregion
