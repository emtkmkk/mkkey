<template>
	<div class="dkgtipfy" :class="{ wallpaper, isMobile }">
		<XSidebar v-if="!isMobile" class="sidebar" />

		<MkStickyContainer class="contents">
			<template #header
				><XStatusBars :class="$style.statusbars"
			/></template>
			<main
				id="maincontent"
				style="min-width: 0"
				:style="{ background: pageMetadata?.value?.bg }"
				@contextmenu.stop="onContextmenu"
			>
				<div :class="$style.content">
					<RouterView />
				</div>
				<div :class="$style.spacer"></div>
			</main>
		</MkStickyContainer>

		<div v-if="isDesktop" ref="widgetsEl" class="widgets">
			<XWidgets @mounted="attachSticky" />
		</div>

		<button
			v-if="!isDesktop && !isMobile"
			class="widgetButton _button"
			@click="widgetsShowing = true"
		>
			<i class="ph-stack ph-bold ph-lg"></i>
		</button>

		<div v-if="isMobile" ref="navFooter" class="buttons">
			<button
				class="button nav _button"
				@click="drawerMenuShowing = true"
			>
				<div class="button-wrapper">
					<i class="ph-list ph-bold ph-lg"></i
					><span v-if="menuIndicated" class="indicator"
						><i class="ph-circle ph-fill"></i
					></span>
				</div>
			</button>
			<button
				class="button home _button"
				@click="
					mainRouter.currentRoute.value.name === 'index'
						? top()
						: mainRouter.push('/');
					updateButtonState();
				"
			>
				<div
					class="button-wrapper"
					:class="buttonAnimIndex === 0 ? 'on' : ''"
				>
					<i class="ph-house ph-bold ph-lg"></i>
				</div>
			</button>
			<button
				class="button notifications _button"
				@click="
					mainRouter.push('/my/notifications');
					updateButtonState();
				"
			>
				<div
					class="button-wrapper"
					:class="buttonAnimIndex === 1 ? 'on' : ''"
				>
					<i class="ph-bell ph-bold ph-lg"></i
					><span v-if="$i?.hasUnreadNotification" class="indicator"
						><i class="ph-circle ph-fill"></i
					></span>
				</div>
			</button>
			<button
				v-if="tbitem"
				class="button messaging _button"
				@click="
					navbarItemDef[tbitem].action
						? navbarItemDef[tbitem].action($event)
						: mainRouter.push(navbarItemDef[tbitem].to);
					updateButtonState();
				"
			>
				<div
					class="button-wrapper"
					:class="buttonAnimIndex === 2 ? 'on' : ''"
				>
					<i class="ph-lg" :class="navbarItemDef[tbitem].icon"></i
					><span
						v-if="navbarItemDef[tbitem].indicated"
						class="indicator"
						><i class="ph-circle ph-fill"></i
					></span>
				</div>
			</button>
			<button
				class="button widget _button"
				@click="widgetsShowing = true"
			>
				<div class="button-wrapper">
					<i class="ph-stack ph-bold ph-lg"></i>
				</div>
			</button>
		</div>

		<button
			v-if="
				(isMobile && mainRouter.currentRoute.value.name === 'index') ||
				($store.state.alwaysPostButton &&
					mainRouter.currentRoute.value.name !== 'messaging' &&
					!mainRouter.currentRoute.value.path.includes('messaging') &&
					!mainRouter.currentRoute.value.path.includes('channels'))
			"
			ref="postButton"
			class="postButton button post _button"
			@click="os.post()"
		>
			<i class="ph-pencil ph-bold ph-lg"></i>
		</button>
		<button
			v-if="
				(isMobile || $store.state.alwaysPostButton) &&
				mainRouter.currentRoute.value.name === 'messaging'
			"
			ref="postButton"
			class="postButton button post _button"
			@click="messagingStart"
		>
			<i class="ph-user-plus ph-bold ph-lg"></i>
		</button>

		<transition :name="$store.state.animation ? 'menuDrawer-back' : ''">
			<div
				v-if="drawerMenuShowing"
				class="menuDrawer-back _modalBg"
				@click="drawerMenuShowing = false"
				@touchstart.passive="drawerMenuShowing = false"
			></div>
		</transition>

		<transition :name="$store.state.animation ? 'menuDrawer' : ''">
			<XDrawerMenu v-if="drawerMenuShowing" class="menuDrawer" />
		</transition>

		<transition :name="$store.state.animation ? 'widgetsDrawer-back' : ''">
			<div
				v-if="widgetsShowing"
				class="widgetsDrawer-back _modalBg"
				@click="widgetsShowing = false"
				@touchstart.passive="widgetsShowing = false"
			></div>
		</transition>

		<transition :name="$store.state.animation ? 'widgetsDrawer' : ''">
			<XWidgets v-if="widgetsShowing" class="widgetsDrawer" />
		</transition>

		<XCommon />
	</div>
