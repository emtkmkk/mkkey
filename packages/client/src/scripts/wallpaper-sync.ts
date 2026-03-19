/**
 * @packageDocumentation
 *
 * 壁紙のローカル保存とレジストリ同期を管理するモジュール。
 *
 * @remarks
 * - localStorage の `wallpaperEntries` には非同期対象（synced=false）の壁紙のみを保存する。
 * - レジストリには同期対象（synced=true）の壁紙のみを保存する。
 * - 表示用キャッシュとして `wallpapers` には両者をマージした一覧を書き込む。
 *
 * NOTE: `wallpapers` は boot.js のランダム表示で使われるため、読み込み時に必ず更新する。
 *
 * @public
 */
import { $i } from "@/account";
import { api } from "@/os";
import { stream } from "@/stream";
import { getCurrentUaClass } from "@/scripts/backup";

// #region 定数・型
const scope = ["client", "wallpaperSync"];
const connection = $i ? stream.useChannel("main") : null;
const wallpaperEntriesStorageKey = "wallpaperEntries";

export type WallpaperSyncUaClass = "mobile" | "desktop";

/**
 * 壁紙エントリを表す型。
 *
 * @remarks
 * `synced=true` はレジストリ管理、`synced=false` はローカル管理を示す。
 *
 * @public
 */
export type WallpaperEntry = {
	url: string;
	synced: boolean;
};
// #endregion

// #region 基本ヘルパー
function getRegistryKey(uaClass: WallpaperSyncUaClass): string {
	return `${uaClass}Wallpapers`;
}

/**
 * 現在のUAクラス（mobile/desktop）を返す。
 *
 * @remarks
 * レジストリキーの振り分けに使用する。
 *
 * @returns 現在端末のUAクラス
 * @public
 */
export function getWallpaperSyncUaClass(): WallpaperSyncUaClass {
	return getCurrentUaClass();
}

function normalizeEntries(entries: WallpaperEntry[]): WallpaperEntry[] {
	const map = new Map<string, WallpaperEntry>();

	for (const entry of entries) {
		if (!entry?.url) continue;
		map.set(entry.url, {
			url: entry.url,
			synced: entry.synced === true,
		});
	}

	return [...map.values()];
}

/**
 * 表示キャッシュ `wallpapers` の内容を取得する。
 *
 * @returns 表示用の壁紙URL一覧
 * @public
 */
export function readLocalWallpapers(): string[] {
	return JSON.parse(localStorage.getItem("wallpapers") ?? "[]") || [];
}

function writeLocalWallpapers(wallpapers: string[]): void {
	if (wallpapers.length === 0) {
		localStorage.removeItem("wallpapers");
		return;
	}

	localStorage.setItem("wallpapers", JSON.stringify(wallpapers));
}
// #endregion

// #region ローカル保存
/**
 * ローカル管理対象（synced=false）の壁紙エントリ一覧を取得する。
 *
 * @remarks
 * - `wallpaperEntries` が null の場合のみ、旧形式 `wallpapers` から一度限りの移行を行う。
 *   移行後は `wallpaperEntries` に `"[]"` 以上が書き込まれるため再移行は起きない。
 * - `synced=true` が混在していても除外し、ローカルには非同期対象のみを残す。
 *
 * @returns ローカル保存される壁紙エントリ一覧
 * @public
 */
export function readLocalWallpaperEntries(): WallpaperEntry[] {
	const savedEntries = localStorage.getItem(wallpaperEntriesStorageKey);
	if (savedEntries == null) {
		// NOTE: 旧形式（wallpapers のみ）からの一度限りの移行。
		// writeLocalWallpaperEntries が必ず wallpaperEntries を書き込むため、
		// 次回以降は null にならず移行は再実行されない。
		const migrated = readLocalWallpapers().map((url) => ({
			url,
			synced: false,
		}));
		return writeLocalWallpaperEntries(migrated);
	}

	// NOTE: ローカルには非同期対象のみを残す。旧実装の残骸（synced=true）は除外する。
	const normalized = normalizeEntries(JSON.parse(savedEntries) as WallpaperEntry[]);
	const localOnly = normalized
		.filter((entry) => !entry.synced)
		.map((entry) => ({
			url: entry.url,
			synced: false,
		}));
	return localOnly;
}

