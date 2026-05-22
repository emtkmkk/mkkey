<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
		/></template>
		<MkSpacer :content-max="900" :margin-min="10" :margin-max="10">
			<div ref="el" class="vvcocwet" :class="{ wide: !narrow }">
				<div class="body">
					<div
						v-if="!narrow || currentPage?.route.name == null"
						class="nav"
					>
						<div class="baaadecd">
							<MkInfo v-if="emailNotConfigured" warn class="info"
								>{{ i18n.ts.emailNotConfiguredWarning }}
								<MkA to="/settings/email" class="_link">{{
									i18n.ts.configure
								}}</MkA></MkInfo
							>
							<MkSuperMenu
								:def="menuDef"
								:grid="narrow"
							></MkSuperMenu>
						</div>
					</div>
					<section
						v-if="!(narrow && currentPage?.route.name == null)"
						class="main"
					>
						<div class="bkzroven">
							<RouterView />
						</div>
					</section>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script setup lang="ts">
/**
 * @packageDocumentation
 *
 * 設定画面の親レイアウト。左ナビと子ページの {@link RouterView} を表示する。
 *
 * @remarks
 * NOTE: 設定検索（mkkey-settings）から `?setting=` で遷移したとき、該当項目へ自動スクロールする。
 *
 * @public
 */
import {
	computed,
	nextTick,
	onActivated,
	onMounted,
	onUnmounted,
	provide,
	ref,
	watch,
} from "vue";
import { i18n } from "@/i18n";
import MkInfo from "@/components/MkInfo.vue";
import MkSuperMenu from "@/components/MkSuperMenu.vue";
import { signout, $i } from "@/account";
import { unisonReload } from "@/scripts/unison-reload";
import { instance } from "@/instance";
import { useRouter } from "@/router";
import { deviceKind } from "@/scripts/device-kind";
import {
        definePageMetadata,
        provideMetadataReceiver,
        setPageMetadata,
} from "@/scripts/page-metadata";
import * as os from "@/os";
import { defaultStore } from "@/store";

const indexInfo = {
	title: i18n.ts.settings,
	icon: "ph-gear-six ph-bold ph-lg",
	hideHeader: true,
};
const INFO = ref(indexInfo);
const el = ref<HTMLElement | null>(null);
const childInfo = ref(null);

const router = useRouter();

let narrow = $ref(false);
const NARROW_THRESHOLD = 660

let currentPage = $computed(() => router.currentRef.value.child);

const ro = new ResizeObserver((entries, observer) => {
	if (entries.length === 0) return;
	narrow = entries[0].borderBoxSize[0].inlineSize < NARROW_THRESHOLD;
});

