/**
 * @packageDocumentation
 *
 * 壁紙のローカル保存とレジストリ同期を管理するモジュール。
 *
 * @remarks
 * - localStorage の `wallpaperEntries` を唯一の信頼源（Single Source of Truth）とし、
 *   全エントリ（synced=true / synced=false）を保持する。
 * - レジストリには synced=true のエントリのコピーを保存し、他端末との同期に使用する。
 * - 表示用キャッシュ `wallpapers` には全エントリの URL を書き込む（boot.js 用）。
 * - 削除した壁紙URL は `wallpaperDeletedUrls` にブラックリストとして記録し、
 *   レジストリの古いデータによるリロード時の復活を防止する。
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
const deletedWallpaperUrlsKey = "wallpaperDeletedUrls";
const legacySingleWallpaperStorageKey = "wallpaper";
export type WallpaperSyncUaClass = "mobile" | "desktop";

/**
 * 壁紙エントリを表す型。
 *
 * @remarks
 * `synced=true` はレジストリにも同期される壁紙、`synced=false` はローカル専用の壁紙を示す。
 * いずれも localStorage に保存される。
 *
 * @public
 */
export type WallpaperEntry = {
	url: string;
	synced: boolean;
};
// #endregion

// #region 基本ヘルパー
/**
 * レジストリキーを取得する。
 *
 * @param uaClass UAクラス
 * @returns レジストリキー文字列
 * @internal
 */
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

/**
 * 壁紙エントリ配列を正規化する（URLで重複排除）。
 *
 * @remarks
 * 同じURLが複数ある場合、後のエントリが優先される（Mapの上書き）。
 *
 * @param entries 正規化対象のエントリ配列
 * @returns 重複排除された壁紙エントリ配列
 * @internal
 */
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

/**
 * 表示キャッシュ `wallpapers` に壁紙URL一覧を書き込む。
 *
 * @param wallpapers 書き込む壁紙URL一覧
 * @internal
 */
function writeLocalWallpapers(wallpapers: string[]): void {
	if (wallpapers.length === 0) {
		localStorage.removeItem("wallpapers");
		localStorage.removeItem(legacySingleWallpaperStorageKey);
		return;
	}

	localStorage.setItem("wallpapers", JSON.stringify(wallpapers));

	const legacyWallpaper = localStorage.getItem(legacySingleWallpaperStorageKey);
	if (legacyWallpaper != null && !wallpapers.includes(legacyWallpaper)) {
		localStorage.removeItem(legacySingleWallpaperStorageKey);
	}
}
// #endregion

// #region 削除ブラックリスト
/**
 * 削除済み壁紙URLのブラックリストを読み取る。
 *
 * @remarks
 * 壁紙を削除した後、レジストリに古いデータが残っている場合でも
 * `mergeWithRegistry` で再追加されないよう防止するための仕組み。
 * レジストリへの永続化が成功した時点でブラックリストから解除される。
 *
 * @returns 削除済みURLの Set
 * @internal
 */
function readDeletedWallpaperUrls(): Set<string> {
	const raw = localStorage.getItem(deletedWallpaperUrlsKey);
	if (raw == null) return new Set();
	try {
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
	} catch {
		return new Set();
	}
}

/**
 * 削除済み壁紙URLのブラックリストを書き込む。
 *
 * @param urls ブラックリスト対象のURL Set
 * @internal
 */
function writeDeletedWallpaperUrls(urls: Set<string>): void {
	if (urls.size === 0) {
		localStorage.removeItem(deletedWallpaperUrlsKey);
	} else {
		localStorage.setItem(deletedWallpaperUrlsKey, JSON.stringify([...urls]));
	}
}

/**
 * 壁紙URLを削除ブラックリストに追加する。
 *
 * @param url ブラックリストに追加するURL
 * @internal
 */
function markWallpaperAsDeleted(url: string): void {
	const deleted = readDeletedWallpaperUrls();
	deleted.add(url);
	writeDeletedWallpaperUrls(deleted);
}

/**
 * 壁紙URLを削除ブラックリストから解除する。
 *
 * @param url ブラックリストから解除するURL
 * @internal
 */
function unmarkWallpaperAsDeleted(url: string): void {
	const deleted = readDeletedWallpaperUrls();
	if (!deleted.has(url)) return;
	deleted.delete(url);
	writeDeletedWallpaperUrls(deleted);
}
// #endregion

