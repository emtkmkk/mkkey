<template>
	<div
		class="gbhvwtnk"
		:class="{ wallpaper }"
		:style="`--globalHeaderHeight:${globalHeaderHeight}px`"
	>
		<XHeaderMenu
			v-if="showMenuOnTop"
			v-get-size="(w, h) => (globalHeaderHeight = h)"
		/>

		<div
			class="columns"
			:class="{ fullView, withGlobalHeader: showMenuOnTop }"
		>
			<XSidebar v-if="!showMenuOnTop" />
			<div v-else ref="widgetsLeft" class="widgets left">
				<XWidgets
					:place="'left'"
					@mounted="attachSticky(widgetsLeft)"
				/>
			</div>

			<main
				class="main"
				:style="{ background: pageMetadata?.value?.bg }"
				@contextmenu.stop="onContextmenu"
			>
				<div class="content">
					<RouterView />
				</div>
			</main>

			<div v-if="isDesktop" ref="widgetsRight" class="widgets right">
				<XWidgets :place="null" @mounted="attachSticky(widgetsRight)" />
			</div>
		</div>

		<transition :name="$store.state.animation ? 'tray-back' : ''">
			<div
				v-if="widgetsShowing"
				class="tray-back _modalBg"
				@click="widgetsShowing = false"
				@touchstart.passive="widgetsShowing = false"
			></div>
		</transition>

		<transition :name="$store.state.animation ? 'tray' : ''">
			<XWidgets v-if="widgetsShowing" class="tray" />
		</transition>

		<XCommon />
	</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, markRaw, ref, onMounted, provide } from "vue";
import XSidebar from "./_common_/navbar.vue";
import XCommon from "./_common_/common.vue";
import type { ComputedRef } from "vue";
import type { PageMetadata } from "@/scripts/page-metadata";
import { instanceName } from "@/config";
import { StickySidebar } from "@/scripts/sticky-sidebar";
import * as os from "@/os";
import { mainRouter } from "@/router";
import {
	provideMetadataReceiver,
	setPageMetadata,
} from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
const XHeaderMenu = defineAsyncComponent(() => import("./classic.header.vue"));
const XWidgets = defineAsyncComponent(() => import("./universal.widgets.vue"));

const DESKTOP_THRESHOLD = 1100;

let isDesktop = $ref(window.innerWidth >= DESKTOP_THRESHOLD);

let pageMetadata = $ref<null | ComputedRef<PageMetadata>>();
let widgetsShowing = $ref(false);
let fullView = $ref(false);
let globalHeaderHeight = $ref(0);
const wallpaper = localStorage.getItem("wallpaper") != null;
const showMenuOnTop = $computed(() => defaultStore.state.menuDisplay === "top");
let live2d = $ref<HTMLIFrameElement>();
let widgetsLeft = $ref();
let widgetsRight = $ref();

provide("router", mainRouter);
provideMetadataReceiver((info) => {
	pageMetadata = info;
	if (pageMetadata.value) {
		document.title = `${pageMetadata.value.title} | ${instanceName}`;
	}
});
provide("shouldHeaderThin", showMenuOnTop);
provide("shouldSpacerMin", true);

function attachSticky(el) {
	const sticky = new StickySidebar(
		el,
		defaultStore.state.menuDisplay === 0,
		defaultStore.state.menuDisplay === "top" ? 60 : 0
	); // TODO: ヘッダーの高さを60pxと決め打ちしているのを直す
	window.addEventListener(
		"scroll",
		() => {
			sticky.calc(window.scrollY);
		},
		{ passive: true }
	);
}

function top() {
	window.scroll({ top: 0, behavior: "smooth" });
}

