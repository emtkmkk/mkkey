<template>
	<div ref="rootEl">
		<div ref="headerEl">
			<slot name="header"></slot>
		</div>
		<div ref="bodyEl" :data-sticky-container-header-height="headerHeight">
			<slot></slot>
		</div>
		<div ref="footerEl">
			<slot name="footer"></slot>
		</div>
	</div>
</template>

<script lang="ts">
// なんか動かない
//const CURRENT_STICKY_TOP = Symbol('CURRENT_STICKY_TOP');
const CURRENT_STICKY_TOP = "CURRENT_STICKY_TOP";
</script>

<script lang="ts" setup>
import { onMounted, onUnmounted, provide, inject, Ref, ref, watch, shallowRef } from "vue";

const rootEl = $shallowRef<HTMLElement>();
const headerEl = $shallowRef<HTMLElement>();
const bodyEl = $shallowRef<HTMLElement>();
const footerEl = $shallowRef<HTMLElement>();

let headerHeight = $ref<string | undefined>();
let childStickyTop = $ref(0);
const parentStickyTop = inject<Ref<number>>(CURRENT_STICKY_TOP, ref(0));
provide(CURRENT_STICKY_TOP, $$(childStickyTop));

let footerHeight = $ref<string | undefined>();
let childStickyBottom = $ref(0);
const parentStickyBottom = inject<Ref<number>>("CURRENT_STICKY_BOTTOM", ref(0));
provide("CURRENT_STICKY_BOTTOM", $$(childStickyBottom));


const calc = () => {
	childStickyTop = parentStickyTop.value + headerEl.offsetHeight;
	headerHeight = headerEl.offsetHeight.toString();
	childStickyBottom = parentStickyBottom.value + footerEl.offsetHeight;
	footerHeight = footerEl.offsetHeight.toString();
};

const observer = new ResizeObserver(() => {
	window.setTimeout(() => {
		calc();
	}, 100);
});

onMounted(() => {
	calc();

	watch([parentStickyTop, parentStickyBottom], calc);

	watch(
		$$(childStickyTop),
		() => {
			bodyEl.style.setProperty("--stickyTop", `${childStickyTop}px`);
		},
		{
			immediate: true,
		}
	);
	watch(
		$$(childStickyBottom),
		() => {
			bodyEl.style.setProperty('--stickyBottom', `${childStickyBottom}px`);
		},
		{
			immediate: true,
		}
	);


	headerEl.style.position = "sticky";
	headerEl.style.top = "var(--stickyTop, 0)";
	headerEl.style.zIndex = "1000";
	
	footerEl.style.position = 'sticky';
	footerEl.style.bottom = 'var(--stickyBottom, 0)';
	footerEl.style.zIndex = '1000';
	
	observer.observe(headerEl);
	observer.observe(footerEl);
});

onUnmounted(() => {
	observer.disconnect();
});
</script>

<style lang="scss" module></style>
