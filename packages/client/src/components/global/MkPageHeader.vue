<template>
	<header
		v-if="show"
		ref="el"
		class="fdidabkb"
		:class="{ slim: narrow, thin: thin_ }"
		:style="{ background: bg }"
		@click="onClick"
	>
		<button
			v-if="props.displayBackButton"
			class="_button button icon backButton"
			@click.stop="goBack()"
			@touchstart="preventDrag"
			v-tooltip.noDelay="i18n.ts.goBack"
		>
			<i class="ph-caret-left ph-bold ph-lg"></i>
		</button>
		<div v-if="narrow" class="buttons left" @click="openAccountMenu">
			<img
				v-if="
					props.displayMyAvatar && $i && $store.state.hiddenHeaderIcon
				"
				:src="$instance.iconUrl"
				class="avatar _ghost"
				alt="icon"
			/>
			<MkAvatar
				v-else-if="props.displayMyAvatar && $i"
				class="avatar"
				:user="$i"
				:disable-preview="true"
				disableLink
			/>
		</div>
		<template v-if="metadata">
			<div
				v-if="!hideTitle"
				class="titleContainer"
				@click="showTabsPopup"
			>
				<MkAvatar
					v-if="metadata.avatar"
					class="avatar"
					:user="metadata.avatar"
					:disable-preview="true"
					:show-indicator="true"
					disableLink
				/>
				<i
					v-else-if="metadata.icon && !narrow"
					class="icon"
					:class="metadata.icon"
				></i>

				<div class="title">
					<MkUserName
						v-if="metadata.userName"
						:user="metadata.userName"
						:nowrap="true"
						class="title"
					/>
					<div
						v-else-if="
							metadata.title &&
							!(tabs != null && tabs.length > 0 && narrow)
						"
						class="title"
					>
						{{ metadata.title }}
					</div>
					<div v-if="!narrow && metadata.subtitle" class="subtitle">
						{{ metadata.subtitle }}
					</div>
				</div>
			</div>
			<nav ref="tabsEl" v-if="hasTabs" class="tabs">
				<button
					v-for="tab in tabs"
					:ref="(el) => (tabRefs[tab.key] = el)"
					v-tooltip.noDelay="tab.title"
					class="tab _button"
					:class="{
						active: tab.key != null && tab.key === props.tab,
					}"
					@mousedown="(ev) => onTabMousedown(tab, ev)"
					@click="(ev) => onTabClick(tab, ev)"
				>
					<i v-if="tab.icon" class="icon" :class="tab.icon"></i>
					<span class="title">{{ tab.title }}</span>
				</button>
				<div ref="tabHighlightEl" class="highlight"></div>
			</nav>
		</template>
		<div class="buttons right">
			<template v-for="action in actions">
				<button
					v-tooltip.noDelay="action.text"
					class="_button button"
					:class="{ highlighted: action.highlighted }"
					@click.stop="action.handler"
					@touchstart="preventDrag"
				>
					<i :class="action.icon"></i>
				</button>
			</template>
		</div>
	</header>
</template>

<script lang="ts" setup>
import {
	computed,
	onMounted,
	onUnmounted,
	ref,
	inject,
	watch,
	shallowReactive,
	nextTick,
	reactive,
} from "vue";
import tinycolor from "tinycolor2";
import { popupMenu } from "@/os";
import { scrollToTop } from "@/scripts/scroll";
import { globalEvents } from "@/events";
import { injectPageMetadata } from "@/scripts/page-metadata";
import { $i, openAccountMenu as openAccountMenu_ } from "@/account";
import { i18n } from "@/i18n";

type Tab = {
	key?: string | null;
	title: string;
	icon?: string;
	iconOnly?: boolean;
	onClick?: (ev: MouseEvent) => void;
};

const props = defineProps<{
	tabs?: Tab[];
	tab?: string;
	actions?: {
		text: string;
		icon: string;
		handler: (ev: MouseEvent) => void;
	}[];
	thin?: boolean;
	displayMyAvatar?: boolean;
	displayBackButton?: boolean;
}>();

const emit = defineEmits<{
	(ev: "update:tab", key: string);
}>();

const metadata = injectPageMetadata();

const hideTitle = inject("shouldOmitHeaderTitle", false);
const thin_ = props.thin || inject("shouldHeaderThin", false);

