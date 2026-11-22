/**
 * @packageDocumentation
 *
 * 端末に持つ他鯖絵文字の辞書と、その検索用の索引。
 *
 * @remarks
 * - 辞書はサーバーの `emojis`（`remoteEmojis: "all" | "mini"`）から取る。数十万件あるので、
 *   Vue の reactive に入れず `markRaw` で持つ（{@link setRemoteEmojiDictionary}）。
 *   CHANGED（2026-11-22）: 以前は reactive な `instance.allEmojis` にそのまま入れていたため、
 *   最初の検索で全件ぶんのプロキシが作られて残っていた。
 * - 受け取る形は 2 通り。
 *   - ホストごとの形（`remoteEmojiGroups`）: `{ ホスト: "名前1 !センシティブな名前 …" }`
 *   - 従来の形（`allEmojis`）: `[{ n, h, s? }]` または `[{ name, host, sensitive? }]`（端末に保存済みの古い辞書）
 * - 索引（{@link RemoteEmojiIndex}）は最初の検索で作る。数十万件の名前の変換に時間がかかるので、
 *   画面を止めないよう小分けにして作る（{@link ensureRemoteEmojiIndex}）。
 * - このファイルは `@/instance` を import しない（instance.ts から使われるため、循環を避ける）。
 *   ローカル絵文字との突き合わせや、サーバー検索との切り替えは {@link ./remote-emoji-search} で行う。
 *
 * @internal
 */
import { markRaw } from "vue";
import { formatRoomajiUncached } from "@/scripts/convert-jp";

/**
 * 辞書の 1 件
 *
 * @remarks
 * 絵文字ピッカーの検索結果としてそのまま描画に使う（`name` と `host` があればよい）。
 *
 * @internal
 */
export type RemoteEmojiEntry = {
	name: string;
	host: string;
	sensitive?: true;
};

/**
 * 辞書の範囲
 *
 * @remarks
 * `all` はコピー拒否以外のすべて、`plus` はコピー許可のものだけ（画面上は「ミニ」）。
 *
 * @internal
 */
export type RemoteEmojiDictionaryMode = "all" | "plus";

/**
 * 検索用の索引
 *
 * @remarks
 * `keys[i]` は `entries[order[i]]` の名前を formatRoomaji した文字列で、昇順に並ぶ。
 * 前方一致は二分探索で範囲を求め、部分一致は `keys` の文字列だけを順に見る。
 *
 * @internal
 */
export type RemoteEmojiIndex = {
	keys: string[];
	order: Uint32Array;
};

/** 端末の辞書（無ければ null）。中身は markRaw */
let entries: RemoteEmojiEntry[] | null = null;

/** 辞書の範囲 */
let dictionaryMode: RemoteEmojiDictionaryMode | null = null;

/** `name@host` の集合。存在の確認に使う。必要になったときに作る */
let keySet: Set<string> | null = null;

/** 作り終えた索引 */
let index: RemoteEmojiIndex | null = null;

/** 作っている途中の索引（同時に呼ばれても 1 回だけ作る） */
let indexBuilding: Promise<RemoteEmojiIndex> | null = null;

/** 辞書を入れ替えた回数。作っている途中の索引が古い辞書のものになっていないか見分ける */
let generation = 0;

/**
 * サーバーから届いた（または端末に保存してあった）辞書を、1 件ずつの形に直す
 *
 * @param data - `remoteEmojiGroups` か `allEmojis` を持つオブジェクト
 * @returns 1 件ずつの配列。どちらも無ければ null
 * @internal
 */
function toEntries(data: {
	remoteEmojiGroups?: unknown;
	allEmojis?: unknown;
}): RemoteEmojiEntry[] | null {
	const result: RemoteEmojiEntry[] = [];
	if (data.remoteEmojiGroups && typeof data.remoteEmojiGroups === "object") {
		for (const [host, names] of Object.entries(
			data.remoteEmojiGroups as Record<string, unknown>,
		)) {
			if (typeof names !== "string" || names === "") continue;
			for (const token of names.split(" ")) {
				if (token === "") continue;
				// 先頭の ! はセンシティブの印
				result.push(
					token.startsWith("!")
						? { name: token.slice(1), host, sensitive: true }
						: { name: token, host },
				);
			}
		}
		return result;
	}
	if (Array.isArray(data.allEmojis)) {
		for (const item of data.allEmojis as Record<string, unknown>[]) {
			if (item == null) continue;
			// 短縮形 {n, h, s} と、古い形 {name, host, sensitive} の両方を受け付ける
			const name = (item.n ?? item.name) as string | undefined;
			const host = (item.h ?? item.host) as string | null | undefined;
			if (!name || !host) continue;
			const sensitive = item.s === true || item.sensitive === true;
			result.push(sensitive ? { name, host, sensitive: true } : { name, host });
		}
		return result;
	}
	return null;
}

