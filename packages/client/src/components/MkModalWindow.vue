<template>
	<MkModal
		ref="modal"
		:prefer-type="'dialog'"
		@click="onBgClick"
		@keyup.esc="$emit('close')"
		@closed="$emit('closed')"
	>
		<FocusTrap v-model:active="isActive">
			<div
				ref="rootEl"
				class="ebkgoccj"
				:style="{
					width: `${width}px`,
					height: scroll
						? height
							? `${height}px`
							: null
						: height
						? `min(${height}px, 100%)`
						: '100%',
				}"
				@keydown="onKeydown"
				tabindex="-1"
			>
				<div ref="headerEl" class="header">
					<button
						v-if="withOkButton"
						class="_button"
						@click="$emit('close')"
					>
						<i class="ph-x ph-bold ph-lg"></i>
					</button>
					<span class="title">
						<slot name="header"></slot>
					</span>
					<button
						v-if="!withOkButton"
						class="_button"
						@click="$emit('close')"
					>
						<i class="ph-x ph-bold ph-lg"></i>
					</button>
					<button
						v-if="withOkButton"
						class="_button"
						:disabled="okButtonDisabled"
						@click="$emit('ok')"
					>
						<i class="ph-check ph-bold ph-lg"></i>
					</button>
				</div>
				<div class="body">
					<slot :width="bodyWidth" :height="bodyHeight"></slot>
				</div>
			</div>
		</FocusTrap>
	</MkModal>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import { FocusTrap } from "focus-trap-vue";
import MkModal from "./MkModal.vue";

const props = withDefaults(
	defineProps<{
		withOkButton: boolean;
		okButtonDisabled: boolean;
		width: number;
		height: number | null;
		scroll: boolean;
	}>(),
	{
		withOkButton: false,
		okButtonDisabled: false,
		width: 400,
		height: null,
		scroll: true,
	}
);

const emit = defineEmits<{
	(event: "click"): void;
	(event: "close"): void;
	(event: "closed"): void;
	(event: "ok"): void;
}>();

let modal = shallowRef<InstanceType<typeof MkModal>>();
let rootEl = shallowRef<HTMLElement>();
let headerEl = shallowRef<HTMLElement>();
let bodyWidth = ref(0);
let bodyHeight = ref(0);

const close = () => {
	modal.value?.close();
};

const onBgClick = () => {
	emit("click");
};

const onKeydown = (evt: KeyboardEvent) => {
	if (evt.key === 'Escape') {
		evt.preventDefault();
		evt.stopPropagation();
		close();
	}
};

const updateBodyDimensions = () => {
	if (rootEl.value && headerEl.value) {
		bodyWidth.value = rootEl.value.offsetWidth;
		bodyHeight.value = rootEl.value.offsetHeight - headerEl.value.offsetHeight;
	}
};

const ro = new ResizeObserver(() => {
	updateBodyDimensions();
});

onMounted(() => {
	updateBodyDimensions();
	ro.observe(rootEl.value!);
});

onUnmounted(() => {
	ro.disconnect();
});

defineExpose({
	close,
});
</script>

<style lang="scss" scoped>
.ebkgoccj {
	margin: auto;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	contain: content;
	container-type: inline-size;
	border-radius: var(--radius);

	--root-margin: 1.5rem;

	@media (max-width: 31.25rem) {
		--root-margin: 1rem;
	}

	> .header {
		$height: 2.875rem;
		$height-narrow: 2.625rem;
		display: flex;
		flex-shrink: 0;
		background: var(--windowHeader);
		-webkit-backdrop-filter: var(--blur, blur(15px));
		backdrop-filter: var(--blur, blur(15px));

		> button {
			height: $height;
			width: $height;

			@media (max-width: 31.25rem) {
				height: $height-narrow;
				width: $height-narrow;
			}
		}

		> .title {
			flex: 1;
			line-height: $height;
			padding-left: 2rem;
			font-weight: bold;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			pointer-events: none;

			@media (max-width: 31.25rem) {
				line-height: $height-narrow;
				padding-left: 1rem;
			}
		}

		> button + .title {
			padding-left: 0;
		}
	}

	> .body {
		flex: 1;
		overflow: auto;
		background: var(--panel);
	}
}
</style>
