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
		return;
	}

	localStorage.setItem("wallpapers", JSON.stringify(wallpapers));
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
// #endregion

// #region レジストリ同期
/**
 * レジストリから同期壁紙URL一覧を取得する。
 *
 * @param uaClass レジストリキーの振り分けに使うUAクラス
 * @returns レジストリに保存されている壁紙URL一覧
 * @internal
 */
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

/**
 * ローカルエントリとレジストリの内容をマージする。
 *
 * @remarks
 * マージルール:
 * - ローカル synced=true かつレジストリにある → synced=true のまま残す
 * - ローカル synced=true かつレジストリに無い → 他端末で削除/OFF された → 除去する
 * - ローカル synced=false → ローカル専用なので無条件に残す
 * - レジストリにあるがローカルに無い → 他端末が追加した → synced=true で追加する
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

	// レジストリにあるがローカルに無いものは他端末が追加した壁紙
	for (const url of registryWallpapers) {
		if (!localMap.has(url)) {
			result.push({ url, synced: true });
		}
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
// #endregion

// #region 公開 API
/**
 * 壁紙一覧を読み込む。
 *
 * @remarks
 * ローカルを主体とし、レジストリの内容とマージして他端末の変更を取り込む。
 * マージ結果は localStorage に書き戻し、表示キャッシュも更新する。
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

	const registryWallpapers = await fetchSyncedWallpapers(uaClass);
	const mergedEntries = mergeWithRegistry(localEntries, registryWallpapers);
	// マージ結果をローカルに書き戻し、他端末の変更を反映する
	writeLocalWallpaperEntries(mergedEntries);
	updateWallpapersDisplayCache(mergedEntries);
	return mergedEntries;
}

/**
 * 新しい壁紙URLを追加する。
 *
 * @remarks
 * 追加時点では synced=false（ローカル専用）として保存する。
 * localStorage が信頼源のため、レジストリの取得は不要。
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
 * ローカルから削除し、対象が synced=true だった場合はレジストリからも削除する。
 * レジストリ永続化はベストエフォートで行い、失敗時はロールバックする。
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
	const removedEntry = currentEntries.find((entry) => entry.url === url);
	const nextEntries = normalizeEntries(
		currentEntries.filter((entry) => entry.url !== url),
	);

	// ローカルから削除
	writeLocalWallpaperEntries(nextEntries);
	updateWallpapersDisplayCache(nextEntries);

	// 削除対象が synced=true だった場合のみレジストリを更新
	if (removedEntry?.synced) {
		const nextSyncedWallpapers = nextEntries
			.filter((entry) => entry.synced)
			.map((entry) => entry.url);
		try {
			await persistSyncedWallpapers(nextSyncedWallpapers, uaClass);
		} catch (err) {
			// ロールバック
			writeLocalWallpaperEntries(currentEntries);
			updateWallpapersDisplayCache(currentEntries);
			throw err;
		}
	}
	return nextEntries;
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