// #region ローカル保存
/**
 * localStorage から全壁紙エントリ（synced=true / false 両方）を取得する。
 *
 * @remarks
 * - `wallpaperEntries` が null の場合のみ、旧形式 `wallpapers` から一度限りの移行を行う。
 *   移行後は `wallpaperEntries` に必ず値が書き込まれるため再移行は起きない。
 * - localStorage が唯一の信頼源であり、synced フラグもここに保存される。
 *
 * @returns 全壁紙エントリ一覧
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

	// 全エントリ（synced=true / false 両方）をそのまま返す
	return normalizeEntries(JSON.parse(savedEntries) as WallpaperEntry[]);
}

/**
 * 全壁紙エントリを localStorage に書き込む。
 *
 * @remarks
 * synced フラグを含む全エントリをそのまま保存する。
 * 空配列でも必ず `"[]"` を書き込み、キーを削除しない。
 * これにより `readLocalWallpaperEntries` の旧形式移行が一度しか走らないことを保証する。
 *
 * @param entries 書き込む壁紙エントリ
 * @returns 実際に書き込まれた正規化済みエントリ
 * @internal
 */
function writeLocalWallpaperEntries(entries: WallpaperEntry[]): WallpaperEntry[] {
	const normalized = normalizeEntries(entries);
	// NOTE: 空でも必ず書き込む。キーが null にならないことで旧形式移行の再実行を防止する。
	localStorage.setItem(wallpaperEntriesStorageKey, JSON.stringify(normalized));
	return normalized;
}

/**
 * 表示用キャッシュ `wallpapers` を更新する。
 *
 * @remarks
 * boot.js と各 UI は `wallpapers` を参照するため、エントリ変更時に都度呼び出す。
 *
 * @param entries 表示対象の壁紙エントリ
 * @internal
 */
function updateWallpapersDisplayCache(entries: WallpaperEntry[]): void {
	writeLocalWallpapers(normalizeEntries(entries).map((entry) => entry.url));
}

/**
 * 旧形式の単一壁紙キーを含むローカル保存領域から対象URLを確実に削除する。
 *
 * @param url 削除対象の壁紙URL
 * @param entries 削除後の壁紙エントリ一覧
 * @internal
 */
function removeWallpaperFromLocalStorage(
	url: string,
	entries: WallpaperEntry[],
): WallpaperEntry[] {
	const nextEntries = writeLocalWallpaperEntries(entries);
	updateWallpapersDisplayCache(nextEntries);

	if (localStorage.getItem(legacySingleWallpaperStorageKey) === url) {
		localStorage.removeItem(legacySingleWallpaperStorageKey);
	}

	return nextEntries;
}
// #endregion

// #region レジストリ同期
/**
 * レジストリから同期壁紙URL一覧を取得する。
 *
 * @param uaClass レジストリキーの振り分けに使うUAクラス
 * @returns レジストリに保存されている壁紙URL一覧
 * @internal
 */
type SyncedWallpapersFetchResult = {
	exists: boolean;
	wallpapers: string[];
};

