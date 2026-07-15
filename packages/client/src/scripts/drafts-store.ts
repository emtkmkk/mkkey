/**
 * @packageDocumentation
 *
 * 投稿の下書き（未送信の投稿内容）を IndexedDB に永続化するストア。
 *
 * @remarks
 * - 実体は IndexedDB（`idb-proxy` 経由）。旧 localStorage の `drafts` キーからは
 *   起動時に一度だけ移行する。
 * - 呼び出し側（MkPostForm.vue / pages/draft.vue / init.ts）は同期的に読み書きしたいため、
 *   メモリ上のキャッシュを介した同期 API を提供する。変更はキャッシュへ即時反映し、
 *   IndexedDB への書き戻しはバックグラウンドで直列に行う。
 * - {@link draftsReady} を待ってから {@link getDraftsMap} を呼ぶこと。待たずに呼んだ場合、
 *   初期ロード完了前は空のマップを返す（＝既存下書きを見失う）ので注意。
 *
 * @public
 */
import { get, set } from "@/scripts/idb-proxy";

const STORAGE_KEY = "drafts";
const LEGACY_LOCALSTORAGE_KEY = "drafts";

export type DraftEntry = {
	updatedAt: Date | string;
	name?: string;
	data: Record<string, any>;
};

export type DraftsMap = Record<string, DraftEntry>;

let cache: DraftsMap = {};

/**
 * IndexedDB から読み込み、無ければ旧 localStorage から一度だけ移行する。
 *
 * @internal
 */
async function initialize(): Promise<void> {
	try {
		const stored = (await get(STORAGE_KEY)) as DraftsMap | undefined;
		if (stored) {
			cache = stored;
			return;
		}
	} catch (err) {
		console.error("Failed to load drafts from IndexedDB", err);
	}

	// 旧 localStorage からの一度限りの移行
	try {
		const legacy = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
		if (legacy) {
			cache = JSON.parse(legacy) as DraftsMap;
			await set(STORAGE_KEY, cache);
			localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
		}
	} catch (err) {
		console.error("Failed to migrate drafts from localStorage", err);
	}
}

const readyPromise: Promise<void> = initialize();

/**
 * 初期ロード（IndexedDB 読み込み＋旧 localStorage 移行）の完了を待つ。
 *
 * @remarks
 * {@link getDraftsMap} / {@link setDraftsMap} を初めて使う箇所（コンポーネントの
 * `onMounted` や起動処理など）で必ず一度 await すること。
 *
 * @public
 */
export async function draftsReady(): Promise<void> {
	await readyPromise;
}

// IndexedDB への書き戻しを直列化するためのキュー
let flushQueue: Promise<void> = Promise.resolve();

function scheduleFlush(): void {
	const snapshot = cache;
	flushQueue = flushQueue
		.catch(() => {
			// 前回の書き込み失敗はここで握りつぶし、最新状態の書き込みは継続する
		})
		.then(() => set(STORAGE_KEY, snapshot))
		.catch((err) => {
			console.error("Failed to persist drafts to IndexedDB", err);
		});
}

/**
 * 下書き全体のマップを返す（キャッシュの参照）。
 *
 * @remarks
 * 返り値を直接書き換えたうえで {@link setDraftsMap} に渡す使い方を想定している。
 *
 * @returns 下書きマップ
 * @public
 */
export function getDraftsMap(): DraftsMap {
	return cache;
}

/**
 * 下書き全体のマップを置き換え、バックグラウンドで IndexedDB に永続化する。
 *
 * @param map - 保存するマップ（{@link getDraftsMap} で取得したものを直接書き換えて渡してよい）
 * @public
 */
export function setDraftsMap(map: DraftsMap): void {
	cache = map;
	scheduleFlush();
}