</template>

<script lang="ts" setup>
import {
	defineAsyncComponent,
	provide,
	onMounted,
	computed,
	ref,
	unref,
	shallowRef,
	watch,
	inject,
	Ref,
} from "vue";
import XCommon from "./_common_/common.vue";
import * as Acct from "calckey-js/built/acct";
import type { ComputedRef } from "vue";
import type { PageMetadata } from "@/scripts/page-metadata";
import { instanceName } from "@/config";
import { StickySidebar } from "@/scripts/sticky-sidebar";
import XDrawerMenu from "@/ui/_common_/navbar-for-mobile.vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { navbarItemDef } from "@/navbar";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import { mainRouter } from "@/router";
import {
	provideMetadataReceiver,
	setPageMetadata,
} from "@/scripts/page-metadata";
import { deviceKind } from "@/scripts/device-kind";

const XWidgets = defineAsyncComponent(() => import("./universal.widgets.vue"));
const XSidebar = defineAsyncComponent(() => import("@/ui/_common_/navbar.vue"));
const XStatusBars = defineAsyncComponent(
	() => import("@/ui/_common_/statusbars.vue")
);

const DESKTOP_THRESHOLD = 1100;
const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = ref(
	(deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD) &&
		defaultStore.state.overridedDeviceKind !== "desktop-force"
);
window.addEventListener("resize", () => {
	isMobile.value =
		(deviceKind === "smartphone" ||
			window.innerWidth <= MOBILE_THRESHOLD) &&
		defaultStore.state.overridedDeviceKind !== "desktop-force";
});

const buttonAnimIndex = ref(0);
const drawerMenuShowing = ref(false);

let pageMetadata = $ref<null | ComputedRef<PageMetadata>>();
const widgetsEl = $ref<HTMLElement>();
const postButton = $ref<HTMLElement>();
const widgetsShowing = $ref(false);
const navFooter = $shallowRef<HTMLElement>();

provide("router", mainRouter);
provideMetadataReceiver((info) => {
	pageMetadata = info;
	if (pageMetadata.value) {
		document.title = `${pageMetadata.value.title} | ${instanceName}`;
	}
});

const tbitem = computed(() => {
	if (navbarItemDef?.[defaultStore.state.mobileThirdButton]) {
		return defaultStore.state.mobileThirdButton;
	} else {
		return undefined;
	}
});

const menuIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (def === "notifications") continue; // 通知は下にボタンとして表示されてるから
		if (def === tbitem) continue; // 3番目のボタンは通知にしない
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

function updateButtonState(): void {
	let routerState = window.location.pathname;
	if (routerState === "/") {
		buttonAnimIndex.value = 0;
		return;
	}
	if (routerState.includes("/my/notifications")) {
		buttonAnimIndex.value = 1;
		return;
	}
	if (
		navbarItemDef[unref(tbitem)]?.to
			? routerState.includes(navbarItemDef[unref(tbitem)].to)
			: false
	) {
		buttonAnimIndex.value = 2;
		return;
	}
	buttonAnimIndex.value = 3;
	return;
}

updateButtonState();

mainRouter.on("change", () => {
	drawerMenuShowing.value = false;
	updateButtonState();
});

document.documentElement.style.overflowY = "scroll";

defaultStore.loaded.then(() => {
	if (defaultStore.state.widgets.length === 0) {
		defaultStore.set("widgets", [
			{
				name: "digitalClock",
				id: "a",
				place: "right",
				data: {},
			},
			{
				name: "calendar",
				id: "b",
				place: "right",
				data: {},
			},
			{
				name: "notifications",
				id: "c",
				place: "right",
				data: {},
			},
		]);
	}
});

