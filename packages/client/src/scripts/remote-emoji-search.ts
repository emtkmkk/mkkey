/**
 * @packageDocumentation
 *
 * 他鯖絵文字の検索と存在の確認。端末の辞書があればそれを使い、無ければサーバーに問い合わせる。
 *
 * @remarks
 * 使い分け（{@link searchRemoteEmojis}）:
 *
 * | 端末の辞書 | 使う検索 |
 * | --- | --- |
 * | `all`（全部） | 端末で検索（エイリアスは辞書に無いので名前だけ） |
 * | `plus`（ミニ） | 端末で検索し、名前の数が足りなければサーバーの結果で補う |
 * | 無い | サーバーで検索（`emojis/search-remote`。名前とエイリアス） |
 *
 * 結果の形は、どちらで探しても同じにする。
 * - 前方一致（`start`）と部分一致（`partial`）に分ける。キーワードが 2 つ以上なら部分一致だけ。
 * - 名前の並びは「前方一致が先 → formatRoomaji した名前が短い順 → 名前順」。
 * - 同じ名前は {@link DEFAULT_PER_NAME} サーバーまで（同名の絵文字で結果が埋まらないように）。
 * - この利用者に見えるローカル絵文字と同じ名前のものは除く。
 *
 * サーバー検索では 3 文字未満の 1 語は前方一致だけになる（サーバー側の制約）。端末の検索は文字数によらず部分一致も探す。
 *
 * @internal
 */
import { api } from "@/os";
import { emojiMap } from "@/instance";
import {
	ensureRemoteEmojiIndex,
	getRemoteEmojiDictionaryMode,
	getRemoteEmojiEntries,
	hasRemoteEmojiInDictionary,
	lowerBound,
	type RemoteEmojiEntry,
} from "@/scripts/remote-emoji-dictionary";

/** 返す名前の数の既定値（名前ごとに最大 3 サーバーなので、最大 99 件） */
export const DEFAULT_NAME_LIMIT = 33;

/** 1 つの名前につき返すサーバーの数の既定値 */
export const DEFAULT_PER_NAME = 3;

/**
 * 他鯖絵文字の検索条件
 *
 * @internal
 */
export type RemoteEmojiSearchQuery = {
	/** formatRoomaji 済みの検索語。2 つ以上なら AND 検索 */
	keywords: string[];
	/** エイリアスと完全一致で比べる語（サーバー検索だけで使う） */
	aliasQueries?: string[];
	/** ホスト名の一部 */
	host?: string;
	/** 返す名前の数 */
	limit?: number;
	/** 1 つの名前につき返すサーバーの数 */
	perName?: number;
};

/**
 * 他鯖絵文字の検索結果
 *
 * @internal
 */
export type RemoteEmojiSearchResult = {
	/** 前方一致（またはエイリアスの完全一致） */
	start: RemoteEmojiEntry[];
	/** 部分一致 */
	partial: RemoteEmojiEntry[];
	/** どこで探したか */
	source: "local" | "server" | "mixed";
};

/** 名前ごとにまとめた途中の結果 */
type NameGroup = {
	name: string;
	key: string;
	prefix: boolean;
	hosts: RemoteEmojiEntry[];
};

/**
 * ローカル絵文字と同じ名前か（この利用者に見えるローカル絵文字だけを見る）
 *
 * @param name - 絵文字名
 * @returns 同じ名前のローカル絵文字があれば true
 * @internal
 */
function isLocalName(name: string): boolean {
	return emojiMap.value.has(name.toLowerCase());
}

/**
 * 名前ごとのまとまりを並べ、件数を切って、前方一致と部分一致に分ける
 *
 * @param groups - 名前ごとのまとまり
 * @param limit - 名前の数
 * @param perName - 1 つの名前のサーバー数
 * @returns 前方一致と部分一致
 * @internal
 */
