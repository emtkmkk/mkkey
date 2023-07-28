/**
 * Client entry point
 */

// https://vitejs.dev/config/build-options.html#build-modulepreload
import "vite/modulepreload-polyfill";

import "@/style.scss";
import "@phosphor-icons/web/bold";
import "@phosphor-icons/web/fill";

//#region account indexedDB migration
import { set } from "@/scripts/idb-proxy";

if (localStorage.getItem("accounts") != null) {
	set("accounts", JSON.parse(localStorage.getItem("accounts")));
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
import { applyTheme } from "@/scripts/theme";
import { isDeviceDarkmode } from "@/scripts/is-device-darkmode";
import { i18n } from "@/i18n";
import { confirm, alert, post, popup, toast, yesno } from "@/os";
import { stream } from "@/stream";
import * as sound from "@/scripts/sound";
import { $i, refreshAccount, login, updateAccount, signout } from "@/account";
import { defaultStore, ColdDeviceStorage } from "@/store";
import { fetchInstance, fetchPlusEmoji, fetchAllEmoji, fetchAllEmojiNoCache, instance } from "@/instance";
import { makeHotkey } from "@/scripts/hotkey";
import { search } from "@/scripts/search";
import { deviceKind } from "@/scripts/device-kind";
import { initializeSw } from "@/scripts/initialize-sw";
import { reloadChannel } from "@/scripts/unison-reload";
import { reactionPicker } from "@/scripts/reaction-picker";
import { getUrlWithoutLoginId } from "@/scripts/login-id";
import { getAccountFromId } from "@/scripts/get-account-from-id";

(async () => {
	console.info(`Calckey v${version}`);

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

	// タッチデバイスでCSSの:hoverを機能させる
	document.addEventListener("touchend", () => { }, { passive: true });

	// 一斉リロード
	reloadChannel.addEventListener("message", (path) => {
		if (path !== null) location.href = path;
		else location.reload();
	});

	//#region SEE: https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
	// TODO: いつの日にか消したい
	const vh = window.innerHeight * 0.01;
	document.documentElement.style.setProperty("--vh", `${vh}px`);
	window.addEventListener("resize", () => {
		const vh = window.innerHeight * 0.01;
		document.documentElement.style.setProperty("--vh", `${vh}px`);
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

	//#region Set lang attr
	const html = document.documentElement;
	html.setAttribute("lang", lang);
	//#endregion

	//#region loginId
	const params = new URLSearchParams(location.search);
	const loginId = params.get("loginId");

	if (loginId) {
		const target = getUrlWithoutLoginId(location.href);

		if (!$i || $i.id !== loginId) {
			const account = await getAccountFromId(loginId);
			if (account) {
				await login(account.token, target);
			}
		}

		history.replaceState({ misskey: "loginId" }, "", target);
	}

	//#endregion

	//#region Fetch user
	if ($i?.token) {
		if (_DEV_) {
			console.log("account cache found. refreshing...");
		}

		refreshAccount();
	} else {
		if (_DEV_) {
			console.log("no account cache found.");
		}

		// 連携ログインの場合用にCookieを参照する
		const i = (document.cookie.match(/igi=(\w+)/) || [null, null])[1];

		if (i != null && i !== "null") {
			if (_DEV_) {
				console.log("signing...");
			}

			try {
				document.body.innerHTML = "<div>Please wait...</div>";
				await login(i);
			} catch (err) {
				// Render the error screen
				// TODO: ちゃんとしたコンポーネントをレンダリングする(v10とかのトラブルシューティングゲーム付きのやつみたいな)
				document.body.innerHTML = '<div id="err">Oops!</div>';
			}
		} else {
			if (_DEV_) {
				console.log("not signed in");
			}
		}
	}
	//#endregion

	let fetchInstanceMetaPromise = fetchInstance();

	fetchInstanceMetaPromise.then(() => {

		localStorage.setItem("v", instance.version);

		// Init service worker
		initializeSw();
	});


	const app = createApp(
		window.location.search === "?zen"
			? defineAsyncComponent(() => import("@/ui/zen.vue"))
			: !$i
				? defineAsyncComponent(() => import("@/ui/visitor.vue"))
				: (ui === "deck" && location.pathname === '/')
					? defineAsyncComponent(() => import("@/ui/deck.vue"))
					: ui === "classic"
						? defineAsyncComponent(() => import("@/ui/classic.vue"))
						: defineAsyncComponent(() => import("@/ui/universal.vue")),
	);

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
	
	const wait = async (ms) => new Promise(resolve => setTimeout(resolve, ms));
	
	if ($i && defaultStore.state.longLoading) await wait(3500);

	const splash = document.getElementById("splash");
	// 念のためnullチェック(HTMLが古い場合があるため(そのうち消す))
	if (splash)
		splash.addEventListener("transitionend", () => {
			splash.remove();
		});

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

	reactionPicker.init();

	if (splash) {
		splash.style.opacity = "0";
		splash.style.pointerEvents = "none";
	}

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
				(defaultStore.state.showMiniUpdates || compareVersions(version, lastVersion) === 1) &&
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

	// NOTE: この処理は必ず↑のクライアント更新時処理より後に来ること(テーマ再構築のため)
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

	fetchInstanceMetaPromise.then(() => {
		const reInit = darkTheme?.name === "Rosé Pine" && lightTheme?.name === "l-rosepinedawn"
		if (defaultStore.state.themeInitial || (reInit && !defaultStore.state.completedInit)) {
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
			defaultStore.set("completedInit", true);
		}
	});

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

	stream.on("emojiAdded", (emojiData) => {
		// TODO
		//store.commit('instance/set', );
	});

	for (const plugin of ColdDeviceStorage.get("plugins").filter(
		(p) => p.active,
	)) {
		import("./plugin").then(({ install }) => {
			install(plugin);
		});
	}

	const hotkeys = {
		d: (): void => {
			defaultStore.set("darkMode", !defaultStore.state.darkMode);
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
		
		
		fetchInstanceMetaPromise.then(() => {
			const lastEmojiFetchDate = localStorage.getItem("remoteEmojiData") ? JSON.parse(localStorage.getItem("remoteEmojiData"))?.emojiFetchDate : undefined;
			const emojiFetchDateInt = Math.max(lastEmojiFetchDate ? new Date(lastEmojiFetchDate).valueOf() : 0, localStorage.getItem("emojiFetchAttemptDate") ? parseInt(localStorage.getItem("emojiFetchAttemptDate"), 10) : 0);
			const fetchModeMax = defaultStore.state.remoteEmojisFetch ?? "all";
			const fetchTimeBorder = defaultStore.state.enableDataSaverMode ? 1000 * 60 * 60 * 12 : 1000 * 60 * 60 * 2

			if (fetchModeMax === "always" || (Date.now() - emojiFetchDateInt) > fetchTimeBorder || fetchModeMax !== (localStorage.getItem("lastFetchModeMax") ?? fetchModeMax)) {
				// 常に取得がon or 最終取得日が無い or 前回取得から2時間以上 or 取得設定が前回と異なる場合取得
				//一度キャッシュを破棄
				if (fetchModeMax !== "keep") localStorage.setItem("remoteEmojiData", "");
				// 取得設定を保存
				localStorage.setItem("lastFetchModeMax", fetchModeMax);
				// 最終試行日を更新する
				localStorage.setItem("emojiFetchAttemptDate", Date.now().toString());
				if (fetchModeMax === "always") {
					let fetchRemoteEmojiMetaPromise = fetchAllEmojiNoCache();
					fetchRemoteEmojiMetaPromise.then()(() => {
					});
				} else if (fetchModeMax === "all") {
					let fetchRemoteEmojiMetaPromise = fetchAllEmoji();
					fetchRemoteEmojiMetaPromise.catch(() => {
						// 保存に失敗した場合は軽量版リモート絵文字の取得を試行
						fetchInstanceMetaPromise = fetchPlusEmoji();
					});
					fetchRemoteEmojiMetaPromise.then()(() => {
					});
				} else if (fetchModeMax === "plus") {
					let fetchRemoteEmojiMetaPromise = fetchPlusEmoji();
					fetchRemoteEmojiMetaPromise.then()(() => {
					});
				}
			}
			// 取得設定を保存
			localStorage.setItem("lastFetchModeMax", fetchModeMax);
		});
		
		if (
			!defaultStore.state.showLocalPostsInfoPopup &&
			$i.followingCount >= 10
		) {
			if (defaultStore.isDefault("showLocalPostsInTimeline")){
				const { canceled } = await yesno({
					type: "question",
					text: "ホームTLの内容をフォローしている人のみ表示に変更する事が可能です。\n※ここで変更しない場合でも設定画面>色々にて後から変更する事が可能です。\n今すぐフォローのみの表示に変更しますか？",
				});
				if (!canceled) {
					defaultStore.set("showLocalPostsInTimeline","social")
					defaultStore.set("showLocalPostsInfoPopup",true);
					location.reload();
				} else {
					defaultStore.set("showLocalPostsInTimeline","home")
					defaultStore.set("showLocalPostsInfoPopup",true);
				}
			} else {
				defaultStore.set("showLocalPostsInfoPopup",true);
			}
		}

		const lastUsed = localStorage.getItem("lastUsed");
		if (lastUsed) {
			const lastUsedDate = parseInt(lastUsed, 10);
			// 三日前以上前なら
			if (Date.now() - lastUsedDate > 1000 * 60 * 60 * 72) {
				toast(
					i18n.t("welcomeBackWithNameLong", {
						days: Math.floor((Date.now() - lastUsedDate) / (1000 * 60 * 60 * 24)),
						name: $i.name || $i.username,
					}),
				);
			}
			// 二日前以上前なら
			else if (Date.now() - lastUsedDate > 1000 * 60 * 60 * 48) {
				toast(
					i18n.t("welcomeBackWithNameSleep", {
						name: $i.name || $i.username,
					}),
				);
			}
			// 一日前以上前なら
			else if (Date.now() - lastUsedDate > 1000 * 60 * 60 * 24) {
				toast(
					i18n.t("welcomeBackWithName", {
						name: $i.name || $i.username,
					}),
				);
			}
			// 一時間半以上前なら
			else if (Date.now() - lastUsedDate > 1000 * 60 * 90) {
				// 時間に合わせて挨拶
				const now = new Date();
				if (now.getHours() >= 5 && now.getHours() <= 10) {
					toast(
						i18n.t("welcomeBackWithNameMorning", {
							name: $i.name || $i.username,
						}),
					);
				} else if (now.getHours() >= 11 && now.getHours() <= 15) {
					toast(
						i18n.t("welcomeBackWithNameNoon", {
							name: $i.name || $i.username,
						}),
					);
				} else if (now.getHours() >= 16 && now.getHours() <= 18) {
					if (now.getDay() >= 1 && now.getDay() <= 5) {
						toast(
							i18n.t("welcomeBackWithNameEvening", {
								name: $i.name || $i.username,
							}),
						);
					} else {
						toast(
							i18n.t("welcomeBackWithNameNoon", {
								name: $i.name || $i.username,
							}),
						);
					}
				} else {
					toast(
						i18n.t("welcomeBackWithNameNight", {
							name: $i.name || $i.username,
						}),
					);
				}
			}
		}
		localStorage.setItem("lastUsed", Date.now().toString());

		if ("Notification" in window) {
			// 許可を得ていなかったらリクエスト
			if (Notification.permission === "default") {
				Notification.requestPermission();
			}
		}

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
	}

	// shortcut
	document.addEventListener("keydown", makeHotkey(hotkeys));
})();
