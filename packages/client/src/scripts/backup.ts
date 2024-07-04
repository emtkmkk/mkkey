
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

const scope = ["clientPreferencesProfiles"]

export async function autoSave(blockUpdate = false): Promise<void> {
	const profiles = (await os.api("i/registry/get-all", { scope })) || {}

	if (!profiles) return;

	let id = uuid();
	let name: Profile["name"] = `AutoSave: ${/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()) ? "mobile" : "desktop"}`
	let createdAt: Profile["createdAt"] = new Date().toISOString();
	let updatedAt: Profile["updatedAt"] = null;

	if (Object.values(profiles).some((x) => x.name === name)) {
		if (blockUpdate) return;
		const entry = Object.entries(profiles).find(([key, value]) => value.name === name);
		if (entry) {
			const [key, value] = entry;
			id = key;
			name = value.name;
			createdAt = value.createdAt;
			updatedAt = new Date().toISOString()
		}
	}
	const profile: Profile = {
		name,
		createdAt,
		updatedAt,
		misskeyVersion: version,
		host,
		settings: getSettings(true),
	};
	await os.api("i/registry/set", {
		scope,
		key: id,
		value: profile,
	});
}


export function getSettings(deviceOnly): Profile["settings"] {
	const hot = {} as Record<keyof typeof defaultStore.def, unknown>;
	for (const key of Object.keys(defaultStore.def) as (keyof typeof defaultStore.def)[]) {
		if (deviceOnly && defaultStore.def?.[key]?.where !== "device") continue;
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

	const { canceled: cancel3 } = await os.yesno({
		type: "question",
		text: "アカウント依存設定を読み込みますか？",
	});

	// TODO: バージョン or ホストが違ったらさらに警告を表示

	const settings = profile.settings;

	// defaultStore
	for (const key of Object.keys(defaultStore.def) as (keyof typeof defaultStore.def)[]) {
		if (
			settings.hot[key] !== undefined &&
			(!cancel3 || defaultStore.def?.[key]?.where === "device")
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