const menuDef = computed(() => [
	{
		title: i18n.ts.basicSettings,
		items: [
			{
				icon: "ph-gear-six ph-bold ph-lg",
				text: i18n.ts.general,
				to: "/settings/general",
				active: currentPage?.route.name === "general",
			},
			{
				icon: "ph-list-plus ph-bold ph-lg",
				text: i18n.ts.mkkeySettings,
				to: "/settings/mkkey-settings",
				active: currentPage?.route.name === "mkkey-settings",
			},
			{
				icon: "ph-user ph-bold ph-lg",
				text: i18n.ts.profile,
				to: "/settings/profile",
				active: currentPage?.route.name === "profile",
			},
			{
				icon: "ph-lock-open ph-bold ph-lg",
				text: i18n.ts.privacy,
				to: "/settings/privacy",
				active: currentPage?.route.name === "privacy",
			},
			{
				icon: "ph-smiley ph-bold ph-lg",
				text: i18n.ts.reaction,
				to: "/settings/reaction",
				active: currentPage?.route.name === "reaction",
			},
			{
				icon: "ph-cloud ph-bold ph-lg",
				text: i18n.ts.drive,
				to: "/settings/drive",
				active: currentPage?.route.name === "drive",
			},
			{
				icon: "ph-bell ph-bold ph-lg",
				text: i18n.ts.notifications,
				to: "/settings/notifications",
				active: currentPage?.route.name === "notifications",
			},
			{
				icon: "ph-envelope-simple-open ph-bold ph-lg",
				text: i18n.ts.email,
				to: "/settings/email",
				active: currentPage?.route.name === "email",
			},
			{
				icon: "ph-share-network ph-bold ph-lg",
				text: i18n.ts.integration,
				to: "/settings/integration",
				active: currentPage?.route.name === "integration",
			},
			{
				icon: "ph-lock ph-bold ph-lg",
				text: i18n.ts.security,
				to: "/settings/security",
				active: currentPage?.route.name === "security",
			},
		],
	},
	{
		title: i18n.ts.clientSettings,
		items: [
			{
				icon: "ph-list-dashes ph-bold ph-lg",
				text: i18n.ts.timeline,
				to: "/settings/timeline",
				active: currentPage?.route.name === "timeline",
			},
			{
				icon: "ph-sneaker-move ph-bold ph-lg",
				text: i18n.ts.behavior,
				to: "/settings/behavior",
				active: currentPage?.route.name === "behavior",
			},
			{
				icon: "ph-note-pencil ph-bold ph-lg",
				text: i18n.ts.postForm,
				to: "/settings/postform",
				active: currentPage?.route.name === "postform",
			},
			{
				icon: "ph-shapes ph-bold ph-lg",
				text: i18n.ts.appearance,
				to: "/settings/appearance",
				active: currentPage?.route.name === "appearance",
			},
			{
				icon: "ph-confetti ph-bold ph-lg",
				text: i18n.ts.funSetting,
				to: "/settings/fun",
				active: currentPage?.route.name === "fun",
			},
			{
				icon: "ph-palette ph-bold ph-lg",
				text: i18n.ts.theme,
				to: "/settings/theme",
				active: currentPage?.route.name === "theme",
			},
                        {
                                icon: "ph-list ph-bold ph-lg",
                                text: i18n.ts.navbar,
                                to: "/settings/navbar",
                                active: currentPage?.route.name === "navbar",
                        },
                        {
                                icon: "ph-traffic-signal ph-bold ph-lg",
                                text: i18n.ts.statusbar,
                                to: "/settings/statusbar",
                                active: currentPage?.route.name === "statusbar",
			},
			{
				icon: "ph-speaker-high ph-bold ph-lg",
				text: i18n.ts.sounds,
				to: "/settings/sounds",
				active: currentPage?.route.name === "sounds",
			},
			{
				icon: "ph-plug ph-bold ph-lg",
				text: i18n.ts.plugins,
				to: "/settings/plugin",
				active: currentPage?.route.name === "plugin",
			},
		],
	},
	{
		title: i18n.ts.otherSettings,
		items: [
			{
				icon: "ph-airplane-takeoff ph-bold ph-lg",
				text: i18n.ts.migration,
				to: "/settings/migration",
				active: currentPage?.route.name === "migration",
			},
			{
				icon: "ph-package ph-bold ph-lg",
				text: i18n.ts.importAndExport,
				to: "/settings/import-export",
				active: currentPage?.route.name === "import-export",
			},
			{
				icon: "ph-speaker-none ph-bold ph-lg",
				text: i18n.ts.instanceMute,
				to: "/settings/instance-mute",
				active: currentPage?.route.name === "instance-mute",
			},
			{
				icon: "ph-prohibit ph-bold ph-lg",
				text: i18n.ts.muteAndBlock,
				to: "/settings/mute-block",
				active: currentPage?.route.name === "mute-block",
			},
			{
				icon: "ph-speaker-x ph-bold ph-lg",
				text: i18n.ts.wordMute,
				to: "/settings/word-mute",
				active: currentPage?.route.name === "word-mute",
			},
			{
				icon: "ph-key ph-bold ph-lg",
				text: i18n.ts.api,
				to: "/settings/api",
				active: currentPage?.route.name === "api",
			},
			{
				icon: "ph-lightning ph-bold ph-lg",
				text: i18n.ts.webhook,
				to: "/settings/webhook",
				active: currentPage?.route.name === "webhook",
			},
			{
				icon: "ph-dots-three-outline ph-bold ph-lg",
				text: i18n.ts.other,
				to: "/settings/account-info",
				active: currentPage?.route.name === "account-info",
			},
		],
	},
	{
		items: [
			{
				icon: "ph-floppy-disk ph-bold ph-lg",
				text: i18n.ts.preferencesBackups,
				to: "/settings/preferences-backups",
				active: currentPage?.route.name === "preferences-backups",
			},
			{
				type: "button",
				icon: "ph-trash ph-bold ph-lg",
				text: i18n.ts.clearCache,
				action: () => {
					localStorage.removeItem("locale");
					localStorage.removeItem("theme");
					unisonReload();
				},
			},
			{
				type: "button",
				icon: "ph-sign-in ph-bold ph-lg fa-flip-horizontal",
				text: i18n.ts.logout,
				action: async () => {
					const { canceled } = await os.confirm({
						type: "warning",
						text: i18n.ts.logoutConfirm,
					});
					if (canceled) return;
					signout();
				},
				danger: true,
			},
		],
	},
]);