/**
 * ローカル管理の壁紙エントリを localStorage に書き込む。
 *
 * @remarks
 * 空配列でも必ず `"[]"` を書き込み、キーを削除しない。
 * これにより `readLocalWallpaperEntries` の旧形式移行が一度しか走らないことを保証する。
 *
 * @param entries 書き込む壁紙エントリ（synced=true は自動除外される）
 * @returns 実際に書き込まれたローカル専用エントリ
 * @internal
 */
function writeLocalWallpaperEntries(entries: WallpaperEntry[]): WallpaperEntry[] {
	const localOnly = normalizeEntries(entries)
		.filter((entry) => !entry.synced)
		.map((entry) => ({
			url: entry.url,
			synced: false,
		}));
	// NOTE: 空でも必ず書き込む。キーが null にならないことで旧形式移行の再実行を防止する。
	localStorage.setItem(wallpaperEntriesStorageKey, JSON.stringify(localOnly));
	return localOnly;
}

function updateWallpapersDisplayCache(entries: WallpaperEntry[]): void {
	// NOTE: boot.js と各 UI は `wallpapers` を参照するため、表示用一覧を都度更新する。
	writeLocalWallpapers(normalizeEntries(entries).map((entry) => entry.url));
}
// #endregion

// #region レジストリ同期
async function fetchSyncedWallpapers(
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<string[]> {
	if ($i == null) return [];

	const values = ((await api("i/registry/get-all", { scope })) || {}) as Record<
		string,
		unknown
	>;
	const registryKey = getRegistryKey(uaClass);
	return Array.isArray(values[registryKey])
		? (values[registryKey] as string[])
		: [];
}

function mergeWallpaperEntries(
	localEntries: WallpaperEntry[],
	syncedWallpapers: string[],
): WallpaperEntry[] {
	const unsyncedEntries = localEntries.map((entry) => ({
		url: entry.url,
		synced: false,
	}));
	const syncedEntries = syncedWallpapers.map((url) => ({
		url,
		synced: true,
	}));
	return normalizeEntries([...unsyncedEntries, ...syncedEntries]);
}

async function persistSyncedWallpapers(
	syncedWallpapers: string[],
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<void> {
	if ($i == null) return;

	const key = getRegistryKey(uaClass);

	if (syncedWallpapers.length === 0) {
		await api("i/registry/remove", {
			scope,
			key,
		});
		return;
	}

	await api("i/registry/set", {
		scope,
		key,
		value: syncedWallpapers,
	});
}
// #endregion

// #region 公開 API
/**
 * 壁紙一覧を読み込む。
 *
 * @remarks
 * ローカル（非同期）とレジストリ（同期）をマージし、
 * `wallpapers` キャッシュを更新したうえで一覧を返す。
 *
 * @param uaClass レジストリ参照に使うUAクラス
 * @returns マージ済みの壁紙一覧
 * @public
 */
export async function loadWallpaperEntries(
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	if ($i == null) {
		updateWallpapersDisplayCache(localEntries);
		return localEntries;
	}

	const syncedWallpapers = await fetchSyncedWallpapers(uaClass);
	const mergedEntries = mergeWallpaperEntries(localEntries, syncedWallpapers);
	updateWallpapersDisplayCache(mergedEntries);
	return mergedEntries;
}

/**
 * 新しい壁紙URLを追加する。
 *
 * @remarks
 * 追加時点では非同期（ローカル）として保存する。
 *
 * @param urls 追加する壁紙URL一覧
 * @returns マージ済みの壁紙一覧
 * @public
 */
export async function addWallpaperEntries(
	urls: string[],
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	const nextLocalEntries = writeLocalWallpaperEntries([
		...localEntries,
		...urls.map((url) => ({ url, synced: false })),
	]);
	if ($i == null) {
		updateWallpapersDisplayCache(nextLocalEntries);
		return nextLocalEntries;
	}

	const syncedWallpapers = await fetchSyncedWallpapers();
	const mergedEntries = mergeWallpaperEntries(nextLocalEntries, syncedWallpapers);
	updateWallpapersDisplayCache(mergedEntries);
	return mergedEntries;
}

/**
 * 壁紙の同期状態を切り替える。
 *
 * @remarks
 * - ON: レジストリへ保存し、ローカル保存からは外す。
 * - OFF: ローカルへ保存し、レジストリ保存からは外す。
 *
 * @param url 対象壁紙URL
 * @param synced 切り替え後の同期状態
 * @param uaClass レジストリ参照に使うUAクラス
 * @returns 切り替え後のマージ済み壁紙一覧
 * @public
 */
export async function setWallpaperEntrySyncState(
	url: string,
	synced: boolean,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	const syncedWallpapers = await fetchSyncedWallpapers(uaClass);
	const currentEntries = mergeWallpaperEntries(localEntries, syncedWallpapers);
	const hasTargetEntry = currentEntries.some((entry) => entry.url === url);
	const nextEntries = normalizeEntries([
		...currentEntries.map((entry) =>
			entry.url === url ? { ...entry, synced } : entry,
		),
		...(hasTargetEntry ? [] : [{ url, synced }]),
	]);
	const nextSyncedWallpapers = nextEntries
		.filter((entry) => entry.synced)
		.map((entry) => entry.url);
	const nextLocalEntries = nextEntries
		.filter((entry) => !entry.synced)
		.map((entry) => ({
			url: entry.url,
			synced: false,
		}));

	// NOTE: レジストリへの永続化を先に行い、成功してからローカルを更新する。
	// 先にローカルを更新すると、persistSyncedWallpapers が失敗した場合に
	// 壁紙がローカルからもレジストリからも消失するデータロスが発生する。
	// registryUpdated イベントが先に到着しても、マージ関数が synced 優先で
	// 正しく解決するため、順序による不整合は起きない。
	await persistSyncedWallpapers(nextSyncedWallpapers, uaClass);
	writeLocalWallpaperEntries(nextLocalEntries);
	updateWallpapersDisplayCache(nextEntries);
	return nextEntries;
}

/**
 * 壁紙エントリを削除する。
 *
 * @remarks
 * 対象が同期壁紙ならレジストリから、非同期壁紙ならローカルから削除する。
 *
 * @param url 削除対象の壁紙URL
 * @param uaClass レジストリ参照に使うUAクラス
 * @returns 削除後のマージ済み壁紙一覧
 * @public
 */
export async function removeWallpaperEntry(
	url: string,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	const syncedWallpapers = await fetchSyncedWallpapers(uaClass);
	const currentEntries = mergeWallpaperEntries(localEntries, syncedWallpapers);
	const nextEntries = normalizeEntries(currentEntries.filter((entry) => entry.url !== url));
	const nextSyncedWallpapers = nextEntries
		.filter((entry) => entry.synced)
		.map((entry) => entry.url);
	const nextLocalEntries = nextEntries
		.filter((entry) => !entry.synced)
		.map((entry) => ({
			url: entry.url,
			synced: false,
		}));

	// NOTE: レジストリを先に更新（setWallpaperEntrySyncState と同じ理由）
	await persistSyncedWallpapers(nextSyncedWallpapers, uaClass);
	writeLocalWallpaperEntries(nextLocalEntries);
	updateWallpapersDisplayCache(nextEntries);
	return nextEntries;
}

/**
 * 壁紙同期機能を初期化する。
 *
 * @remarks
 * 初回読み込み後、`registryUpdated` で他デバイス更新を取り込み、
 * ローカル保存と表示キャッシュを更新する。
 *
 * @returns 初期化完了を表す Promise
 * @public
 */
export async function initializeWallpaperSync(): Promise<void> {
	if ($i == null) return;

	const uaClass = getWallpaperSyncUaClass();
	await loadWallpaperEntries(uaClass);

	connection?.on("registryUpdated", ({ scope: updatedScope, key, value }) => {
		if (
			updatedScope.length !== 2 ||
			updatedScope[0] !== scope[0] ||
			updatedScope[1] !== scope[1] ||
			key !== getRegistryKey(uaClass)
		) {
			return;
		}

		const mergedEntries = mergeWallpaperEntries(
			readLocalWallpaperEntries(),
			Array.isArray(value) ? (value as string[]) : [],
		);
		writeLocalWallpaperEntries(mergedEntries);
		updateWallpapersDisplayCache(mergedEntries);
	});
}
// #endregion