function messagingStart(ev) {
	os.popupMenu(
		[
			{
				text: i18n.ts.messagingWithUser,
				icon: "ph-user ph-bold ph-lg",
				action: () => {
					startUser();
				},
			},
			{
				text: i18n.ts.messagingWithGroup,
				icon: "ph-users-three ph-bold ph-lg",
				action: () => {
					startGroup();
				},
			},
			{
				text: i18n.ts.manageGroups,
				icon: "ph-user-circle-gear ph-bold ph-lg",
				action: () => {
					mainRouter.push("/my/groups");
				},
			},
		],
		ev.currentTarget ?? ev.target
	);
}

async function startUser(): void {
	os.selectUser().then((user) => {
		mainRouter.push(`/my/messaging/${Acct.toString(user)}`);
	});
}

async function startGroup(): void {
	const groups1 = await os.api("users/groups/owned");
	const groups2 = await os.api("users/groups/joined");
	if (groups1.length === 0 && groups2.length === 0) {
		os.alert({
			type: "warning",
			title: i18n.ts.youHaveNoGroups,
			text: i18n.ts.joinOrCreateGroup,
		});
		return;
	}
	const { canceled, result: group } = await os.select({
		title: i18n.ts.group,
		items: groups1.concat(groups2).map((group) => ({
			value: group,
			text: group.name,
		})),
	});
	if (canceled) return;
	mainRouter.push(`/my/messaging/group/${group.id}`);
}

onMounted(() => {
	if (!isDesktop.value) {
		window.addEventListener(
			"resize",
			() => {
				if (window.innerWidth >= DESKTOP_THRESHOLD)
					isDesktop.value = true;
			},
			{ passive: true }
		);
	}
});

const onContextmenu = (ev: MouseEvent) => {
	const isLink = (el: HTMLElement) => {
		if (el.tagName === "A") return true;
		if (el.parentElement) {
			return isLink(el.parentElement);
		}
	};
	if (isLink(ev.target)) return;
	if (
		["INPUT", "TEXTAREA", "IMG", "VIDEO", "CANVAS"].includes(
			ev.target.tagName
		) ||
		ev.target.attributes["contenteditable"]
	)
		return;
	if (window.getSelection()?.toString() !== "") return;
	const path = mainRouter.getCurrentPath();
	os.contextMenu(
		[
			{
				type: "label",
				text: path,
			},
			{
				icon: "ph-browser ph-bold ph-lg",
				text: i18n.ts.openInWindow,
				action: () => {
					os.pageWindow(path);
				},
			},
		],
		ev
	);
};

const attachSticky = (el: any) => {
	const sticky = new StickySidebar(widgetsEl);
	window.addEventListener(
		"scroll",
		() => {
			sticky.calc(window.scrollY);
		},
		{ passive: true }
	);
};

function top() {
	window.scroll({ top: 0, behavior: "smooth" });
}

let navFooterHeight = $ref(0);
provide<Ref<number>>("CURRENT_STICKY_BOTTOM", $$(navFooterHeight));

watch(
	$$(navFooter),
	() => {
		if (navFooter) {
			navFooterHeight = navFooter.offsetHeight;
			document.body.style.setProperty(
				"--stickyBottom",
				`${navFooterHeight}px`
			);
			document.body.style.setProperty(
				"--minBottomSpacing",
				"var(--minBottomSpacingMobile)"
			);
		} else {
			navFooterHeight = 0;
			document.body.style.setProperty("--stickyBottom", "0");
			document.body.style.setProperty("--minBottomSpacing", "0");
		}
	},
	{
		immediate: true,
	}
);

const wallpaper = localStorage.getItem("wallpaper") != null;
console.log(mainRouter.currentRoute.value.name);
</script>

<style lang="scss" scoped>
.widgetsDrawer-enter-active,
.widgetsDrawer-leave-active {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1),
		opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.widgetsDrawer-enter-from,
.widgetsDrawer-leave-active {
	opacity: 0;
	transform: translateX(15rem);
}