const el = $ref<HTMLElement | null>(null);
const tabRefs = {};
const tabHighlightEl = $ref<HTMLElement | null>(null);
const tabsEl = $ref<HTMLElement | null>(null);
const bg = ref(null);
let narrow = $ref(false);
const height = ref(0);
const hasTabs = $computed(() => props.tabs && props.tabs.length > 0);
const hasActions = $computed(() => props.actions && props.actions.length > 0);
const show = $computed(() => {
	return !hideTitle || hasTabs || hasActions;
});

const openAccountMenu = (ev: MouseEvent) => {
	openAccountMenu_(
		{
			withExtraOperation: true,
		},
		ev
	);
};

const showTabsPopup = (ev: MouseEvent) => {
	if (!hasTabs) return;
	if (!narrow) return;
	ev.preventDefault();
	ev.stopPropagation();
	const menu = props.tabs.map((tab) => ({
		text: tab.title,
		icon: tab.icon,
		active: tab.key != null && tab.key === props.tab,
		action: (ev) => {
			onTabClick(tab, ev);
		},
	}));
	popupMenu(menu, ev.currentTarget ?? ev.target);
};

const preventDrag = (ev: TouchEvent) => {
	ev.stopPropagation();
};

const onClick = () => {
	scrollToTop(el, { behavior: "smooth" });
};

function onTabMousedown(tab: Tab, ev: MouseEvent): void {
	// ユーザビリティの観点からmousedown時にはonClickは呼ばない
	if (tab.key) {
		emit("update:tab", tab.key);
	}
}

function onTabClick(tab: Tab, ev: MouseEvent): void {
	if (tab.onClick) {
		ev.preventDefault();
		ev.stopPropagation();
		tab.onClick(ev);
	}
	if (tab.key) {
		emit("update:tab", tab.key);
	}
}

function goBack(): void {
	window.history.back();
}

const calcBg = () => {
	const rawBg = metadata?.bg || "var(--bg)";
	const tinyBg = tinycolor(
		rawBg.startsWith("var(")
			? getComputedStyle(document.documentElement).getPropertyValue(
					rawBg.slice(4, -1)
			  )
			: rawBg
	);
	tinyBg.setAlpha(0.85);
	bg.value = tinyBg.toRgbString();
};

let ro: ResizeObserver | null;

onMounted(() => {
	calcBg();
	globalEvents.on("themeChanged", calcBg);

	watch(
		() => [props.tab, props.tabs],
		() => {
			nextTick(() => {
				const tabEl = tabRefs[props.tab];
				if (tabEl && tabHighlightEl) {
					// offsetWidth や offsetLeft は少数を丸めてしまうため getBoundingClientRect を使う必要がある
					// https://developer.mozilla.org/ja/docs/Web/API/HTMLElement/offsetWidth#%E5%80%A4
					const tabSizeX = tabEl.scrollWidth + 20; // + the tab's padding
					tabEl.style = `--width: ${tabSizeX}px`;
					setTimeout(() => {
						const parentRect = tabsEl.getBoundingClientRect();
						const rect = tabEl.getBoundingClientRect();
						const left =
							rect.left - parentRect.left + tabsEl?.scrollLeft;
						tabHighlightEl.style.width = `${tabSizeX}px`;
						tabHighlightEl.style.transform = `translateX(${left}px)`;
						window.requestAnimationFrame(() => {
							tabsEl?.scrollTo({
								left: left - 60,
								behavior: "smooth",
							});
						});
					}, 200);
				}
			});
		},
		{
			immediate: true,
		}
	);

	if (el && el.parentElement) {
		narrow = el.parentElement.offsetWidth < 500;
		ro = new ResizeObserver((entries, observer) => {
			if (el.parentElement && document.body.contains(el)) {
				narrow = el.parentElement.offsetWidth < 500;
			}
		});
		ro.observe(el.parentElement);
	}
});

onUnmounted(() => {
	globalEvents.off("themeChanged", calcBg);
	if (ro) ro.disconnect();
});
</script>

