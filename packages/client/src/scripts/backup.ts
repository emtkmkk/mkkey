
import { v4 as uuid } from "uuid";
import * as os from "@/os";
import { ColdDeviceStorage, defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { i18n } from "@/i18n";
import { version, host } from "@/config";
const { t, ts } = i18n;

type Profile = {
	name: string;
	createdAt: string;
	updatedAt: string | null;
	misskeyVersion: string;
	host: string;
	kind?: "auto" | "manual";
	uaClass?: "mobile" | "desktop";
	clientId?: string;
	settings: {
		hot: Record<keyof typeof defaultStore.def, unknown>;
		cold: Record<keyof typeof ColdDeviceStorage.default, unknown>;
		fontSize: string | null;
		avatarSize: string | null;
		useSystemFont: "t" | null;
		wallpaper: string | null;
		wallpapers: string | null;
	};
};

const scope = ["clientPreferencesProfiles"];
const autoSaveClientIdStorageKey = "autoSaveClientId";
const autoSaveMaxPerUaClass = 5;

function getDateValue(value: string | null | undefined): number {
	if (!value) return Number.NEGATIVE_INFINITY;
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return Number.NEGATIVE_INFINITY;
	return parsed;
}

export function getCurrentUaClass(): "mobile" | "desktop" {
	return /mobile|iphone|android/.test(navigator.userAgent.toLowerCase())
		? "mobile"
		: "desktop";
}

function getAutoSaveClientId(): string {
	const saved = localStorage.getItem(autoSaveClientIdStorageKey);
	if (saved) return saved;

	const created = uuid();
	localStorage.setItem(autoSaveClientIdStorageKey, created);
	return created;
}

export function getProfileUaClass(profile: Profile): "mobile" | "desktop" | null {
	if (profile.uaClass === "mobile" || profile.uaClass === "desktop") {
		return profile.uaClass;
	}

	if (profile.name === "AutoSave: mobile") {
		return "mobile";
	}

	if (profile.name === "AutoSave: desktop") {
		return "desktop";
	}

	return null;
}

export function isAutoProfile(profile: Profile): boolean {
	if (profile.kind === "auto") return true;
	return profile.name === "AutoSave: mobile" || profile.name === "AutoSave: desktop";
}

function sortByUpdatedAtDesc(
	a: [string, Profile],
	b: [string, Profile],
): number {
	const aTime = getDateValue(a[1].updatedAt ?? a[1].createdAt);
	const bTime = getDateValue(b[1].updatedAt ?? b[1].createdAt);

	if (aTime === bTime) {
		return a[0].localeCompare(b[0]);
	}

	return bTime - aTime;
}

async function cleanupOldAutoSaves(
	profiles: Record<string, Profile>,
	uaClass: "mobile" | "desktop",
): Promise<void> {
	const autoProfiles = Object.entries(profiles)
		.filter(([, value]) => isAutoProfile(value))
		.filter(([, value]) => getProfileUaClass(value) === uaClass)
		.sort(sortByUpdatedAtDesc);

	const removeTargets = autoProfiles.slice(autoSaveMaxPerUaClass);
	for (const [key] of removeTargets) {
		await os.api("i/registry/remove", {
			scope,
			key,
		});
	}
}

export async function autoSave(blockUpdate = false): Promise<void> {
	const profiles = (await os.api("i/registry/get-all", { scope })) || {};

	if (!profiles) return;

	const uaClass = getCurrentUaClass();
	const name: Profile["name"] = `AutoSave: ${uaClass}`;
	const clientId = getAutoSaveClientId();
	const now = new Date().toISOString();
	const existingSameClientEntry = Object.entries(profiles)
		.filter(([, value]) =>
			isAutoProfile(value) &&
			getProfileUaClass(value) === uaClass &&
			value.clientId === clientId,
		)
		.sort(sortByUpdatedAtDesc)[0];

	if (blockUpdate && !existingSameClientEntry) return;

	const id = existingSameClientEntry?.[0] ?? uuid();
	const createdAt: Profile["createdAt"] =
		existingSameClientEntry?.[1].createdAt ?? now;
	const updatedAt: Profile["updatedAt"] = existingSameClientEntry ? now : null;

	const profile: Profile = {
		name,
		createdAt,
		updatedAt,
		misskeyVersion: version,
		host,
		kind: "auto",
		uaClass,
		clientId,
		settings: getSettings(true),
	};
	await os.api("i/registry/set", {
		scope,
		key: id,
		value: profile,
	});

	await cleanupOldAutoSaves({ ...profiles, [id]: profile }, uaClass);
}

export function getSettings(deviceOnly): Profile["settings"] {
	const hot = {} as Record<keyof typeof defaultStore.def, unknown>;
	for (const key of Object.keys(defaultStore.def) as (keyof typeof defaultStore.def)[]) {
		if (deviceOnly && defaultStore.def?.[key]?.where !== "device" && defaultStore.def?.[key]?.where !== "deviceAccount") continue;
		hot[key] = defaultStore.state[key];
	}

	const cold = {} as Record<keyof typeof ColdDeviceStorage.default, unknown>;
	for (const key of Object.keys(ColdDeviceStorage.default) as (keyof typeof ColdDeviceStorage.default)[]) {
		cold[key] = ColdDeviceStorage.get(key);
	}

	return {
		hot,
		cold,
		fontSize: localStorage.getItem("fontSize"),
		avatarSize: localStorage.getItem("avatarSize"),
		useSystemFont: localStorage.getItem("useSystemFont") as "t" | null,
		wallpaper: localStorage.getItem("wallpaper"),
		wallpapers: localStorage.getItem("wallpapers"),
	};
}

export async function applyProfile(id: string): Promise<void> {
	const profiles = (await os.api("i/registry/get-all", { scope })) || {}

	if (!profiles) return;

	const profile = profiles[id];

	const { canceled: cancel1 } = await os.confirm({
		type: "warning",
		title: ts._preferencesBackups.apply,
		text: t("_preferencesBackups.applyConfirm", { name: profile.name }),
	});
	if (cancel1) return;

	// TODO: バージョン or ホストが違ったらさらに警告を表示

	const settings = profile.settings;

	let accountLoad = false
	let accountQuestion = false;

	// defaultStore
	for (const key of Object.keys(defaultStore.def) as (keyof typeof defaultStore.def)[]) {
		if (!accountQuestion && settings.hot[key] && defaultStore.def?.[key]?.where === "account") {
			const { canceled: cancel3 } = await os.yesno({
				type: "question",
				text: "アカウント依存設定を読み込みますか？",
			});
			accountLoad = !cancel3;
			accountQuestion = true;
		}
		if (
			settings.hot[key] !== undefined &&
			(!accountLoad || defaultStore.def?.[key]?.where === "device" || defaultStore.def?.[key]?.where === "deviceAccount")
		) {
			defaultStore.set(key, settings.hot[key]);
		}
	}

	// coldDeviceStorage
	for (const key of Object.keys(ColdDeviceStorage.default) as (keyof typeof ColdDeviceStorage.default)[]) {
		if (settings.cold[key] !== undefined) {
			ColdDeviceStorage.set(key, settings.cold[key]);
		}
	}

	// fontSize
	if (settings.fontSize) {
		localStorage.setItem("fontSize", settings.fontSize);
	} else {
		localStorage.removeItem("fontSize");
	}

	// avatarSize
	if (settings.avatarSize) {
		localStorage.setItem("avatarSize", settings.avatarSize);
	} else {
		localStorage.removeItem("avatarSize");
	}

	// useSystemFont
	if (settings.useSystemFont) {
		localStorage.setItem("useSystemFont", settings.useSystemFont);
	} else {
		localStorage.removeItem("useSystemFont");
	}

	// wallpaper
	if (settings.wallpaper != null) {
		localStorage.setItem("wallpaper", settings.wallpaper);
	} else {
		localStorage.removeItem("wallpaper");
	}

	// wallpaper
	if (settings.wallpapers != null) {
		localStorage.setItem("wallpapers", settings.wallpapers);
	} else {
		localStorage.removeItem("wallpapers");
	}

	const { canceled: cancel2 } = await os.confirm({
		type: "info",
		text: ts.reloadToApplySetting,
	});
	if (cancel2) return;

	unisonReload();
}