/**
 * 端末の辞書を入れ替える
 *
 * @remarks
 * 索引と存在確認用の集合は捨て、次に使うときに作り直す。
 *
 * @param data - `remoteEmojiMode` と、`remoteEmojiGroups` か `allEmojis` を持つオブジェクト
 * @returns 1 件ずつに直した辞書（markRaw）。辞書が無ければ null
 * @internal
 */
export function setRemoteEmojiDictionary(data: {
	remoteEmojiMode?: unknown;
	remoteEmojiGroups?: unknown;
	allEmojis?: unknown;
}): RemoteEmojiEntry[] | null {
	const list = toEntries(data);
	generation += 1;
	index = null;
	indexBuilding = null;
	keySet = null;
	if (list == null) {
		entries = null;
		dictionaryMode = null;
		return null;
	}
	entries = markRaw(list);
	dictionaryMode = data.remoteEmojiMode === "plus" ? "plus" : "all";
	return entries;
}

/**
 * 端末の辞書を捨てる（取得し直す前など）
 *
 * @returns なし
 * @internal
 */
export function clearRemoteEmojiDictionary(): void {
	setRemoteEmojiDictionary({});
}

/**
 * 端末の辞書を返す
 *
 * @returns 辞書（無ければ null）
 * @internal
 */
export function getRemoteEmojiEntries(): RemoteEmojiEntry[] | null {
	return entries;
}

/**
 * 端末の辞書の範囲を返す
 *
 * @returns `all` / `plus`。辞書が無ければ null
 * @internal
 */
export function getRemoteEmojiDictionaryMode(): RemoteEmojiDictionaryMode | null {
	return dictionaryMode;
}

/**
 * `name@host` が端末の辞書にあるか
 *
 * @remarks
 * 辞書が無いときは判断できないので null を返す。
 *
 * @param key - `name@host`（`:` なし）
 * @returns ある / 無い / 判断できない
 * @internal
 */
export function hasRemoteEmojiInDictionary(key: string): boolean | null {
	if (entries == null) return null;
	if (keySet == null) {
		keySet = new Set(entries.map((e) => `${e.name}@${e.host}`));
	}
	return keySet.has(key);
}

/** 索引を作るとき、画面に戻すまでに処理する件数 */
const INDEX_CHUNK_SIZE = 20000;

/**
 * 検索用の索引を返す。まだなければ作る
 *
 * @remarks
 * 名前の変換（formatRoomaji）を {@link INDEX_CHUNK_SIZE} 件ずつ行い、そのたびに画面へ処理を戻す。
 * 作っている途中で辞書が入れ替わったら、その結果は捨てて新しい辞書で作り直す。
 *
 * @returns 索引。辞書が無ければ null
 * @internal
 */
export async function ensureRemoteEmojiIndex(): Promise<RemoteEmojiIndex | null> {
	if (entries == null) return null;
	if (index) return index;
	if (indexBuilding) return await indexBuilding;

	const myGeneration = generation;
	const list = entries;
	indexBuilding = (async () => {
		const rawKeys = new Array<string>(list.length);
		for (let start = 0; start < list.length; start += INDEX_CHUNK_SIZE) {
			const end = Math.min(start + INDEX_CHUNK_SIZE, list.length);
			for (let i = start; i < end; i++) {
				rawKeys[i] = formatRoomajiUncached(list[i].name);
			}
			// 画面を止めないよう、一区切りごとに処理を戻す
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		const order = Uint32Array.from({ length: list.length }, (_, i) => i).sort(
			(a, b) => (rawKeys[a] < rawKeys[b] ? -1 : rawKeys[a] > rawKeys[b] ? 1 : 0),
		);
		const keys = Array.from(order, (i) => rawKeys[i]);
		return markRaw({ keys, order }) as RemoteEmojiIndex;
	})();

	const built = await indexBuilding;
	if (myGeneration !== generation) {
		// 作っている間に辞書が入れ替わった
		return await ensureRemoteEmojiIndex();
	}
	index = built;
	indexBuilding = null;
	return built;
}

/**
 * 昇順の配列で、`prefix` で始まる要素の最初の位置を求める
 *
 * @param keys - 昇順の配列
 * @param prefix - 前方一致させる文字列
 * @returns 最初の位置（無ければ、入るべき位置）
 * @internal
 */
export function lowerBound(keys: string[], prefix: string): number {
	let lo = 0;
	let hi = keys.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (keys[mid] < prefix) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}