async function fetchSyncedWallpapers(
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<SyncedWallpapersFetchResult> {
	if ($i == null) {
		return {
			exists: false,
			wallpapers: [],
		};
	}

	const values = ((await api("i/registry/get-all", { scope })) || {}) as Record<
		string,
		unknown
	>;
	const registryKey = getRegistryKey(uaClass);
	const registryValue = values[registryKey];

	return {
		exists: Object.prototype.hasOwnProperty.call(values, registryKey),
		wallpapers: Array.isArray(registryValue) ? (registryValue as string[]) : [],
	};
}

/**
 * ローカルエントリとレジストリの内容をマージする。
 *
 * @remarks
 * マージルール:
 * - ローカル synced=true かつレジストリにある → synced=true のまま残す
 * - ローカル synced=true かつレジストリに無い → 他端末で削除/OFF された → 除去する
 * - ローカル synced=false → ローカル専用なので無条件に残す
 * - レジストリにあるがローカルに無い → 削除ブラックリストを確認し、
 *   ブラックリストに無ければ他端末が追加した壁紙として synced=true で追加する。
 *   ブラックリストにあればこのデバイスで削除済みなのでスキップする。
 *
 * @param localEntries ローカルの全エントリ
 * @param registryWallpapers レジストリの壁紙URL一覧
 * @returns マージ済みの壁紙エントリ一覧
 * @internal
 */
function mergeWithRegistry(
	localEntries: WallpaperEntry[],
	registryWallpapers: string[],
): WallpaperEntry[] {
	const localMap = new Map<string, WallpaperEntry>();
	for (const entry of localEntries) {
		if (entry?.url) localMap.set(entry.url, entry);
	}
	const registrySet = new Set(registryWallpapers);
	// このデバイスで削除済みの URL を取得し、レジストリからの復活を防ぐ
	const deletedUrls = readDeletedWallpaperUrls();

	const result: WallpaperEntry[] = [];

	for (const entry of localMap.values()) {
		if (entry.synced) {
			// synced=true はレジストリにも存在する場合のみ残す。
			// レジストリに無い場合は他端末が同期 OFF / 削除したとみなし除去する。
			if (registrySet.has(entry.url)) {
				result.push(entry);
			}
		} else {
			// synced=false はローカル専用なので常に残す
			result.push(entry);
		}
	}

	// レジストリにあるがローカルに無いものを処理
	for (const url of registryWallpapers) {
		if (localMap.has(url)) continue;
		if (deletedUrls.has(url)) {
			// このデバイスで削除済み → 復活させない
			continue;
		}
		// 他端末が追加した壁紙 → synced=true で追加
		result.push({ url, synced: true });
	}

	return normalizeEntries(result);
}

/**
 * 同期対象の壁紙URL一覧をレジストリに保存する。
 *
 * @remarks
 * 空配列でも `i/registry/set` で書き込む。
 * `i/registry/remove` はキーが存在しない場合にエラーとなるため使用しない。
 *
 * @param syncedWallpapers 保存する同期壁紙URL一覧（空配列可）
 * @param uaClass レジストリキーの振り分けに使うUAクラス
 * @internal
 */
async function persistSyncedWallpapers(
	syncedWallpapers: string[],
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<void> {
	if ($i == null) return;

	const key = getRegistryKey(uaClass);
	await api("i/registry/set", {
		scope,
		key,
		value: syncedWallpapers,
	});
}

/**
 * 指定URLを現在のUAクラスのレジストリ同期リストから削除する。
 *
 * @remarks
 * 削除対象は現在のUAクラスに対応するレジストリのみとし、
 * 別UAクラスの同期設定は変更しない。
 *
 * @param url 削除対象の壁紙URL
 * @param uaClass レジストリキーの振り分けに使うUAクラス
 * @internal
 */
async function removeWallpaperFromRegistry(
	url: string,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<void> {
	if ($i == null) return;

	const { wallpapers: syncedWallpapers } = await fetchSyncedWallpapers(uaClass);
	const nextSyncedWallpapers = syncedWallpapers.filter(
		(entryUrl) => entryUrl !== url,
	);

	const needsUpdate =
		nextSyncedWallpapers.length !== syncedWallpapers.length;

	if (!needsUpdate) return;

	await persistSyncedWallpapers(nextSyncedWallpapers, uaClass);
}
// #endregion

// #region 公開 API
/**
 * 壁紙一覧を読み込む。
 *
 * @remarks
 * ローカルを主体とし、レジストリの内容とマージして他端末の変更を取り込む。
 * マージ結果は localStorage に書き戻し、表示キャッシュも更新する。
 * レジストリに古いデータが残っている場合は、ベストエフォートでクリーンアップする。
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

	const { exists: registryKeyExists, wallpapers: registryWallpapers } =
		await fetchSyncedWallpapers(uaClass);
	const mergedEntries = registryKeyExists
		? mergeWithRegistry(localEntries, registryWallpapers)
		: localEntries;
	// マージ結果をローカルに書き戻し、他端末の変更を反映する
	writeLocalWallpaperEntries(mergedEntries);
	updateWallpapersDisplayCache(mergedEntries);

	// マージ後の synced リストとレジストリに差分があればクリーンアップする
	const mergedSyncedUrls = mergedEntries
		.filter((entry) => entry.synced)
		.map((entry) => entry.url);
	const sortedRegistry = [...registryWallpapers].sort();
	const sortedMerged = [...mergedSyncedUrls].sort();
	const registryNeedsUpdate =
		sortedRegistry.length !== sortedMerged.length ||
		sortedRegistry.some((url, i) => url !== sortedMerged[i]);

	if (registryNeedsUpdate) {
		try {
			await persistSyncedWallpapers(mergedSyncedUrls, uaClass);
			// レジストリ更新成功 → 削除ブラックリストをクリーンアップ
			// レジストリから古いデータが消えたため、ブラックリストの保護は不要になる
			const deletedUrls = readDeletedWallpaperUrls();
			if (deletedUrls.size > 0) {
				const mergedSyncedSet = new Set(mergedSyncedUrls);
				for (const url of deletedUrls) {
					// レジストリに残っていない URL はブラックリストから解除
					if (!mergedSyncedSet.has(url)) {
						deletedUrls.delete(url);
					}
				}
				writeDeletedWallpaperUrls(deletedUrls);
			}
		} catch {
			// クリーンアップ失敗は表示に影響しないため無視
		}
	}

	return mergedEntries;
}

/**
 * 新しい壁紙URLを追加する。
 *
 * @remarks
 * 追加時点では synced=false（ローカル専用）として保存する。
 * 以前削除した URL を再追加する場合、削除ブラックリストから解除する。
 *
 * @param urls 追加する壁紙URL一覧
 * @returns 追加後の壁紙一覧
 * @public
 */
export async function addWallpaperEntries(
	urls: string[],
): Promise<WallpaperEntry[]> {
	const currentEntries = readLocalWallpaperEntries();
	const nextEntries = writeLocalWallpaperEntries([
		...currentEntries,
		...urls.map((url) => ({ url, synced: false })),
	]);
	// 再追加された URL はブラックリストから解除
	for (const url of urls) {
		unmarkWallpaperAsDeleted(url);
	}
	updateWallpapersDisplayCache(nextEntries);
	return nextEntries;
}

/**
 * 壁紙の同期状態を切り替える。
 *
 * @remarks
 * - synced フラグを localStorage 内で直接更新する。
 * - レジストリへの永続化はベストエフォートで行い、失敗時はロールバックする。
 *
 * @param url 対象壁紙URL
 * @param synced 切り替え後の同期状態
 * @param uaClass レジストリ参照に使うUAクラス
 * @returns 切り替え後の壁紙一覧
 * @public
 */
export async function setWallpaperEntrySyncState(
	url: string,
	synced: boolean,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const currentEntries = readLocalWallpaperEntries();
	const hasTargetEntry = currentEntries.some((entry) => entry.url === url);

	// 対象エントリの synced フラグを更新
	const nextEntries = normalizeEntries([
		...currentEntries.map((entry) =>
			entry.url === url ? { ...entry, synced } : entry,
		),
		// 対象が存在しない場合は新規追加
		...(hasTargetEntry ? [] : [{ url, synced }]),
	]);

	// ローカルに全エントリを保存（synced フラグ含む）
	writeLocalWallpaperEntries(nextEntries);
	updateWallpapersDisplayCache(nextEntries);

	// レジストリに synced=true の壁紙のみベストエフォートで同期
	const nextSyncedWallpapers = nextEntries
		.filter((entry) => entry.synced)
		.map((entry) => entry.url);

	try {
		await persistSyncedWallpapers(nextSyncedWallpapers, uaClass);
	} catch (err) {
		// レジストリ永続化に失敗した場合、変更前の状態にロールバックする
		writeLocalWallpaperEntries(currentEntries);
		updateWallpapersDisplayCache(currentEntries);
		throw err;
	}
	return nextEntries;
}

/**
 * 壁紙エントリを削除する。
 *
 * @remarks
 * ローカルから削除し、削除ブラックリストに記録してリロード時の復活を防止する。
 * レジストリの同期リストも常に更新し、古いデータをクリーンアップする。
 * レジストリ更新成功時はブラックリストから解除する（レジストリに残骸がないため）。
 * レジストリ更新失敗時はブラックリストを維持して次回ロード時の復活を防ぐ。
 *
 * @param url 削除対象の壁紙URL
 * @param uaClass レジストリ参照に使うUAクラス
 * @returns 削除後の壁紙一覧
 * @public
 */
export async function removeWallpaperEntry(
	url: string,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const currentEntries = readLocalWallpaperEntries();
	const nextEntries = normalizeEntries(
		currentEntries.filter((entry) => entry.url !== url),
	);

	// ローカル保存領域から削除
	const removedEntries = removeWallpaperFromLocalStorage(url, nextEntries);
	// ブラックリストに記録してリロード時のレジストリからの復活を防ぐ
	markWallpaperAsDeleted(url);

	try {
		await removeWallpaperFromRegistry(url, uaClass);
		// レジストリ更新成功 → ブラックリストから解除（レジストリに残骸がないため不要）
		unmarkWallpaperAsDeleted(url);
	} catch {
		// レジストリ更新失敗 → ブラックリストは維持して次回ロード時の復活を防ぐ
	}
	return removedEntries;
}

/**
 * 壁紙同期機能を初期化する。
 *
 * @remarks
 * 初回読み込みで他端末の変更をマージし、
 * 以降は `registryUpdated` イベントでリアルタイムに取り込む。
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

		// 他端末からのレジストリ更新を受け取り、ローカルとマージ
		const localEntries = readLocalWallpaperEntries();
		const registryWallpapers = Array.isArray(value) ? (value as string[]) : [];
		const mergedEntries = mergeWithRegistry(localEntries, registryWallpapers);
		writeLocalWallpaperEntries(mergedEntries);
		updateWallpapersDisplayCache(mergedEntries);
	});
}
// #endregion
