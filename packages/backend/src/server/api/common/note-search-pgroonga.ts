/**
 * @packageDocumentation
 *
 * 投稿検索（`notes/search` の DB 経路）で、pgroonga のインデックスを使って候補を絞るための補助。
 *
 * @remarks
 * - 背景: DB 経路の検索は「`ILIKE` の条件 + 新しい順に limit 件」の 1 クエリで、PostgreSQL は主キーを新しい順に
 *   たどって 1 件ずつ条件を確かめる。よく出る語ならすぐ件数がそろうので速い（0.1 秒台）が、まれな語ではほぼ全件を
 *   読むことになり、本番で平均 32 秒・最長 51 分かかっていた。演算子を pgroonga のもの（`&@`）に変えても、
 *   この「新しい順に limit 件」の形では同じ計画が選ばれ、pgroonga のインデックスは使われない（実測で確認）。
 * - そこで、まれな語のときだけ、先に pgroonga で「その語を含む投稿の id」を集め、元のクエリに id の条件を足す。
 *   pgroonga のインデックスだけを使うクエリなら、202 件ヒットの語で 0.1〜0.3 秒で済む。
 * - 呼び出し側（notes/search）は、まず元のクエリを短い時間だけ試し、時間切れになったときだけここを使う。
 * - pgroonga のインデックス（`pgroonga_note_text_index` / `pgroonga_note_cw_index`）はマイグレーションで作っていない
 *   （本番に手作業で作ったもの）。無い環境では {@link hasNoteSearchPgroongaIndexes} が false を返し、従来どおり動く。
 * - NB: pgroonga（TokenBigram + NormalizerAuto）と `ILIKE` は、一致の仕方が完全には同じでない。
 *   - 全角・半角や大文字・小文字の違いは、pgroonga の方が広く同一視する（候補が多めになるだけなので問題ない）。
 *   - 英数字の並びは 1 語として扱われるので、`ram` で `ramen` のような**英数字の語の一部**には一致しない。
 *   最終的な結果は元の `ILIKE` 条件でも絞るので、ここで漏れたものが結果から抜けることはあるが、余計なものが入ることはない。
 *   英数字の語の一部を探すような検索はたいてい一致が多く、1 段目で終わるので、実害は小さいと判断した。
 *
 * @see {@link ../endpoints/notes/search.ts}
 * @internal
 */
import { QueryFailedError } from "typeorm";
import type { EntityManager } from "typeorm";
import { db } from "@/db/postgre.js";

/** 本番に手作業で作った pgroonga のインデックス名 */
const pgroongaIndexNames = ["pgroonga_note_text_index", "pgroonga_note_cw_index"];

/** インデックスの有無を確かめ直す間隔（ミリ秒）。インデックスを消したときに追従するため */
const indexCheckTtlMs = 10 * 60 * 1000;

/** インデックスの有無のキャッシュ（モジュール内でだけ更新する） */
let indexCache: { value: boolean; checkedAt: number } | null = null;

/**
 * note に、検索で使える pgroonga のインデックスがあるかを返す。
 *
 * @remarks
 * 結果は {@link indexCheckTtlMs} の間キャッシュする。確かめるクエリが失敗したときは false（従来どおりの検索）にする。
 *
 * @returns 本文用と CW 用の両方があれば true
 * @internal
 */
export async function hasNoteSearchPgroongaIndexes(): Promise<boolean> {
	const now = Date.now();
	if (indexCache && now - indexCache.checkedAt < indexCheckTtlMs) {
		return indexCache.value;
	}
	let value = false;
	try {
		const rows: { count: number | string }[] = await db.query(
			`SELECT count(*) AS count FROM pg_indexes WHERE tablename = 'note' AND indexname = ANY($1)`,
			[pgroongaIndexNames],
		);
		value = Number(rows[0]?.count ?? 0) === pgroongaIndexNames.length;
	} catch {
		value = false;
	}
	indexCache = { value, checkedAt: now };
	return value;
}

/**
 * 候補を集めるのに使う語を 1 つ選ぶ。
 *
 * @remarks
 * 検索語はすべて AND 条件なので、どれか 1 語の一致だけで候補を集めれば、結果の候補を取りこぼさない。
 * 一致の少ない語ほど速いので、「長い語ほどまれ」とみなして最も長い語を選ぶ（同じ長さなら先の語）。
 *
 * @param words - 検索語（空でないこと）
 * @returns 選んだ語。語が無ければ null
 * @example
 * ```ts
 * pickCandidateWord(["の", "ぺんぎんさん"]); // => "ぺんぎんさん"
 * ```
 * @internal
 */
export function pickCandidateWord(words: readonly string[]): string | null {
	let best: string | null = null;
	for (const word of words) {
		if (best == null || [...word].length > [...best].length) best = word;
	}
	return best;
}

/**
 * pgroonga で、語を本文か CW に含む投稿の id を集める。
 *
 * @remarks
 * - 本文と CW を別々に引いて UNION する（OR で書くとインデックスを使わない計画になることがある）。
 * - 並べ替えや LIMIT は付けない。付けると主キーを新しい順にたどる計画に戻ってしまうため。
 * - 渡された `em` のトランザクション内で実行するので、時間制限は呼び出し側の `SET LOCAL statement_timeout` に従う。
 *
 * @param em - 実行に使うトランザクション
 * @param word - 探す語（そのままの文字列として探す。`&@~` のようなクエリ構文は使わない）
 * @returns 一致した投稿の id（順不同）
 * @throws QueryFailedError - 時間切れなど DB のエラーのとき
 * @internal
 */
export async function findNoteIdsByPgroonga(
	em: EntityManager,
	word: string,
): Promise<string[]> {
	const rows: { id: string }[] = await em.query(
		`SELECT id FROM note WHERE text &@ $1 UNION SELECT id FROM note WHERE cw &@ $1`,
		[word],
	);
	return rows.map((row) => row.id);
}

/**
 * DB のエラーが `statement_timeout` による打ち切りかを返す。
 *
 * @param e - 捕まえたエラー
 * @returns PostgreSQL の query_canceled（57014）なら true
 * @internal
 */
export function isQueryCanceledError(e: unknown): boolean {
	return e instanceof QueryFailedError && (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === "57014";
}