<style lang="scss" scoped>
.fdidabkb {
	--height: 3.4375rem;
	display: flex;
	width: 100%;
	-webkit-backdrop-filter: var(--blur, blur(15px));
	backdrop-filter: var(--blur, blur(15px));
	border-bottom: solid 0.03125rem var(--divider);
	height: var(--height);

	&.thin {
		--height: 2.8125rem;

		> .buttons {
			> .button {
				font-size: 0.9em;
			}
		}
	}

	&.slim {
		> .titleContainer {
			flex: 1;
			margin: 0 auto;

			> *:first-child {
				margin-left: auto;
			}

			> *:last-child {
				margin-right: auto;
			}
		}
		> .tabs {
			padding-inline: 0.75rem;
			mask: linear-gradient(
				to right,
				transparent,
				black 0.625rem 80%,
				transparent
			);
			-webkit-mask: linear-gradient(
				to right,
				transparent,
				black 0.625rem 80%,
				transparent
			);
			margin-left: -0.625rem;
			padding-left: 1.375rem;
			scrollbar-width: none;
			&::before {
				content: unset;
			}
			&::-webkit-scrollbar {
				display: none;
			}
			&::after {
				// Force right padding
				content: "";
				display: inline-block;
				min-width: 20%;
			}
		}
	}

	> .buttons {
		--margin: 0.5rem;
		display: flex;
		align-items: center;
		height: var(--height);
		margin: 0 var(--margin);

		&.left {
			margin-right: auto;

			> .avatar {
				$size: 2rem;
				display: inline-block;
				width: $size;
				height: $size;
				vertical-align: bottom;
				margin: 0 0.5rem;
				pointer-events: none;
			}
		}

		&.right {
			margin-left: auto;
		}

		&:empty {
			display: none;
		}

		> .button/*, @at-root .backButton*/ {
			/* I don't know how to get this to work */
			display: flex;
			align-items: center;
			justify-content: center;
			height: calc(var(--height) - (var(--margin) * 2));
			width: calc(var(--height) - (var(--margin) * 2));
			box-sizing: border-box;
			position: relative;
			border-radius: 0.3125rem;

			&:hover {
				background: rgba(0, 0, 0, 0.05);
			}

			&.highlighted {
				color: var(--accent);
			}
		}

		> .fullButton {
			& + .fullButton {
				margin-left: 0.75rem;
			}
		}
	}

	> .backButton {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: 1rem;
	}

	> .titleContainer {
		display: flex;
		align-items: center;
		max-width: 25rem;
		overflow: auto;
		white-space: nowrap;
		text-align: left;
		font-weight: bold;
		flex-shrink: 0;
		margin-left: 1.5rem;
		margin-right: 1rem;

		> .avatar {
			$size: 2rem;
			display: inline-block;
			width: $size;
			height: $size;
			vertical-align: bottom;
			margin: 0 0.5rem;
			pointer-events: none;
		}

		> .icon {
			margin-right: 0.5rem;
			width: 1rem;
			text-align: center;
			transform: translate(0em);
		}

		> .title {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			line-height: 1.1;

			> .subtitle {
				opacity: 0.6;
				font-size: 0.8em;
				font-weight: normal;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;

				&.activeTab {
					text-align: center;

					> .chevron {
						display: inline-block;
						margin-left: 0.375rem;
					}
				}
			}
		}
	}

	> .tabs {
		position: relative;
		width: 100%;
		font-size: 1em;
		overflow-x: auto;
		white-space: nowrap;
		contain: strict;

		&::before {
			content: "";
			display: inline-block;
			height: 40%;
			border-left: 0.0625rem solid var(--divider);
			margin-right: 1em;
			margin-left: 0.625rem;
			vertical-align: -0.0625rem;
		}

		> .tab {
			display: inline-flex;
			align-items: center;
			position: relative;
			border-inline: 0.625rem solid transparent;
			height: 100%;
			font-weight: normal;
			opacity: 0.7;
			width: 2.375rem;
			--width: 2.375rem;
			overflow: hidden;
			transition: color 0.2s, opacity 0.2s, width 0.2s;

			&:hover {
				opacity: 1;
			}

			&.active {
				opacity: 1;
				color: var(--accent);
				font-weight: 600;
				width: var(--width);
			}
			&:not(.active) > .title {
				opacity: 0;
			}

			> .icon + .title {
				margin-left: 0.5rem;
			}
			> .title {
				transition: opacity 0.2s;
			}
		}

		> .highlight {
			position: absolute;
			bottom: 0;
			left: 0;
			height: 0.1875rem;
			background: var(--accent);
			border-radius: 999px;
			transition: width 0.2s, transform 0.2s;
			transition-timing-function: cubic-bezier(0, 0, 0, 1.2);
			pointer-events: none;
		}
	}
}
</style>
