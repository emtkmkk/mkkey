import { $i } from "@/account";
import { api } from "@/os";
import { stream } from "@/stream";
import { getCurrentUaClass } from "@/scripts/backup";

const scope = ["client", "wallpaperSync"];
const connection = $i ? stream.useChannel("main") : null;
const wallpaperEntriesStorageKey = "wallpaperEntries";

export type WallpaperSyncUaClass = "mobile" | "desktop";

export type WallpaperEntry = {
	url: string;
	synced: boolean;
};

function getRegistryKey(uaClass: WallpaperSyncUaClass): string {
	return `${uaClass}Wallpapers`;
}

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

export function readLocalWallpaperEntries(): WallpaperEntry[] {
	const wallpapers = readLocalWallpapers();
	const savedEntries = localStorage.getItem(wallpaperEntriesStorageKey);
	if (savedEntries != null) {
		return normalizeEntries([
			...(JSON.parse(savedEntries) as WallpaperEntry[]),
			...wallpapers.map((url) => ({
				url,
				synced: false,
			})),
		]);
	}

	const migrated = wallpapers.map((url) => ({
		url,
		synced: false,
	}));
	writeLocalWallpaperEntries(migrated);
	return migrated;
}

function writeLocalWallpaperEntries(entries: WallpaperEntry[]): WallpaperEntry[] {
	const normalized = normalizeEntries(entries);
	if (normalized.length === 0) {
		localStorage.removeItem(wallpaperEntriesStorageKey);
	} else {
		localStorage.setItem(wallpaperEntriesStorageKey, JSON.stringify(normalized));
	}

	writeLocalWallpapers(normalized.map((entry) => entry.url));
	return normalized;
}

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
	const unsyncedEntries = localEntries.filter((entry) => !entry.synced);
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

	await api("i/registry/set", {
		scope,
		key: getRegistryKey(uaClass),
		value: syncedWallpapers,
	});
}

export async function loadWallpaperEntries(
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	if ($i == null) {
		return writeLocalWallpaperEntries(localEntries);
	}

	const syncedWallpapers = await fetchSyncedWallpapers(uaClass);
	return writeLocalWallpaperEntries(
		mergeWallpaperEntries(localEntries, syncedWallpapers),
	);
}

export async function addWallpaperEntries(
	urls: string[],
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	return writeLocalWallpaperEntries([
		...localEntries,
		...urls.map((url) => ({ url, synced: false })),
	]);
}

export async function setWallpaperEntrySyncState(
	url: string,
	synced: boolean,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	const hasTargetEntry = localEntries.some((entry) => entry.url === url);
	const nextEntries = normalizeEntries([
		...localEntries.map((entry) =>
			entry.url === url ? { ...entry, synced } : entry,
		),
		...(hasTargetEntry ? [] : [{ url, synced }]),
	]);
	const syncedWallpapers = nextEntries
		.filter((entry) => entry.synced)
		.map((entry) => entry.url);

	await persistSyncedWallpapers(syncedWallpapers, uaClass);
	return writeLocalWallpaperEntries(nextEntries);
}

export async function removeWallpaperEntry(
	url: string,
	uaClass: WallpaperSyncUaClass = getWallpaperSyncUaClass(),
): Promise<WallpaperEntry[]> {
	const localEntries = readLocalWallpaperEntries();
	const nextEntries = normalizeEntries(
		localEntries.filter((entry) => entry.url !== url),
	);
	const syncedWallpapers = nextEntries
		.filter((entry) => entry.synced)
		.map((entry) => entry.url);

	await persistSyncedWallpapers(syncedWallpapers, uaClass);
	return writeLocalWallpaperEntries(nextEntries);
}

export async function initializeWallpaperSync(): Promise<void> {
	if ($i == null) return;

	const uaClass = getWallpaperSyncUaClass();
	await loadWallpaperEntries(uaClass);

	connection?.on("registryUpdated", ({ scope: updatedScope, key, value }) => {
		if (
			updatedScope.length !== 2 ||
			updatedScope[0] !== scope[0] ||
			updatedScope[1] !== scope[1] ||
			key !== getRegistryKey(uaClass) ||
			!Array.isArray(value)
		) {
			return;
		}

		writeLocalWallpaperEntries(
			mergeWallpaperEntries(readLocalWallpaperEntries(), value as string[]),
		);
	});
}