.widgetsDrawer-back-enter-active,
.widgetsDrawer-back-leave-active {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.widgetsDrawer-back-enter-from,
.widgetsDrawer-back-leave-active {
	opacity: 0;
}

.menuDrawer-enter-active,
.menuDrawer-leave-active {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1),
		opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.menuDrawer-enter-from,
.menuDrawer-leave-active {
	opacity: 0;
	transform: translateX(-15rem);
}

.menuDrawer-back-enter-active,
.menuDrawer-back-leave-active {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.menuDrawer-back-enter-from,
.menuDrawer-back-leave-active {
	opacity: 0;
}

.dkgtipfy {
	$ui-font-size: 1em; // TODO: どこかに集約したい
	$widgets-hide-threshold: 68.125rem;

	// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
	min-height: calc(var(--vh, 1vh) * 100);
	box-sizing: border-box;
	display: flex;

	&.wallpaper {
		background: var(--wallpaperOverlay);
		//backdrop-filter: var(--blur, blur(4px));
	}

	> .sidebar {
		border-right: solid 0.03125rem var(--divider);
	}

	> .contents {
		width: 100%;
		min-width: 0;
	}

	> .widgets {
		padding: 0 var(--margin);
		border-left: solid 0.03125rem var(--divider);

		@media (max-width: $widgets-hide-threshold) {
			display: none;
		}
	}

	> .widgetsDrawer-back {
		z-index: 1001;
	}

	> .widgetsDrawer {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 1001;
		// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
		height: calc(var(--vh, 1vh) * 100);
		padding: var(--margin);
		box-sizing: border-box;
		overflow: auto;
		overscroll-behavior: contain;
		background: var(--bg);
	}

	> .postButton,
	.widgetButton {
		bottom: calc(env(safe-area-inset-bottom, 0) + var(--stickyBottom));
		right: 1.5rem;
		height: 4rem;
		width: 4rem;
		background-position: center;
		background: var(--panelHighlight);
		color: var(--fg);
		position: fixed !important;
		z-index: 1000;
		font-size: 1rem;
		border-radius: 0.625rem;
		box-shadow: var(--shadow) 0 0 1.5625rem;
		transition: background 0.6s;
		transition: transform 0.3s;

		> .isHidden {
			transform: scale(0);
		}

		> .isVisible {
			transform: scale(1);
		}

		&:active {
			background-color: var(--accentedBg);
			background-size: 100%;
			transition: background 0.1s;
		}
	}

	> .buttons {
		position: fixed;
		z-index: 1000;
		bottom: 0;
		left: 0;
		padding: 0.75rem 0.75rem calc(env(safe-area-inset-bottom, 0) + 0.75rem)
			0.75rem;
		display: flex;
		width: 100%;
		box-sizing: border-box;
		background-color: var(--bg);

		> .button {
			position: relative;
			flex: 1;
			padding: 0;
			margin: auto;
			height: 3.5rem;
			border-radius: 0.5rem;
			background-position: center;
			transition: background 0.6s;
			color: var(--fg);

			&:active {
				background-color: var(--accentedBg);
				background-size: 100%;
				transition: background 0.1s;
			}

			> .button-wrapper {
				display: inline-flex;
				justify-content: center;

				&.on {
					background-color: var(--accentedBg);
					width: 100%;
					border-radius: 999px;
					transform: translateY(-0.5em);
					transition: all 0.2s ease-in-out;
				}

				> .indicator {
					position: absolute;
					top: 0;
					left: 0;
					color: var(--indicator);
					font-size: 1rem;
					animation: blink 1s infinite;
				}
			}

			&:not(:last-child) {
				margin-right: 0.75rem;
			}

			@media (max-width: 25rem) {
				height: 3.75rem;

				&:not(:last-child) {
					margin-right: 0.5rem;
				}
			}
			> .indicator {
				position: absolute;
				top: 0;
				left: 0;
				color: var(--indicator);
				font-size: 1rem;
				animation: blink 1s infinite;
			}

			&:first-child {
				margin-left: 0;
			}

			&:last-child {
				margin-right: 0;
			}

			> * {
				font-size: 1rem;
			}

			&:disabled {
				cursor: default;

				> * {
					opacity: 0.5;
				}
			}
		}
	}

	> .menuDrawer-back {
		z-index: 1001;
	}

	> .menuDrawer {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1001;
		// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
		height: calc(var(--vh, 1vh) * 100);
		width: 15rem;
		box-sizing: border-box;
		contain: strict;
		overflow: auto;
		overscroll-behavior: contain;
		background: var(--navBg);
	}
}
</style>

<style lang="scss" module>
.statusbars {
	position: sticky;
	top: 0;
	left: 0;
}

.spacer {
	$widgets-hide-threshold: 68.125rem;

	height: calc(var(--minBottomSpacing));

	@media (min-width: ($widgets-hide-threshold + 0.0625rem)) {
		display: none;
	}
}
</style>
