<template>
	<div v-size="{ max: [500] }" class="ssazuxis">
		<header
			class="_button"
			:style="{ background: bg }"
			@click="showBody = !showBody"
		>
			<div class="title"><slot name="header"></slot></div>
			<div class="divider"></div>
			<button class="_button">
				<template v-if="showBody"
					><i class="ph-caret-up ph-bold ph-lg"></i
				></template>
				<template v-else
					><i class="ph-caret-down ph-bold ph-lg"></i
				></template>
			</button>
		</header>
		<transition
			:name="$store.state.animation ? 'folder-toggle' : ''"
			@enter="enter"
			@after-enter="afterEnter"
			@leave="leave"
			@after-leave="afterLeave"
		>
			<div v-show="showBody">
				<slot></slot>
			</div>
		</transition>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import tinycolor from "tinycolor2";

const localStoragePrefix = "ui:folder:";

export default defineComponent({
	props: {
		expanded: {
			type: Boolean,
			required: false,
			default: true,
		},
		persistKey: {
			type: String,
			required: false,
			default: null,
		},
	},
	data() {
		return {
			bg: null,
			showBody:
				this.persistKey &&
				localStorage.getItem(localStoragePrefix + this.persistKey)
					? localStorage.getItem(
							localStoragePrefix + this.persistKey
					  ) === "t"
					: this.expanded,
		};
	},
	watch: {
		showBody() {
			if (this.persistKey) {
				localStorage.setItem(
					localStoragePrefix + this.persistKey,
					this.showBody ? "t" : "f"
				);
			}
		},
	},
	mounted() {
		function getParentBg(el: Element | null): string {
			if (el == null || el.tagName === "BODY") return "var(--bg)";
			const bg = el.style.background || el.style.backgroundColor;
			if (bg) {
				return bg;
			} else {
				return getParentBg(el.parentElement);
			}
		}
		const rawBg = getParentBg(this.$el);
		const bg = tinycolor(
			rawBg.startsWith("var(")
				? getComputedStyle(document.documentElement).getPropertyValue(
						rawBg.slice(4, -1)
				  )
				: rawBg
		);
		bg.setAlpha(0.85);
		this.bg = bg.toRgbString();
	},
	methods: {
		toggleContent(show: boolean) {
			this.showBody = show;
		},

		enter(el) {
			const elementHeight = el.getBoundingClientRect().height;
			el.style.height = 0;
			el.offsetHeight; // reflow
			el.style.height = `${elementHeight}px`;
		},
		afterEnter(el) {
			el.style.height = null;
		},
		leave(el) {
			const elementHeight = el.getBoundingClientRect().height;
			el.style.height = `${elementHeight}px`;
			el.offsetHeight; // reflow
			el.style.height = 0;
		},
		afterLeave(el) {
			el.style.height = null;
		},
	},
});
</script>

<style lang="scss" scoped>
.folder-toggle-enter-active,
.folder-toggle-leave-active {
	overflow-y: hidden;
	transition: opacity 0.5s, height 0.5s !important;
}
.folder-toggle-enter-from {
	opacity: 0;
}
.folder-toggle-leave-to {
	opacity: 0;
}

.ssazuxis {
	position: relative;

	> header {
		display: flex;
		position: relative;
		z-index: 10;
		position: sticky;
		top: var(--stickyTop, 0);
		padding: var(--x-padding);
		-webkit-backdrop-filter: var(--blur, blur(8px));
		backdrop-filter: var(--blur, blur(20px));
		margin-inline: -0.75rem;
		padding-inline: 0.75rem;
		mask: linear-gradient(
			to right,
			transparent,
			black 0.75rem calc(100% - 0.75rem),
			transparent
		);
		-webkit-mask: linear-gradient(
			to right,
			transparent,
			black 0.75rem calc(100% - 0.75rem),
			transparent
		);

		> .title {
			margin: 0;
			padding: 0.75rem 1rem 0.75rem 0;

			> i {
				margin-right: 0.375rem;
			}

			&:empty {
				display: none;
			}
		}

		> .divider {
			flex: 1;
			margin: auto;
			height: 0.0625rem;
			background: var(--divider);
		}

		> button {
			padding: 0.75rem 0 0.75rem 1rem;
		}
	}

	&.max-width_500px {
		> header {
			> .title {
				padding: 0.5rem 0.625rem 0.5rem 0;
			}
		}
	}
}
</style>