function onContextmenu(ev: MouseEvent) {
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
	if (window.getSelection().toString() !== "") return;
	const path = mainRouter.getCurrentPath();
	os.contextMenu(
		[
			{
				type: "label",
				text: path,
			},
			{
				icon: fullView
					? "ph-arrows-in-simple ph-bold ph-lg"
					: "ph-arrows-out-simple ph-bold ph-lg",
				text: fullView ? i18n.ts.quitFullView : i18n.ts.fullView,
				action: () => {
					fullView = !fullView;
				},
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
}

if (window.innerWidth < 1024) {
	localStorage.setItem("ui", "default");
	location.reload();
}

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

onMounted(() => {
	window.addEventListener(
		"resize",
		() => {
			isDesktop = window.innerWidth >= DESKTOP_THRESHOLD;
		},
		{ passive: true }
	);
});
</script>

<style lang="scss" scoped>
.tray-enter-active,
.tray-leave-active {
	opacity: 1;
	transform: translateX(0);
	transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1),
		opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.tray-enter-from,
.tray-leave-active {
	opacity: 0;
	transform: translateX(15rem);
}

.tray-back-enter-active,
.tray-back-leave-active {
	opacity: 1;
	transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
}
.tray-back-enter-from,
.tray-back-leave-active {
	opacity: 0;
}

.gbhvwtnk {
	display: flex;
	justify-content: center;
	$ui-font-size: 1em;
	$widgets-hide-threshold: 75rem;

	// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
	min-height: calc(var(--vh, 1vh) * 100);
	box-sizing: border-box;

	--navBg: transparent;
	--X14: var(--acrylicBg);

	&.wallpaper {
		background: var(--wallpaperOverlay);
		:deep(main) {
			background: var(--acrylicBg) !important;
			backdrop-filter: blur(12px);
		}
		:deep(.tl),
		:deep(.notes) {
			background: none !important;
		}
	}

	> .columns {
		display: flex;
		justify-content: center;
		max-width: 100%;
		//margin: 2rem 0;

		&.fullView {
			margin: 0;

			> :deep(.sidebar) {
				display: none;
			}

			> .widgets {
				display: none;
			}

			> .main {
				margin: 0;
				border-radius: 0;
				box-shadow: none;
				width: 100%;
			}
		}

		> :deep(.sidebar) {
			margin-left: -12.5rem;
			padding-left: 12.5rem;
			box-sizing: content-box;
			.banner {
				pointer-events: none;
				mask: radial-gradient(
					farthest-side at top,
					hsl(0, 0%, 0%) 0%,
					hsla(0, 0%, 0%, 0.987) 0.3%,
					hsla(0, 0%, 0%, 0.951) 1.4%,
					hsla(0, 0%, 0%, 0.896) 3.2%,
					hsla(0, 0%, 0%, 0.825) 5.8%,
					hsla(0, 0%, 0%, 0.741) 9.3%,
					hsla(0, 0%, 0%, 0.648) 13.6%,
					hsla(0, 0%, 0%, 0.55) 18.9%,
					hsla(0, 0%, 0%, 0.45) 25.1%,
					hsla(0, 0%, 0%, 0.352) 32.4%,
					hsla(0, 0%, 0%, 0.259) 40.7%,
					hsla(0, 0%, 0%, 0.175) 50.2%,
					hsla(0, 0%, 0%, 0.104) 60.8%,
					hsla(0, 0%, 0%, 0.049) 72.6%,
					hsla(0, 0%, 0%, 0.013) 85.7%,
					hsla(0, 0%, 0%, 0) 100%
				) !important;
				-webkit-mask: radial-gradient(
					farthest-side at top,
					hsl(0, 0%, 0%) 0%,
					hsla(0, 0%, 0%, 0.987) 0.3%,
					hsla(0, 0%, 0%, 0.951) 1.4%,
					hsla(0, 0%, 0%, 0.896) 3.2%,
					hsla(0, 0%, 0%, 0.825) 5.8%,
					hsla(0, 0%, 0%, 0.741) 9.3%,
					hsla(0, 0%, 0%, 0.648) 13.6%,
					hsla(0, 0%, 0%, 0.55) 18.9%,
					hsla(0, 0%, 0%, 0.45) 25.1%,
					hsla(0, 0%, 0%, 0.352) 32.4%,
					hsla(0, 0%, 0%, 0.259) 40.7%,
					hsla(0, 0%, 0%, 0.175) 50.2%,
					hsla(0, 0%, 0%, 0.104) 60.8%,
					hsla(0, 0%, 0%, 0.049) 72.6%,
					hsla(0, 0%, 0%, 0.013) 85.7%,
					hsla(0, 0%, 0%, 0) 100%
				) !important;
				width: 125% !important;
				left: -12.5% !important;
				height: 125% !important;
			}
		}

		> .main {
			min-width: 0;
			width: 46.875rem;
			margin: 0 1rem 0 0;
			background: var(--panel);
			border-left: solid 0.0625rem var(--divider);
			border-right: solid 0.0625rem var(--divider);
			border-radius: 0;
			overflow: clip;
			--margin: 0.75rem;
			background: var(--bg);
		}

		> .widgets {
			//--panelBorder: none;
			width: 18.75rem;

			@media (max-width: $widgets-hide-threshold) {
				display: none;
			}

			&.left {
				margin-right: 1rem;
			}
		}

		&.withGlobalHeader {
			> .main {
				margin-top: 0;
				border: solid 0.0625rem var(--divider);
				border-radius: var(--radius);
				--stickyTop: var(--globalHeaderHeight);
			}

			> .widgets {
				--stickyTop: var(--globalHeaderHeight);
				margin-top: 0;
			}
		}

		@media (max-width: 53.125rem) {
			margin: 0;

			> :deep(.sidebar) {
				border-right: solid 0.03125rem var(--divider);
			}

			> .main {
				margin: 0;
				border-radius: 0;
				box-shadow: none;
				width: 100%;
			}
		}
	}

	> .tray-back {
		z-index: 1001;
	}

	> .tray {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 1001;
		// ほんとは単に 100vh と書きたいところだが... https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
		height: calc(var(--vh, 1vh) * 100);
		padding: var(--margin);
		box-sizing: border-box;
		overflow: auto;
		background: var(--bg);
	}

	> .ivnzpscs {
		position: fixed;
		bottom: 0;
		right: 0;
		width: 18.75rem;
		height: 37.5rem;
		border: none;
		pointer-events: none;
	}
}
</style>
