/**
 * Client entry point
 */

// https://vitejs.dev/config/build-options.html#build-modulepreload
import "vite/modulepreload-polyfill";

import "@/style.scss";
import "@phosphor-icons/web/bold";
import "@phosphor-icons/web/fill";

//#region account indexedDB migration
import { get, set, del } from "@/scripts/idb-proxy";

const accounts = localStorage.getItem("accounts");
if (accounts != null) {
	set("accounts", JSON.parse(accounts));
	localStorage.removeItem("accounts");
}
//#endregion

import {
	computed,
	createApp,
	watch,
	markRaw,
	version as vueVersion,
	defineAsyncComponent,
} from "vue";
import { compareVersions } from "compare-versions";
import JSON5 from "json5";

import widgets from "@/widgets";
import directives from "@/directives";
import components from "@/components";
import { version, ui, lang, host } from "@/config";
import { applyFont, fontList } from "@/scripts/font";
import { applyTheme, Theme } from "@/scripts/theme";
import { isDeviceDarkmode } from "@/scripts/is-device-darkmode";
import { i18n } from "@/i18n";
import { confirm, alert, post, popup, toast, yesno, api } from "@/os";
import { stream } from "@/stream";
import * as sound from "@/scripts/sound";
import { $i, refreshAccount, login, updateAccount, signout } from "@/account";
import { defaultStore, ColdDeviceStorage, userActions } from "@/store";
import {
	emojiLoad,
	fetchInstance,
	fetchEmoji,
	fetchEmojiStats,
	fetchPlusEmoji,
	fetchAllEmoji,
	fetchAllEmojiNoCache,
	instance,
} from "@/instance";
import { makeHotkey } from "@/scripts/hotkey";
import { search } from "@/scripts/search";
import { deviceKind } from "@/scripts/device-kind";
import { initializeSw } from "@/scripts/initialize-sw";
import { reloadChannel } from "@/scripts/unison-reload";
import { reactionPicker } from "@/scripts/reaction-picker";
import { getUrlWithoutLoginId } from "@/scripts/login-id";
import { getAccountFromId } from "@/scripts/get-account-from-id";
import getUserName from "@/scripts/get-user-name";
import {
	isMobileData,
	initializeDetectNetworkChange,
} from "@/scripts/datasaver";
import { acct } from "./filters/user";
import { applyProfile, autoSave } from "./scripts/backup";
import { v4 as uuid } from "uuid";

let waitMessages: string[] = [];

