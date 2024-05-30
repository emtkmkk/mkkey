import { api } from "@/os";
import { $i } from "@/account";
import { Theme, applyTheme } from "./scripts/theme";
import lightTheme from "@/themes/_light.json5";
import darkTheme from "@/themes/_dark.json5";
import { ColdDeviceStorage, defaultStore } from "@/store";

const lsCacheKey = $i ? `themes:${$i.id}` : "";

export function getThemes(): Theme[] {
	return JSON.parse(localStorage.getItem(lsCacheKey) || "[]");
}

export async function fetchThemes(): Promise<void> {
	if ($i == null) return;

	try {
		const themes = await api("i/registry/get", {
			scope: ["client"],
			key: "themes",
		});
		localStorage.setItem(lsCacheKey, JSON.stringify(themes));
	} catch (err) {
		if (err.code === "NO_SUCH_KEY") return;
		throw err;
	}
}

export async function addTheme(theme: Theme): Promise<void> {
	const base = [lightTheme, darkTheme].find((x) => x.id === theme.base);
	if (base) {
		for (const prop in theme.props) {
			if (theme.props[prop] === base.props[prop]) {
				delete theme.props[prop];
			}
		}
	}
	theme.name = theme.name.replace(/\\(v\\d+\\)$/, "");
	await fetchThemes();
	const sameName = getThemes().filter((x) =>
		x.id !== theme.id && new RegExp(`^${theme.name}(\\(v\\d+\\))?$`).test(x.name),
	);
	if (sameName.length) {
		theme.name = `${theme.name}(v${sameName.length + 1})`;
	}
	const themes = getThemes().filter((x) => x.id !== theme.id).concat(theme);
	await api("i/registry/set", {
		scope: ["client"],
		key: "themes",
		value: themes,
	});
	let nowThemeId
	if (defaultStore.state.darkMode) {
		nowThemeId = ColdDeviceStorage.ref("darkTheme")?.value.id;
	} else {
		nowThemeId = ColdDeviceStorage.ref("lightTheme")?.value.id;
	}
	if (nowThemeId === theme.id) {
		applyTheme(theme,true);
	}
	localStorage.setItem(lsCacheKey, JSON.stringify(themes));
}

export async function removeTheme(theme: Theme): Promise<void> {
	const themes = getThemes().filter((t) => t.id !== theme.id);
	await api("i/registry/set", {
		scope: ["client"],
		key: "themes",
		value: themes,
	});
	localStorage.setItem(lsCacheKey, JSON.stringify(themes));
}