watch($$(narrow), () => {});

onMounted(() => {
        ro.observe(el.value);

        narrow = el.value.offsetWidth < NARROW_THRESHOLD;

        if (!narrow && currentPage?.route.name == null) {
                router.replace("/settings/profile");
        }
        scrollToSettingFromQuery();
});

onActivated(() => {
        narrow = el.value.offsetWidth < NARROW_THRESHOLD;

        if (!narrow && currentPage?.route.name == null) {
                router.replace("/settings/profile");
        }
        scrollToSettingFromQuery();
});

onUnmounted(() => {
	ro.disconnect();
	scrollToSettingRetryToken++;
	if (settingHighlightTimer != null) {
		clearTimeout(settingHighlightTimer);
		settingHighlightTimer = null;
	}
});

watch(router.currentRef, (to) => {
        if (
                to.route.name === "settings" &&
                to.child?.route.name == null &&
                !narrow
        ) {
                router.replace("/settings/profile");
        }
        scrollToSettingFromQuery();
});

const emailNotConfigured = computed(
	() => instance.enableEmail && ($i.email == null || !$i.emailVerified)
);

provideMetadataReceiver((info) => {
	if (info == null) {
		childInfo.value = null;
	} else {
		childInfo.value = info;
	}
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(INFO);

//#region 設定検索スクロール

/** ルータのスクロール復元（100ms）より後に再試行する遅延（ms） */
const SETTING_SCROLL_RETRY_MS = [0, 120, 280, 520] as const;

/** 到達した設定項目に付与する強調表示用 class */
const SETTING_HIGHLIGHT_CLASS = "_settingSearchHighlight";

/** 強調表示を外すまでの時間（ms） */
const SETTING_HIGHLIGHT_DURATION_MS = 2500;

/** 進行中のスクロール試行を無効化するための世代番号 */
let scrollToSettingRetryToken = 0;

/** 強調表示を外すタイマー */
let settingHighlightTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * mkkey-settings の検索結果リンク（FormLink）かどうか
 *
 * @remarks
 * 検索一覧と実際の設定項目が同じラベル文言を持つため、リンク行はスクロール対象から除外する。
 *
 * @internal
 */
function isSettingSearchLinkBlock(block: HTMLElement): boolean {
	return (
		block.classList.contains("ffcbddfc") ||
		block.querySelector(":scope > a.main._button, :scope > .main._button") !=
			null
	);
}

/**
 * スクロール対象として表示されているか
 *
 * @internal
 */
function isElementVisibleForScroll(element: HTMLElement): boolean {
	if (element.offsetParent === null) {
		const position = getComputedStyle(element).position;
		if (position !== "fixed" && position !== "sticky") {
			return false;
		}
	}
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

/**
 * 表示中の設定ページ内で、ラベル文言に一致する `_formBlock` を探す
 *
 * @param mainEl - `.main .bkzroven` 要素
 * @param labelText - `i18n.ts[settingKey]` の表示文言
 * @returns 見つかった要素。無ければ `null`
 * @internal
 */
function findSettingBlockInMain(
	mainEl: HTMLElement,
	labelText: string,
): HTMLElement | null {
	const blocks = mainEl.querySelectorAll("._formBlock");
	for (const block of blocks) {
		if (!(block instanceof HTMLElement)) continue;
		if (isSettingSearchLinkBlock(block)) continue;
		if (!isElementVisibleForScroll(block)) continue;
		if (block.textContent?.includes(labelText)) {
			return block;
		}
	}
	return null;
}

/**
 * 到達した設定項目を短時間強調表示する
 *
 * @param block - 強調する `_formBlock` 要素
 * @internal
 */
function highlightSettingBlock(block: HTMLElement): void {
	if (settingHighlightTimer != null) {
		clearTimeout(settingHighlightTimer);
	}
	for (const highlighted of document.querySelectorAll(
		`.${SETTING_HIGHLIGHT_CLASS}`,
	)) {
		highlighted.classList.remove(SETTING_HIGHLIGHT_CLASS);
	}
	block.classList.add(SETTING_HIGHLIGHT_CLASS);
	settingHighlightTimer = setTimeout(() => {
		block.classList.remove(SETTING_HIGHLIGHT_CLASS);
		settingHighlightTimer = null;
	}, SETTING_HIGHLIGHT_DURATION_MS);
}

/**
 * 設定項目へスクロールし、強調表示する
 *
 * @param block - スクロール先の `_formBlock` 要素
 * @internal
 */
function scrollToSettingBlock(block: HTMLElement): void {
	block.scrollIntoView({ behavior: "smooth", block: "center" });
	highlightSettingBlock(block);
}

/**
 * URL の `?setting=` クエリに応じて、該当設定項目へスクロールする
 *
 * @remarks
 * - 検索対象は表示中の子ページ（`.main .bkzroven`）のみ
 * - 非同期描画・ルータのスクロール復元に備え、短い遅延で複数回試行する
 * - 各項目に `data-setting` は無く、表示文言で `_formBlock` を特定する（将来 `data-setting` 化の余地あり）
 *
 * @internal
 */
function scrollToSettingFromQuery(): void {
	const currentPath = router.getCurrentPath();
	if (typeof window === "undefined") return;

	let key: string | null = null;
	try {
		key = new URL(currentPath, window.location.origin).searchParams.get(
			"setting",
		);
	} catch {
		return;
	}

	if (!key) return;

	const labelText = i18n.ts[key] as unknown as string | undefined;
	if (!labelText) return;

	const retryToken = ++scrollToSettingRetryToken;

	const attemptScroll = () => {
		if (retryToken !== scrollToSettingRetryToken) return;

		const rootEl = el.value;
		const mainEl = rootEl?.querySelector<HTMLElement>(".main .bkzroven");
		if (!mainEl) return;

		const block = findSettingBlockInMain(mainEl, labelText);
		if (block) {
			scrollToSettingBlock(block);
		}
	};

	void nextTick(() => {
		for (const delayMs of SETTING_SCROLL_RETRY_MS) {
			window.setTimeout(attemptScroll, delayMs);
		}
	});
}

//#endregion
// w 890
// h 700
</script>

<style lang="scss" scoped>
.vvcocwet {
	background-color: var(--bg);
  border-radius: 10px;
  padding: 1rem;
	> .body {
		> .nav {
			.baaadecd {
				> .info {
					margin: 1rem 0;
				}

				> .accounts {
					> .avatar {
						display: block;
						width: 3.125rem;
						height: 3.125rem;
						margin: 0.5rem auto 1rem auto;
					}
				}
			}
		}

		> .main {
			.bkzroven {
			}
		}
	}

	:deep(._settingSearchHighlight) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 0.375rem;
		transition: outline-color 0.3s ease;
	}

	&.wide {
		> .body {
			display: flex;
			height: 100%;

			> .nav {
				width: 34%;
				padding-right: 2rem;
				box-sizing: border-box;
			}

			> .main {
				flex: 1;
				min-width: 0;
			}
		}
	}
}
</style>