// 指定したミリ秒だけ待つ非同期関数
const wait = async (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

// ヘックスカラーコードをRGBAに変換する関数
const hexToRgb = (hex: string) => {
	if (/^#[0-9A-Fa-f]{6}$/i.test(hex) || /^#[0-9A-Fa-f]{8}$/i.test(hex)) {
		hex = hex.replace(/^#/, "");
		const r = Number.parseInt(hex.substring(0, 2), 16);
		const g = Number.parseInt(hex.substring(2, 4), 16);
		const b = Number.parseInt(hex.substring(4, 6), 16);
		let a = 32;
		if (hex.length >= 8) {
			a = Number.parseInt(hex.substring(6, 8), 16);
		}
		return `rgba(${r},${g},${b},${a / 255})`;
	}
	return hex;
};

// エラーログの初期化
const initializeErrorLogging = async () => {
	const waitMsg = "エラーログ出力機能を初期化中...";
	waitMessages.push(waitMsg);
	const currentDate = new Date();
	const formattedDate = `${currentDate.toLocaleDateString()} ${currentDate.toLocaleTimeString()}`;

	await set("errorLog", [`${formattedDate} - Calckey v${version}`]);

	const logError = async (message: string) => {
		const logtext = `${formattedDate} - ${message}`;
		let currentLogs = (await get("errorLog")) || [];
		currentLogs.push(logtext);
		if (currentLogs.length > 50) {
			currentLogs = currentLogs.slice(-50);
		}
		await set("errorLog", currentLogs);
	};

	window.addEventListener("error", async (event) => {
		await logError(
			`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
		);
	});

	window.addEventListener("unhandledrejection", async (event) => {
		const reason =
			typeof event.reason === "object"
				? JSON.stringify(event.reason)
				: event.reason;
		await logError(`Unhandled promise rejection: ${reason}`);
	});

	if (_DEV_) {
		console.warn("Development mode!!!");

		console.info(`vue ${vueVersion}`);

		(window as any).$i = $i;
		(window as any).$store = defaultStore;

		window.addEventListener("error", (event) => {
			console.error(event);
			/*
			alert({
				type: 'error',
				title: 'DEV: Unhandled error',
				text: event.message
			});
			*/
		});

		window.addEventListener("unhandledrejection", (event) => {
			console.error(event);
			/*
			alert({
				type: 'error',
				title: 'DEV: Unhandled promise rejection',
				text: event.reason
			});
			*/
		});
	}
	waitMessages = waitMessages.filter((x) => x !== waitMsg);
};

// ビューポートの初期化
const initializeViewport = () => {
	const waitMsg = "ビューポートの初期化中...";
	waitMessages.push(waitMsg);

	// タッチデバイスでCSSの:hoverを機能させる
	document.addEventListener("touchend", () => {}, { passive: true });

	// 一斉リロード
	reloadChannel.addEventListener("message", (path) => {
		if (path !== null) location.href = path;
		else location.reload();
	});

	//#region SEE: https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
	// TODO: いつの日にか消したい
	const vh = window.innerHeight * 0.01;
	if (CSS.supports("height", "100dvh")) {
		document.documentElement.style.setProperty("--vh", "1dvh");
		document.documentElement.style.setProperty("--wph", "100dvh");
	} else {
		document.documentElement.style.setProperty("--vh", `${vh}px`);
		document.documentElement.style.setProperty(
			"--wph",
			`${window.innerHeight}px`,
		);
	}

	window.addEventListener("resize", () => {
		if (!CSS.supports("height", "100dvh")) {
			const vh = window.innerHeight * 0.01;
			document.documentElement.style.setProperty("--vh", `${vh}px`);
		}
	});
	//#endregion

	// If mobile, insert the viewport meta tag
	if (["smartphone", "tablet"].includes(deviceKind)) {
		const viewport = document.getElementsByName("viewport").item(0);
		viewport.setAttribute(
			"content",
			`${viewport.getAttribute(
				"content",
			)}, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`,
		);
	}
	waitMessages = waitMessages.filter((x) => x !== waitMsg);
};

// ログインIDの初期化
const initializeLoginId = async () => {
	const params = new URLSearchParams(location.search);
	const loginId = params.get("loginId");

	if (loginId) {
		const waitMsg = "ログインIDを初期化中...";
		waitMessages.push(waitMsg);
		const target = getUrlWithoutLoginId(location.href);
		if (!$i || $i.id !== loginId) {
			const account = await getAccountFromId(loginId);
			if (account) {
				await login(account.token, target);
			}
		}
		history.replaceState({ misskey: "loginId" }, "", target);
		waitMessages = waitMessages.filter((x) => x !== waitMsg);
	}
};

// ユーザーアカウントの取得とリフレッシュ
const fetchUserAccount = async () => {
	await initializeLoginId();
	if ($i?.token) {
		const waitMsg = "アカウント情報を取得中...";
		waitMessages.push(waitMsg);
		if (_DEV_) console.log("account cache found. refreshing...");
		await refreshAccount();
		waitMessages = waitMessages.filter((x) => x !== waitMsg);
	} else {
		const waitMsg = "ログイン中...";
		waitMessages.push(waitMsg);
		if (_DEV_) console.log("no account cache found");
		const i = (document.cookie.match(/igi=(\w+)/) || [null, null])[1];
		if (i && i !== "null") {
			try {
				document.body.innerHTML = "<div>Please wait...</div>";
				await login(i);
			} catch (err) {
				document.body.innerHTML = '<div id="err">Oops!</div>';
			}
		} else {
			if (_DEV_) console.log("not signed in");
		}
		waitMessages = waitMessages.filter((x) => x !== waitMsg);
	}
};

// サービスワーカーとインスタンスメタ情報の取得の初期化
const initializeServiceWorkerAndFetchInstanceMeta = async () => {
	const waitInstanceMsg = "インスタンス情報の取得中...";
	waitMessages.push(waitInstanceMsg);
	const fetchInstanceMetaPromise = fetchInstance();
	fetchInstanceMetaPromise.then(() => {
		waitMessages = waitMessages.filter((x) => x !== waitInstanceMsg);
		const waitMsg = "サービスワーカーの初期化中...";
		waitMessages.push(waitMsg);
		localStorage.setItem("v", instance.version);
		initializeSw();
		waitMessages = waitMessages.filter((x) => x !== waitMsg);
	});
	return fetchInstanceMetaPromise;
};

// アプリの初期化
const initializeApp = async (minimumLoadPromise: Promise<unknown>) => {
	const waitMsg = "アプリの初期化中...";
	waitMessages.push(waitMsg);
	const app = createApp(
		window.location.search === "?zen"
			? defineAsyncComponent(() => import("@/ui/zen.vue"))
			: !$i
				? defineAsyncComponent(() => import("@/ui/visitor.vue"))
				: ui === "deck" && location.pathname === "/"
					? defineAsyncComponent(() => import("@/ui/deck.vue"))
					: ui === "classic"
						? defineAsyncComponent(() => import("@/ui/classic.vue"))
						: defineAsyncComponent(() => import("@/ui/universal.vue")),
	);

	app.config.errorHandler = async (err, vm, info) => {
		const waitMsg = "エラーログ出力機能を初期化中(2)...";
		waitMessages.push(waitMsg);
		const currentDate = new Date();
		const formattedDate = `${currentDate.toLocaleDateString()} ${currentDate.toLocaleTimeString()}`;

		// エラーログのテキストを生成
		const logtext = `${formattedDate} - VueError: ${[
			err?.toString(),
			info,
		].join(" - ")}`;

		let currentLogs = (await get("errorLog")) || [];
		currentLogs.push(logtext);

		if (currentLogs.length > 50) {
			currentLogs = currentLogs.slice(-50);
		}

		await set("errorLog", currentLogs);
		waitMessages = waitMessages.filter((x) => x !== waitMsg);
	};

	if (_DEV_) {
		app.config.performance = true;
	}

	app.config.globalProperties = {
		$i,
		$store: defaultStore,
		$instance: instance,
		$t: i18n.t,
		$ts: i18n.ts,
	};

	widgets(app);
	directives(app);
	components(app);

	waitMessages = waitMessages.filter((x) => x !== waitMsg);
	initializeSplashScreen(minimumLoadPromise);

	// https://github.com/misskey-dev/misskey/pull/8575#issuecomment-1114239210
	// なぜかinit.tsの内容が2回実行されることがあるため、mountするdivを1つに制限する
	const rootEl = (() => {
		const MISSKEY_MOUNT_DIV_ID = "calckey_app";

		const currentEl = document.getElementById(MISSKEY_MOUNT_DIV_ID);

		if (currentEl) {
			console.warn("multiple import detected");
			return currentEl;
		}

		const rootEl = document.createElement("div");
		rootEl.id = MISSKEY_MOUNT_DIV_ID;
		document.body.appendChild(rootEl);
		return rootEl;
	})();

	app.mount(rootEl);

	// boot.jsのやつを解除
	window.onerror = null;
	window.onunhandledrejection = null;
};

// スプラッシュスクリーンの初期化
const initializeSplashScreen = async (minimumLoadPromise: Promise<unknown>) => {
	const waitMsg = "スプラッシュスクリーンの解除中...";
	waitMessages.push(waitMsg);

	const splashText = document.getElementById("splashText");

	if (splashText) await minimumLoadPromise;

	const splash = document.getElementById("splash");
	if (splash) {
		splash.addEventListener("transitionend", () => {
			splash.remove();
		});
		splash.style.opacity = "0";
		splash.style.pointerEvents = "none";
		waitMessages = waitMessages.filter((x) => x !== waitMsg);
	}
};

const versionCheck = () => {
	// クライアントが更新されたか？
	const lastVersion = localStorage.getItem("lastVersion");

	if (lastVersion !== version) {
		localStorage.setItem("lastVersion", version);

		// テーマリビルドするため
		localStorage.removeItem("theme");

		// スキップするバージョン
		const skipVersion = ["14.0.0-dev10-mkk35."];

		try {
			// 変なバージョン文字列来るとcompareVersionsでエラーになるため
			if (
				lastVersion != null &&
				(defaultStore.state.showMiniUpdates ||
					compareVersions(version, lastVersion) === 1) &&
				defaultStore.state.showUpdates
			) {
				// ログインしてる場合だけ
				if ($i) {
					popup(
						defineAsyncComponent(() => import("@/components/MkUpdated.vue")),
						{},
						{},
						"closed",
					);
				}
			}
		} catch (err) {
			console.error(err);
		}
	}
};

// テーマの初期化
const initializeTheme = () => {
	watch(
		defaultStore.reactiveState.darkMode,
		(darkMode) => {
			applyTheme(
				darkMode
					? ColdDeviceStorage.get("darkTheme")
					: ColdDeviceStorage.get("lightTheme"),
			);
		},
		{ immediate: localStorage.theme == null },
	);

	const darkTheme = computed(ColdDeviceStorage.makeGetterSetter("darkTheme"));
	const lightTheme = computed(ColdDeviceStorage.makeGetterSetter("lightTheme"));

	watch(darkTheme, (theme) => {
		if (defaultStore.state.darkMode) {
			applyTheme(theme);
		}
	});

	watch(lightTheme, (theme) => {
		if (!defaultStore.state.darkMode) {
			applyTheme(theme);
		}
	});

	//#region Sync dark mode
	if (ColdDeviceStorage.get("syncDeviceDarkMode")) {
		defaultStore.set("darkMode", isDeviceDarkmode());
	}

	window.matchMedia("(prefers-color-scheme: dark)").addListener((mql) => {
		if (ColdDeviceStorage.get("syncDeviceDarkMode")) {
			defaultStore.set("darkMode", mql.matches);
		}
	});
	//#endregion

	//#region Auto switch data saver
	if (defaultStore.state.autoSwitchDataSaver) {
		defaultStore.set("enableDataSaverMode", isMobileData());
		initializeDetectNetworkChange();
	}
	//#endregion

	document.documentElement.style.setProperty(
		"--publicColor",
		hexToRgb(defaultStore.state.publicColor),
	);
	document.documentElement.style.setProperty(
		"--homeColor",
		hexToRgb(defaultStore.state.homeColor),
	);
	document.documentElement.style.setProperty(
		"--followerColor",
		hexToRgb(defaultStore.state.followerColor),
	);
	document.documentElement.style.setProperty(
		"--specifiedColor",
		hexToRgb(defaultStore.state.specifiedColor),
	);
	document.documentElement.style.setProperty(
		"--circleColor",
		hexToRgb(defaultStore.state.circleColor),
	);
	document.documentElement.style.setProperty(
		"--localOnlyColor",
		hexToRgb(defaultStore.state.localOnlyColor),
	);

	try {
		const reInit =
			darkTheme?.name === "Rosé Pine" && lightTheme?.name === "l-rosepinedawn";
		if (
			defaultStore.state.themeInitial ||
			(reInit && !defaultStore.state.completedReInit)
		) {
			if (instance.defaultLightTheme != null)
				ColdDeviceStorage.set(
					"lightTheme",
					JSON5.parse(instance.defaultLightTheme),
				);
			if (instance.defaultDarkTheme != null)
				ColdDeviceStorage.set(
					"darkTheme",
					JSON5.parse(instance.defaultDarkTheme),
				);
			defaultStore.set("themeInitial", false);
			defaultStore.set("completedReInit", true);
		}
	} catch (e) {
		console.log(e);
	}
};

// カスタムフォントの初期化
const initializeCustomFont = () => {
	if (defaultStore.state.randomCustomFont) {
		if (defaultStore.state.includesRandomEsenapaj) {
			const _fontList = Object.keys(fontList);
			defaultStore.set(
				"customFont",
				_fontList[Math.floor(Math.random() * _fontList.length)],
			);
		} else {
			if (defaultStore.state.customFont !== "esenapaj") {
				const _fontList = Object.keys(fontList).filter((x) => x !== "esenapaj");
				defaultStore.set(
					"customFont",
					_fontList[Math.floor(Math.random() * _fontList.length)],
				);
			}
		}
	}

	if (defaultStore.state.customFont) {
		applyFont(defaultStore.state.customFont);
	}

	watch(defaultStore.reactiveState.customFont, (font) => {
		applyFont(font);
	});
};

const initializeBlurEffect = () => {
	watch(
		defaultStore.reactiveState.useBlurEffectForModal,
		(v) => {
			document.documentElement.style.setProperty(
				"--modalBgFilter",
				v ? "blur(4px)" : "none",
			);
		},
		{ immediate: true },
	);

	watch(
		defaultStore.reactiveState.useBlurEffect,
		(v) => {
			if (v && deviceKind !== "smartphone") {
				document.documentElement.style.removeProperty("--blur");
			} else {
				document.documentElement.style.setProperty("--blur", "none");
			}
		},
		{ immediate: true },
	);
};

const initializeReloadDialog = () => {
	let reloadDialogShowing = false;
	stream.on("_disconnected_", async () => {
		if (defaultStore.state.serverDisconnectedBehavior === "reload") {
			location.reload();
		} else if (defaultStore.state.serverDisconnectedBehavior === "dialog") {
			if (reloadDialogShowing) return;
			reloadDialogShowing = true;
			const { canceled } = await confirm({
				type: "warning",
				title: i18n.ts.disconnectedFromServer,
				text: i18n.ts.reloadConfirm,
			});
			reloadDialogShowing = false;
			if (!canceled) {
				location.reload();
			}
		}
	});
};

const initializePlugins = () => {
	for (const plugin of ColdDeviceStorage.get("plugins").filter(
		(p) => p.active,
	)) {
		import("./plugin").then(({ install }) => {
			install(plugin);
		});
	}
};

const initializeEmoji = async () => {
	fetchEmoji();
	fetchEmojiStats(defaultStore.state.enableDataSaverMode ? 31 : 120);
	const lastEmojiFetchDate = (await get("remoteEmojiData"))
		? (await get("remoteEmojiData"))?.emojiFetchDate
		: undefined;
	const emojiFetchDateInt = Math.max(
		lastEmojiFetchDate ? new Date(lastEmojiFetchDate).valueOf() : 0,
		(await get("emojiFetchAttemptDate"))
			? Number.parseInt(await get("emojiFetchAttemptDate"), 10)
			: 0,
	);
	let fetchModeMax = defaultStore.state.remoteEmojisFetch ?? "all";
	// 更新間隔 : データセーバーなら、24時間 そうでないなら、6時間
	const fetchTimeBorder = defaultStore.state.enableDataSaverMode
		? 1000 * 60 * 60 * 24
		: 1000 * 60 * 60 * 6;

	if (
		fetchModeMax === "always" ||
		Date.now() - emojiFetchDateInt > fetchTimeBorder ||
		fetchModeMax !== ((await get("lastFetchModeMax")) ?? fetchModeMax)
	) {
		// 常に取得がon or 最終取得日が無い or 前回取得から更新間隔以上 or 取得設定が前回と異なる場合絵文字を取得
		//一度キャッシュを破棄
		if (fetchModeMax !== "keep") {
			localStorage.removeItem("emojiData");
			localStorage.removeItem("remoteEmojiData");
			localStorage.removeItem("lastFetchModeMax");
			localStorage.removeItem("emojiFetchAttemptDate");
			await del("remoteEmojiData");
		}
		// 一度だけ更新の場合、データモードを前回と同じにしておく
		if (fetchModeMax === "once") {
			const lastFetchModeMax = (await get("lastFetchModeMax")) ?? fetchModeMax;
			fetchModeMax = lastFetchModeMax;
			defaultStore.set("remoteEmojisFetch", lastFetchModeMax);
		}
		// 取得設定を保存
		await set("lastFetchModeMax", fetchModeMax);
		// 最終試行日を更新する
		await set("emojiFetchAttemptDate", Date.now());
		if (fetchModeMax === "always") {
			fetchAllEmojiNoCache();
		} else if (fetchModeMax === "all") {
			fetchAllEmoji().catch(() => {
				// 保存に失敗した場合は軽量版リモート絵文字の取得を試行
				fetchPlusEmoji();
			});
		} else if (fetchModeMax === "plus") {
			fetchPlusEmoji();
		}
	}
	// 取得設定を保存
	await set("lastFetchModeMax", fetchModeMax);
	// 絵文字を読み込み直す
	emojiLoad();
};

const saveFailedQueueDatas = () => {
	if (defaultStore.state.queueDatas?.length) {
		for (let i = defaultStore.state.queueDatas?.length - 1; i >= 0; i--) {
			try {
				const draftData = JSON.parse(localStorage.getItem("drafts") || "{}");

				if (
					!defaultStore.state.queueDatas[i].draftData?.key ||
					!defaultStore.state.queueDatas[i].draftData?.data
				)
					continue;

				const key =
					defaultStore.state.queueDatas[i].draftData.key ??
					`auto:${uuid()?.slice(0, 8)}`;

				const data = draftData[key];
				if (data?.data) {
					if (
						data.data.text ||
						(data.data.useCw && data.data.cw) ||
						data.data.files?.length ||
						data.data.poll ||
						data.data.referencesFlg !== true
					) {
						draftData[`auto:${uuid()?.slice(0, 8)}`] =
							defaultStore.state.queueDatas[i].draftData;
						localStorage.setItem("drafts", JSON.stringify(draftData));
						return;
					}
				}
				draftData[key] = defaultStore.state.queueDatas[i].draftData;
				localStorage.setItem("drafts", JSON.stringify(draftData));
			} catch (e) {
				console.log(e);
			}
		}
		defaultStore.set("queueDatas", []);
		toast("前回未送信の投稿を下書きに保存しました。");
	}
};

const showLocalPostsTutorial = async () => {
	if (
		$i &&
		defaultStore.state.tutorial === -1 &&
		defaultStore.isDefault("showLocalPostsInfoPopup") &&
		$i.followingCount >= 10 &&
		!instance.disableLocalTimeline
	) {
		if (defaultStore.isDefault("showLocalPostsInTimeline")) {
			const { canceled } = await yesno({
				type: "question",
				text: "ホームTLの内容を自身がフォローしている人の投稿のみに変更する事が可能です。\n※ここで変更しない場合でも設定ページ>色々にて後から変更する事が可能です。\n今すぐホームTLをフォロー者の投稿のみの表示に変更しますか？",
			});
			if (!canceled) {
				defaultStore.set("showLocalPostsInTimeline", "social");
				defaultStore.set("showLocalPostsInfoPopup", true);
				location.reload();
			} else {
				defaultStore.set("showLocalPostsInTimeline", "home");
				defaultStore.set("showLocalPostsInfoPopup", true);
			}
		} else {
			defaultStore.set("showLocalPostsInfoPopup", true);
		}
	}
};

const showInviteTutorial = async () => {
	if (
		$i &&
		!defaultStore.state.showInviteInfoPopupAccount &&
		!defaultStore.state.showInviteInfoPopupDevice
	) {
		// 招待可能条件
		// 登録から(7日-((投稿数-20)*1.5時間))経過
		// ただし1日未満にはならない
		// 投稿数が20以上
		const eTime = $i
			? Date.now() - new Date($i.createdAt).valueOf()
			: undefined;
		const inviteBorder = eTime
			? eTime > 7 * 24 * 60 * 60 * 1000
				? 7 * 24 * 60 * 60 * 1000
				: Math.max(
						7 * 24 * 60 * 60 * 1000 - $i.notesCount * 90 * 60 * 1000,
						24 * 60 * 60 * 1000,
					)
			: undefined;
		const canInvite = $i
			? (eTime ?? 0) > (inviteBorder ?? 0) &&
				$i.notesCount >= 20 &&
				!$i.isSilenced &&
				$i.canInvite
			: false;
		if (defaultStore.state.tutorial === -1 && canInvite) {
			await alert({
				type: "info",
				text: "もこきーの招待コードを発行する事が出来るようになりました！\n\n左メニューのℹ️ボタンから招待コードを発行することが出来ます。",
			});
			defaultStore.set("showInviteInfoPopupAccount", true);
			defaultStore.set("showInviteInfoPopupDevice", true);
		}
	} else {
		if (
			!(
				defaultStore.state.showInviteInfoPopupAccount &&
				defaultStore.state.showInviteInfoPopupDevice
			)
		) {
			defaultStore.set("showInviteInfoPopupDevice", true);
			defaultStore.set("showInviteInfoPopupAccount", true);
		}
	}
};

const showMultiReactionTutorial = async () => {
	if (!defaultStore.state.showMultiReactionInfoPopup) {
		const canMultiReaction = $i && $i.patron;
		if (defaultStore.state.tutorial === -1 && canMultiReaction) {
			await alert({
				type: "info",
				text: "支援または自作絵の絵文字登録、ありがとうございます！\n複数リアクション機能が解禁されました！\n\nもこきーや他の対応サーバのユーザには、1つの投稿に対して基本3種類までのリアクションを付ける事が出来ます！\n（未対応のサーバのユーザに対しては、通常と同じで1つまでしか付けられません。複数リアクション可能な投稿かどうかはリアクションボタンがウインクしているかどうかで判別可能です。）",
			});
			defaultStore.set("showMultiReactionInfoPopup", true);
		}
	}
};

const initializePowerMode = () => {
	if (defaultStore.state.powerMode) {
		import("activate-power-mode").then((module) => {
			const powerMode = module.default;
			powerMode.shake = !defaultStore.state.powerModeNoShake;
			powerMode.colorful = !!defaultStore.state.powerModeColorful;
			if (powerMode.setSettings) {
				powerMode.setSettings({
					particleMinCount: defaultStore.state.powerModeParticleCount, // パーティクルの最低数
					particleMaxCount: Math.round(
						defaultStore.state.powerModeParticleCount * 2.5,
					), // パーティクルの最大数
					shakeMinIntensity: Math.ceil(
						defaultStore.state.powerModeShakePower / 5,
					), // 画面の揺れの最低強度
					shakeMaxIntensity: defaultStore.state.powerModeShakePower, // 画面の揺れの最高強度
					particleSize: defaultStore.state.powerModeParticleSize, // パーティクルのサイズ
					gravity: defaultStore.state.powerModeParticleGravity / 400, // 重力
					xOffset: defaultStore.state.powerModeParticleX, // 出現位置の横のずれ
					yOffset: defaultStore.state.powerModeParticleY, // 出現位置の縦のずれ
					spreadX: defaultStore.state.powerModeParticleSpreadX, // パーティクルの飛び散る広さ X
					spreadY: defaultStore.state.powerModeParticleSpreadY, // パーティクルの飛び散る広さ Y
					alphaDecay: 0.96, // パーティクルの透明度減衰度
					colorfulParticles: defaultStore.state.powerModeSuperColorful, // パーティクルの色を個別にするかどうか
				});
			}
			window.addEventListener("input", powerMode);
			watch(
				[
					defaultStore.reactiveState.powerModeNoShake,
					defaultStore.reactiveState.powerModeColorful,
					defaultStore.reactiveState.powerModeParticleCount,
					defaultStore.reactiveState.powerModeShakePower,
					defaultStore.reactiveState.powerModeParticleSize,
					defaultStore.reactiveState.powerModeParticleGravity,
					defaultStore.reactiveState.powerModeParticleX,
					defaultStore.reactiveState.powerModeParticleY,
					defaultStore.reactiveState.powerModeParticleSpreadX,
					defaultStore.reactiveState.powerModeParticleSpreadY,
					defaultStore.reactiveState.powerModeSuperColorful,
				],
				() => {
					powerMode.shake = !defaultStore.state.powerModeNoShake;
					powerMode.colorful = !!defaultStore.state.powerModeColorful;
					if (powerMode.setSettings) {
						powerMode.setSettings({
							particleMinCount: defaultStore.state.powerModeParticleCount, // パーティクルの最低数
							particleMaxCount: Math.round(
								defaultStore.state.powerModeParticleCount * 2.5,
							), // パーティクルの最大数
							shakeMinIntensity: Math.ceil(
								defaultStore.state.powerModeShakePower / 5,
							), // 画面の揺れの最低強度
							shakeMaxIntensity: defaultStore.state.powerModeShakePower, // 画面の揺れの最高強度
							particleSize: defaultStore.state.powerModeParticleSize, // パーティクルのサイズ
							gravity: defaultStore.state.powerModeParticleGravity / 400, // 重力
							xOffset: defaultStore.state.powerModeParticleX, // 出現位置の横のずれ
							yOffset: defaultStore.state.powerModeParticleY, // 出現位置の縦のずれ
							spreadX: defaultStore.state.powerModeParticleSpreadX, // パーティクルの飛び散る広さ X
							spreadY: defaultStore.state.powerModeParticleSpreadY, // パーティクルの飛び散る広さ Y
							alphaDecay: 0.96, // パーティクルの透明度減衰度
							colorfulParticles: defaultStore.state.powerModeSuperColorful, // パーティクルの色を個別にするかどうか
						});
					}
				},
			);
		});
	}
};

const initializeHiddenIconUsers = () => {
	if (
		defaultStore.state.hiddenIconUserIds?.length &&
		defaultStore.state.hiddenIconUserIds?.length !==
			defaultStore.state.hiddenIconUserAccts?.filter((x) => x.includes("@"))
				.length
	) {
		api("users/show", {
			userIds: defaultStore.state.hiddenIconUserIds,
		}).then((_users) => {
			const userIds = _users.map((x) => x.id);
			const userAccts = _users.map(
				(x) => acct(x) + (x.host == null ? `@${host}` : ""),
			);
			defaultStore.set("hiddenIconUserIds", userIds);
			defaultStore.set("hiddenIconUserAccts", userAccts);
		});
	}
};

const checkUnlockDeveloperMode = () => {
	if (
		!defaultStore.state.unlockDeveloperSettings &&
		defaultStore.state.developer
	) {
		defaultStore.set("unlockDeveloperSettings", true);
	}
};

const processMiniSilenced = () => {
	if ($i?.isMiniSilenced) {
		if (defaultStore.state.rememberNoteVisibility) {
			if (defaultStore.state.visibility === "public")
				defaultStore.set("visibility", "home");
		} else {
			if (defaultStore.state.defaultNoteVisibility === "public")
				defaultStore.set("defaultNoteVisibility", "home");
		}
	}
};

const postSleepModeCancel = () => {
	if (
		defaultStore.state.postStartSleep &&
		localStorage.getItem("sleepCancel") === "y"
	) {
		api("notes/create", {
			text: "#睡眠モード を解除しました",
			visibility: defaultStore.state.rememberNoteVisibility
				? defaultStore.state.visibility
				: defaultStore.state.defaultNoteVisibility,
			localOnly: defaultStore.state.rememberNoteVisibility
				? defaultStore.state.localAndFollower
				: defaultStore.state.defaultNoteLocalAndFollower,
		});
		localStorage.removeItem("sleepCancel");
	}
};

const storeConfigMigration = () => {
	if (!defaultStore.state.pickerConfigMigration) {
		if (defaultStore.state.reactionPickerSize < 0)
			defaultStore.set("reactionPickerVAlign", 0);
		if (!defaultStore.isDefault("reactionPickerWidth"))
			defaultStore.set(
				"reactionPickerWidth",
				defaultStore.state.reactionPickerWidth + 4,
			);
		defaultStore.set("pickerConfigMigration", true);
	}
	if (defaultStore.state.reactionPickerHeight < 11)
		defaultStore.set("reactionPickerHeight", 65);
};

const loadIosPwaSplash = async () => {
  // PWA判定
  const isPwa = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // PWAとして起動している場合、実行せずreturn
  if (isPwa) {
    return;
  }

	const themeColor = "#31748f"
  let splashColor = themeColor || '#31748f';
  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      const parsedTheme = JSON.parse(storedTheme);
      if (parsedTheme && parsedTheme.bg) {
        const bgVal = parsedTheme.bg;
        if (bgVal.includes('linear-gradient')) {
          // グラデーションがある場合、HEXカラーを抽出
          const match = bgVal.match(/#([0-9a-fA-F]{3,8})/);
          if (match && match[0]) {
            splashColor = match[0];
          } else {
            splashColor = themeColor || '#31748f';
          }
        } else {
          splashColor = bgVal;
        }
      } else {
        // bgが無い場合
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          splashColor = '#000000';
        } else {
          splashColor = '#ffffff';
        }
      }
    } else {
      // themeが無い場合
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        splashColor = '#000000';
      } else {
        splashColor = '#ffffff';
      }
    }
  } catch (e) {
    splashColor = themeColor || '#31748f';
  }

  const iosPWASplashScript = document.createElement('script');
  iosPWASplashScript.src = "https://cdn.jsdelivr.net/npm/ios-pwa-splash@1.0.0/cdn.min.js";
  iosPWASplashScript.onload = () => {
    try {
      iosPWASplash(icon || '/apple-touch-icon.png', splashColor);
    } catch (err) {
      console.warn("iosPWASplash failed to load or execute:", err);
    }
  };
  iosPWASplashScript.onerror = (err) => {
    console.warn("Failed to load iosPWASplash script:", err);
  };
  document.head.appendChild(iosPWASplashScript);
};


const autoSaveConfig = async () => {
	const lastBackupData = await get("lastBackup");
	if (!lastBackupData) await set("lastBackup", {});
	if (typeof lastBackupData === "number")
		await set("lastBackup", { [$i.id]: lastBackupData });
	const lastBackup = lastBackupData?.[$i.id]
		? Number.parseInt(lastBackupData?.[$i.id])
		: 0;
	if (
		defaultStore.state.autoSaveBackup &&
		Date.now() - lastBackup > 66 * 60 * 60 * 1000
	) {
		if (lastBackup === 0) {
			try {
				const profiles =
					(await api("i/registry/get-all", {
						scope: ["clientPreferencesProfiles"],
					})) || {};
				if (
					Object.values(profiles).some(
						(x) =>
							x.name ===
							`AutoSave: ${/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()) ? "mobile" : "desktop"}`,
					)
				) {
					const entry = Object.entries(profiles).find(
						([key, value]) =>
							value.name ===
							`AutoSave: ${/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()) ? "mobile" : "desktop"}`,
					);
					if (entry) {
						const [key, value] = entry;
						const { canceled } = await yesno({
							type: "question",
							text: "サーバ上に設定の自動保存が存在する様です。\n設定を復元しますか？",
						});
						if (!canceled) {
							applyProfile(key);
							await set("lastBackup", {
								...lastBackupData,
								[$i.id]: Date.now(),
							});
						} else {
							defaultStore.set("autoSaveBackup", false);
						}
					}
				} else {
					if (
						$i?.createdAt &&
						Date.now() - Date.parse($i?.createdAt) > 66 * 60 * 60 * 1000
					) {
						try {
							await autoSave(true);
							await set("lastBackup", {
								...lastBackupData,
								[$i.id]: Date.now(),
							});
						} catch (e) {
							console.log(e);
						}
						toast("端末設定を自動保存しました！");
					}
				}
			} catch (e) {
				console.log(e);
			}
		} else {
			try {
				await autoSave(lastBackup <= 1);
				await set("lastBackup", { ...lastBackupData, [$i.id]: Date.now() });
			} catch (e) {
				console.log(e);
			}
			toast("端末設定を自動保存しました！");
		}
	}
};

const showLastUsedToast = (ms: number) => {
	if (!$i) return;
	// 三日前以上前なら
	if (ms > 1000 * 60 * 60 * 72) {
		toast(
			i18n.t("welcomeBackWithNameLong", {
				days: Math.floor(ms / (1000 * 60 * 60 * 24)),
				name: getUserName($i, true),
			}),
		);
	}
	// 二日前以上前なら
	else if (ms > 1000 * 60 * 60 * 48) {
		toast(
			i18n.t("welcomeBackWithNameSleep", {
				name: getUserName($i, true),
			}),
		);
	}
	// 一日前以上前なら
	else if (ms > 1000 * 60 * 60 * 24) {
		toast(
			i18n.t("welcomeBackWithName", {
				name: getUserName($i, true),
			}),
		);
	}
	// 一時間半以上前なら
	else if (ms > 1000 * 60 * 90) {
		// 時間に合わせて挨拶
		const now = new Date();
		if (now.getHours() >= 5 && now.getHours() <= 10) {
			toast(
				i18n.t("welcomeBackWithNameMorning", {
					name: getUserName($i, true),
				}),
			);
		} else if (now.getHours() >= 11 && now.getHours() <= 15) {
			toast(
				i18n.t("welcomeBackWithNameNoon", {
					name: getUserName($i, true),
				}),
			);
		} else if (now.getHours() >= 16 && now.getHours() <= 18) {
			if (now.getDay() >= 1 && now.getDay() <= 5) {
				toast(
					i18n.t("welcomeBackWithNameEvening", {
						name: getUserName($i, true),
					}),
				);
			} else {
				toast(
					i18n.t("welcomeBackWithNameNoon", {
						name: getUserName($i, true),
					}),
				);
			}
		} else {
			toast(
				i18n.t("welcomeBackWithNameNight", {
					name: getUserName($i, true),
				}),
			);
		}
	}
};

const initializeStream = () => {
	const main = markRaw(stream.useChannel("main", null, "System"));

	// 自分の情報が更新されたとき
	main.on("meUpdated", (i) => {
		updateAccount(i);
	});

	main.on("readAllNotifications", () => {
		updateAccount({ hasUnreadNotification: false });
	});

	main.on("unreadNotification", () => {
		updateAccount({ hasUnreadNotification: true });
	});

	main.on("unreadMention", () => {
		updateAccount({ hasUnreadMentions: true });
	});

	main.on("readAllUnreadMentions", () => {
		updateAccount({ hasUnreadMentions: false });
	});

	main.on("unreadSpecifiedNote", () => {
		updateAccount({ hasUnreadSpecifiedNotes: true });
	});

	main.on("readAllUnreadSpecifiedNotes", () => {
		updateAccount({ hasUnreadSpecifiedNotes: false });
	});

	main.on("readAllMessagingMessages", () => {
		updateAccount({ hasUnreadMessagingMessage: false });
	});

	main.on("unreadMessagingMessage", () => {
		updateAccount({ hasUnreadMessagingMessage: true });
		sound.play("chatBg");
	});

	main.on("readAllAntennas", () => {
		updateAccount({ hasUnreadAntenna: false });
	});

	main.on("unreadAntenna", () => {
		updateAccount({ hasUnreadAntenna: true });
		sound.play("antenna");
	});

	main.on("readAllAnnouncements", () => {
		updateAccount({ hasUnreadAnnouncement: false });
	});

	main.on("readAllChannels", () => {
		updateAccount({ hasUnreadChannel: false });
	});

	main.on("unreadChannel", () => {
		updateAccount({ hasUnreadChannel: true });
		sound.play("channel");
	});

	// トークンが再生成されたとき
	// このままではMisskeyが利用できないので強制的にサインアウトさせる
	main.on("myTokenRegenerated", () => {
		signout();
	});
};

// ＊＊＊ ここからメイン処理 ＊＊＊
(async () => {
	console.info(`Calckey v${version}`);

	// 最低ロード時間の開始
	const minimumLoadPromise = wait(2200);

	// タイムアウト用のタイマーをセット
	let intervalId: string | number | NodeJS.Timeout | undefined;
	let splashTextContent: string | null;
	const splashText = document.getElementById("splashText");

	const splashTimeout = setTimeout(() => {
		if (splashText) {
			splashTextContent = splashText.textContent;
		}
		intervalId = setInterval(() => {
			if (splashText) {
				if (!waitMessages.length && splashTextContent) {
					splashText.textContent = splashTextContent;
				} else {
					splashText.textContent = waitMessages.join("\n");
				}
			}
		}, 200);
	}, 7000);

	initializeViewport();

	//#region Set lang attr
	const html = document.documentElement;
	html.setAttribute("lang", lang || "ja-JP");
	//#endregion

	// 設定の取得が完了するまでストップ
	await Promise.all([
		initializeErrorLogging(),
		fetchUserAccount(),
		initializeServiceWorkerAndFetchInstanceMeta(),
		defaultStore.loaded,
	]);

	await initializeApp(minimumLoadPromise);

	if (splashTimeout) clearTimeout(splashTimeout);
	if (intervalId) clearInterval(intervalId);

	reactionPicker.init();

	versionCheck();

	// NOTE: この処理は必ず↑のクライアント更新時処理より後に来ること(テーマ再構築のため)
	initializeTheme();

	initializeCustomFont();

	initializeBlurEffect();

	initializeReloadDialog();

	initializePlugins();

	const hotkeys = {
		d: (): void => {
			if (defaultStore.state.enableHotkeyDarkMode) {
				defaultStore.set("darkMode", !defaultStore.state.darkMode);
			}
		},
		s: search,
	};

	if ($i) {
		// only add post shortcuts if logged in
		hotkeys["p|n"] = post;

		if ($i.isDeleted) {
			alert({
				type: "warning",
				text: i18n.ts.accountDeletionInProgress,
			});
		}

		await initializeEmoji();

		saveFailedQueueDatas();

		await showLocalPostsTutorial();

		await showInviteTutorial();

		await showMultiReactionTutorial();

		initializePowerMode();

		initializeHiddenIconUsers();

		checkUnlockDeveloperMode();

		processMiniSilenced();

		postSleepModeCancel();

		storeConfigMigration();

		loadIosPwaSplash();

		let lastUsed = localStorage.getItem("lastUsed");
		if (!lastUsed && $i.lastActiveDate)
			lastUsed = new Date($i.lastActiveDate).valueOf().toString();
		if (lastUsed) {
			let lastUsedDate = Number.parseInt(lastUsed, 10);
			if (
				$i.lastActiveDate &&
				new Date($i.lastActiveDate).valueOf() > lastUsedDate
			) {
				lastUsedDate = new Date($i.lastActiveDate).valueOf();
			}
			if (Date.now() - lastUsedDate < 1000 * 60 * 60 * 66) {
				autoSaveConfig();
			}
			showLastUsedToast(Date.now() - lastUsedDate);
		}
		localStorage.setItem("lastUsed", Date.now().toString());

		if ("Notification" in window) {
			// 許可を得ていなかったらリクエスト
			if (Notification.permission === "default") {
				Notification.requestPermission();
			}
		}

		initializeStream();
	}

	// shortcut
	document.addEventListener("keydown", makeHotkey(hotkeys));
})();
