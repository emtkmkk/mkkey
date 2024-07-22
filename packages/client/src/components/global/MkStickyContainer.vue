<template>
	<div ref="rootEl">
		<div ref="headerEl">
			<slot name="header"></slot>
		</div>
		<div ref="bodyEl" :data-sticky-container-header-height="headerHeight" :data-sticky-container-footer-height="footerHeight">
			<slot></slot>
		</div>
		<div ref="footerEl">
			<slot name="footer"></slot>
		</div>
	</div>
</template>

<script lang="ts">
// なんか動かない
//const CURRENT_STICKY_TOP = Symbol("CURRENT_STICKY_TOP");
const CURRENT_STICKY_TOP = "CURRENT_STICKY_TOP";
</script>

<script lang="ts" setup>
import {
	onMounted,
	onUnmounted,
	provide,
	inject,
	Ref,
	ref,
	watch,
	shallowRef,
} from "vue";

const rootEl = shallowRef<HTMLElement>();
const headerEl = shallowRef<HTMLElement>();
const bodyEl = shallowRef<HTMLElement>();
const footerEl = shallowRef<HTMLElement>();

const headerHeight = ref<string | undefined>();
const childStickyTop = ref(0);
const parentStickyTop = inject<Ref<number>>(CURRENT_STICKY_TOP, ref(0));
provide(CURRENT_STICKY_TOP, childStickyTop);

const footerHeight = ref<string | undefined>();
const childStickyBottom = ref(0);
const parentStickyBottom = inject<Ref<number>>("CURRENT_STICKY_BOTTOM", ref(0));
provide("CURRENT_STICKY_BOTTOM", childStickyBottom);

const calc = () => {
	// コンポーネントが表示されてないけどKeepAliveで残ってる場合などは null になる
	if (headerEl.value != null) {
		childStickyTop.value =
			parentStickyTop.value + headerEl.value.offsetHeight;
		headerHeight.value = headerEl.value.offsetHeight.toString();
	}

	// コンポーネントが表示されてないけどKeepAliveで残ってる場合などは null になる
	if (footerEl.value != null) {
		childStickyBottom.value =
			parentStickyBottom.value + footerEl.value.offsetHeight;
		footerHeight.value = footerEl.value.offsetHeight.toString();
	}
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
		childStickyTop,
		() => {
			if (bodyEl.value) {
				bodyEl.value.style.setProperty(
					"--stickyTop",
					`${childStickyTop.value}px`
				);
			}
		},
		{
			immediate: true,
		}
	);

	watch(
		childStickyBottom,
		() => {
			if (bodyEl.value) {
				bodyEl.value.style.setProperty(
					"--stickyBottom",
					`${childStickyBottom.value}px`
				);
			}
		},
		{
			immediate: true,
		}
	);

    if (headerEl.value) {
        headerEl.value.style.position = "-webkit-sticky";
        headerEl.value.style.position = "sticky";
        headerEl.value.style.top = "var(--stickyTop, 0px)";
        headerEl.value.style.zIndex = "1000";
				observer.observe(headerEl.value);
    }

    if (footerEl.value) {
        footerEl.value.style.position = "-webkit-sticky";
        footerEl.value.style.position = "sticky";
        footerEl.value.style.bottom = "var(--stickyBottom, 0px)";
        footerEl.value.style.zIndex = "1000";
				observer.observe(footerEl.value);
    }

});

onUnmounted(() => {
	observer.disconnect();
});

defineExpose({
	rootEl: rootEl,
});
</script>

<style lang="scss" module></style>
