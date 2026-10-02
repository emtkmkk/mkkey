/**
 * @packageDocumentation
 *
 * AT Protocol のレコードキーに使う TID（Timestamp Identifier）を作る。
 *
 * @remarks
 * - TID は 13 文字の文字列で、64 ビットの値を「並べ替えられる base32」で表したもの。
 *   中身は、先頭 1 ビットが 0、次の 53 ビットが UNIX 時刻（マイクロ秒）、残り 10 ビットが時計の ID。
 * - 文字の順番がそのまま時刻の順番になるので、follow / like のレコードキーは書いた順に並ぶ。
 * - 同じプロセスの中では、前回より必ず大きい値を返す（同じマイクロ秒に 2 回呼ばれても重ならない）。
 *   NOTE: web ワーカーが複数あっても、時計の ID をプロセスごとに変えているので、まず重ならない。
 *   重なった場合も、レポジトリへの書き込み（`writeRecords`）が「すでにある」として止める。
 * - `@atproto/common-web` にも同じものがあるが、これだけのために依存を増やさないよう自前で持つ。
 *
 * @see {@link https://atproto.com/specs/tid | TID の仕様}
 * @internal
 */

/** 並べ替えられる base32 の文字（この順番が値の大小と一致する） */
const S32_CHARS = "234567abcdefghijklmnopqrstuvwxyz";

/** このプロセスの時計の ID（0〜1023）。起動ごとに決める */
const clockId = Math.floor(Math.random() * 1024);

/** 前回返した時刻（マイクロ秒）。同じ値を返さないために覚えておく */
let lastTimestamp = 0;

/**
 * 新しい TID を作る。
 *
 * @remarks
 * `Date.now()` はミリ秒までしか分からないので、マイクロ秒の部分は「前回 + 1」で埋める。
 *
 * @returns 13 文字の TID（例: `3mwuslmj34c2k`）
 * @internal
 */
export function nextTid(): string {
	// 前回以下になったら、前回 + 1 マイクロ秒にずらして必ず増えるようにする
	const now = Date.now() * 1000;
	const timestamp = now > lastTimestamp ? now : lastTimestamp + 1;
	lastTimestamp = timestamp;

	// 53 ビットの時刻と 10 ビットの時計の ID を、それぞれ 11 文字と 2 文字にして並べる
	return `${encodeS32(timestamp, 11)}${encodeS32(clockId, 2)}`;
}

/**
 * 数を、並べ替えられる base32 の決まった長さの文字列にする。
 *
 * @param value - 0 以上の整数（`Number.MAX_SAFE_INTEGER` 以下）
 * @param length - 出力する文字数。足りない桁は先頭を `2`（0 の意味）で埋める
 * @returns base32 の文字列
 * @internal
 */
function encodeS32(value: number, length: number): string {
	let s = "";
	let v = value;
	while (v > 0) {
		s = S32_CHARS[v % 32] + s;
		v = Math.floor(v / 32);
	}
	return s.padStart(length, S32_CHARS[0]);
}