function finish(
	groups: Iterable<NameGroup>,
	limit: number,
	perName: number,
): Pick<RemoteEmojiSearchResult, "start" | "partial"> {
	const sorted = [...groups].sort(
		(a, b) =>
			Number(b.prefix) - Number(a.prefix) ||
			a.key.length - b.key.length ||
			(a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
	);
	const start: RemoteEmojiEntry[] = [];
	const partial: RemoteEmojiEntry[] = [];
	for (const g of sorted.slice(0, limit)) {
		(g.prefix ? start : partial).push(...g.hosts.slice(0, perName));
	}
	return { start, partial };
}

/**
 * 端末の辞書で探す
 *
 * @param query - 検索条件
 * @returns 名前ごとのまとまり。辞書が無ければ null
 * @internal
 */
async function searchLocal(
	query: RemoteEmojiSearchQuery,
): Promise<Map<string, NameGroup> | null> {
	const list = getRemoteEmojiEntries();
	const idx = await ensureRemoteEmojiIndex();
	if (list == null || idx == null) return null;

	const keywords = query.keywords.filter((k) => k !== "");
	const groups = new Map<string, NameGroup>();
	if (keywords.length === 0) return groups;
	const host = query.host;

	const add = (position: number, prefix: boolean) => {
		const entry = list[idx.order[position]];
		if (host && !entry.host.includes(host)) return;
		if (isLocalName(entry.name)) return;
		const group = groups.get(entry.name);
		if (group) {
			group.hosts.push(entry);
			if (prefix) group.prefix = true;
		} else {
			groups.set(entry.name, {
				name: entry.name,
				key: idx.keys[position],
				prefix,
				hosts: [entry],
			});
		}
	};

	if (keywords.length === 1) {
		const keyword = keywords[0];
		// 前方一致は二分探索で範囲を求める
		const from = lowerBound(idx.keys, keyword);
		let to = from;
		while (to < idx.keys.length && idx.keys[to].startsWith(keyword)) {
			add(to, true);
			to++;
		}
		// 部分一致は前方一致の範囲の外だけを見る
		for (let i = 0; i < idx.keys.length; i++) {
			if (i === from && to > from) {
				i = to - 1;
				continue;
			}
			if (idx.keys[i].includes(keyword)) add(i, false);
		}
	} else {
		for (let i = 0; i < idx.keys.length; i++) {
			const key = idx.keys[i];
			if (keywords.every((k) => key.includes(k))) add(i, false);
		}
	}
	return groups;
}

/** サーバー検索の結果のキャッシュ（入力を消して戻ったときに問い合わせ直さない） */
const serverCache = new Map<string, NameGroup[]>();

/** {@link serverCache} の上限 */
const SERVER_CACHE_MAX = 30;

/**
 * サーバーで探す
 *
 * @param query - 検索条件
 * @returns 名前ごとのまとまり（サーバーが決めた順）
 * @internal
 */
async function searchServer(query: RemoteEmojiSearchQuery): Promise<NameGroup[]> {
	const keywords = query.keywords.filter((k) => k !== "");
	if (keywords.length === 0) return [];
	const params = {
		keywords,
		...(query.aliasQueries?.length ? { aliasQueries: query.aliasQueries } : {}),
		...(query.host ? { host: query.host } : {}),
		limit: query.limit ?? DEFAULT_NAME_LIMIT,
		perName: query.perName ?? DEFAULT_PER_NAME,
	};
	const cacheKey = JSON.stringify(params);
	const hit = serverCache.get(cacheKey);
	if (hit) return hit;

	const res = (await api("emojis/search-remote", params)) as {
		emojis: (RemoteEmojiEntry & { prefix: boolean })[];
	};
	const groups = new Map<string, NameGroup>();
	for (const e of res.emojis ?? []) {
		if (isLocalName(e.name)) continue;
		const entry: RemoteEmojiEntry = e.sensitive
			? { name: e.name, host: e.host, sensitive: true }
			: { name: e.name, host: e.host };
		const group = groups.get(e.name);
		if (group) group.hosts.push(entry);
		else {
			groups.set(e.name, {
				name: e.name,
				// 並びはサーバーで決まっているので、長さは使わない（finish で順番が崩れないよう 0 にする）
				key: "",
				prefix: e.prefix,
				hosts: [entry],
			});
		}
	}
	const result = [...groups.values()];
	if (serverCache.size >= SERVER_CACHE_MAX) serverCache.clear();
	serverCache.set(cacheKey, result);
	return result;
}

/**
 * 他鯖絵文字を探す（端末の辞書かサーバーかを自動で選ぶ）
 *
 * @param query - 検索条件
 * @returns 前方一致と部分一致
 * @throws サーバー検索が失敗したとき（回数の制限など）は、そのエラーをそのまま投げる
 * @internal
 */
export async function searchRemoteEmojis(
	query: RemoteEmojiSearchQuery,
): Promise<RemoteEmojiSearchResult> {
	const limit = query.limit ?? DEFAULT_NAME_LIMIT;
	const perName = query.perName ?? DEFAULT_PER_NAME;
	const mode = getRemoteEmojiDictionaryMode();

	if (mode != null) {
		const local = await searchLocal(query);
		if (local != null) {
			if (mode === "all" || local.size >= limit) {
				return { ...finish(local.values(), limit, perName), source: "local" };
			}
			// ミニの辞書で足りないときは、サーバーの結果を後ろに足す
			const localResult = finish(local.values(), limit, perName);
			const server = await searchServer({ ...query, limit, perName });
			const seen = new Set(
				[...localResult.start, ...localResult.partial].map((e) => `${e.name}@${e.host}`),
			);
			let names = local.size;
			for (const g of server) {
				if (names >= limit) break;
				if (local.has(g.name)) continue;
				const hosts = g.hosts.filter((e) => !seen.has(`${e.name}@${e.host}`));
				if (hosts.length === 0) continue;
				(g.prefix ? localResult.start : localResult.partial).push(
					...hosts.slice(0, perName),
				);
				names++;
			}
			return { ...localResult, source: "mixed" };
		}
	}

	const server = await searchServer({ ...query, limit, perName });
	const start: RemoteEmojiEntry[] = [];
	const partial: RemoteEmojiEntry[] = [];
	for (const g of server) {
		(g.prefix ? start : partial).push(...g.hosts.slice(0, perName));
	}
	return { start, partial, source: "server" };
}

/**
 * 他鯖絵文字（`name@host`）のうち、まだあるものを返す
 *
 * @remarks
 * 端末に `all` の辞書があればそれで判断する。ミニの辞書や辞書が無いときは、辞書に無くても
 * あることがあるのでサーバーに問い合わせる（`emojis/remote-exists`）。
 *
 * @param keys - `name@host`（前後の `:` は付いていてもよい）
 * @returns まだある絵文字の `name@host`（`:` なし）
 * @throws サーバーへの問い合わせが失敗したとき
 * @internal
 */
export async function findExistingRemoteEmojis(keys: string[]): Promise<Set<string>> {
	const normalized = [
		...new Set(keys.map((k) => k.replace(/^:|:$/g, "")).filter((k) => k.includes("@"))),
	];
	if (normalized.length === 0) return new Set();

	if (getRemoteEmojiDictionaryMode() === "all") {
		return new Set(normalized.filter((k) => hasRemoteEmojiInDictionary(k) === true));
	}
	const res = (await api("emojis/remote-exists", { emojis: normalized })) as {
		exists: string[];
	};
	return new Set(res.exists ?? []);
}

/**
 * 他鯖絵文字（`name@host`）が 1 つ、まだあるか
 *
 * @remarks
 * 絵文字デッキ・カテゴリ編集で「同名のローカル絵文字に変換」を出すかどうかの判断に使う。
 * 問い合わせに失敗したときは「まだある」とみなす（変換を勧めない側に倒す）。
 *
 * @param key - `name@host`（前後の `:` は付いていてもよい）
 * @returns まだあれば true
 * @internal
 */
export async function isRemoteEmojiStillThere(key: string): Promise<boolean> {
	const normalized = key.replace(/^:|:$/g, "");
	try {
		return (await findExistingRemoteEmojis([normalized])).has(normalized);
	} catch {
		return true;
	}
}
