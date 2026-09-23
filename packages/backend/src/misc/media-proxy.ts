/**
 * @packageDocumentation
 *
 * 外部メディアプロキシの選択
 *
 * @remarks
 * 設定 `mediaProxy` には 1 つの URL か、URL の配列を書ける。
 * 配列のときは、同じキー（ファイル ID など）なら毎回同じプロキシが選ばれるように振り分ける。
 * 同じ画像が同じプロキシへ行くので、プロキシ側のキャッシュが効きやすい。
 *
 * どれかのプロキシが失敗したときの切り替えはクライアントが行う。
 * そのため、ここで作った一覧は meta API でクライアントにも渡している。
 *
 * @see {@link ../server/api/endpoints/meta.ts}
 * @internal
 */

import config from "@/config/index.js";

/**
 * 設定されている外部メディアプロキシの一覧を返す
 *
 * @remarks
 * - 未設定なら空配列を返す。
 * - 末尾の `/` は取り除く。呼び出し側で `/emoji.webp` などを足すため。
 * - 空文字の要素は捨てる。
 *
 * @returns プロキシの URL の一覧（設定した順）
 * @internal
 */
export function getMediaProxies(): string[] {
	const raw = config.mediaProxy;
	const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
	return list
		.map((x) => String(x).trim().replace(/\/+$/, ""))
		.filter((x) => x.length > 0);
}

/**
 * キーに応じて外部メディアプロキシを 1 つ選ぶ
 *
 * @remarks
 * FNV-1a で文字列をハッシュし、プロキシの数で割った余りで選ぶ。
 * 暗号的な強さは不要で、同じキーなら同じ結果になることと、偏りが少ないことだけを求めている。
 *
 * `offset` を指定すると、本来の振り分け先から数えて何個先のプロキシを使うかを変えられる。
 * クライアントが失敗時に「別のプロキシで」と頼むときに使う（絵文字の `?proxy=1` など）。
 *
 * NB: プロキシの数や順番を変えると、振り分け先が変わりキャッシュが一時的に効かなくなる。
 *
 * @param key - 振り分けに使う値（ファイル ID、絵文字 ID など）
 * @param offset - 本来の振り分け先から何個先を使うか
 * @returns 選ばれたプロキシの URL。未設定なら `null`
 * @defaultValue offset は 0（本来の振り分け先）
 * @internal
 */
export function pickMediaProxy(key: string, offset = 0): string | null {
	const proxies = getMediaProxies();
	if (proxies.length === 0) return null;

	// FNV-1a（32bit）
	let hash = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	const index = ((hash >>> 0) + Math.max(0, Math.trunc(offset))) % proxies.length;
	return proxies[index];
}
