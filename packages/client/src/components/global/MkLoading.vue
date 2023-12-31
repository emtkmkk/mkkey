	<template>
		<div
			:class="[
				$style.root,
				{
					[$style.inline]: inline,
					[$style.colored]: colored,
					[$style.mini]: mini,
				},
			]"
		>
			<div :class="$style.container" aria-hidden="true">
				<svg
					v-if="!isLongTime"
					viewBox="0 0 50 50"
					xmlns="http://www.w3.org/2000/svg"
				>
   				<g transform="rotate(-90 25 25)">
						<circle
								:class="[$style.path]"
								cx="25"
								cy="25"
								r="20"
								fill="none"
								stroke-width="6px"
								style="fill: none; stroke: currentColor; stroke-width: 6px; stroke-dasharray: 125.664;"
								:style="{ strokeDashoffset: circleDashoffset }"
						></circle>
					</g>
				</svg>
				<img
					v-if="isLongTime"
					:class="[$style.spinner]"
					:src="$instance.iconUrl"
					alt="longlongloading"
				/>
			</div>
		</div>
	</template>

	<script lang="ts" setup>
	import { ref, onMounted, onBeforeUnmount, watch } from "vue";

	const props = withDefaults(
		defineProps<{
			inline?: boolean;
			colored?: boolean;
			mini?: boolean;
			em?: boolean;
		}>(),
		{
			inline: false,
			colored: true,
			mini: false,
			em: false,
		}
	);

	const progress = ref(0);
	const circleDashoffset = ref("0");
	const duration = 10000;
	const isLongTime = ref(false);
	let timerId: number | null = null;
	let finalProgress = 0;

	onMounted(() => {
		let startTime = Date.now();

		const updateProgress = () => {
			const elapsedTime = Date.now() - startTime;
			const tickmax = 1 / (duration / 375)
			const randomIncrement = (tickmax / 3) + Math.random() * (tickmax * 2 / 3);

			if (progress.value === 0) progress.value += 0.1;
			progress.value += randomIncrement;

			if (progress.value < 4) {
				timerId = setTimeout(updateProgress, 250);
			} else {
				isLongTime.value = true;
			}
		};

		// 進行状況の更新を開始
		updateProgress();
	});

	onBeforeUnmount(() => {
		clearTimeout(timerId); // タイマーの解除
	});

	watch(progress, (newVal) => {
		if (newVal % 2 >= 1){
      const dashoffset = -125.664 * (newVal % 1);
			circleDashoffset.value = `${dashoffset}`;
		} else {
			const dashoffset = 125.664 * (1 - (newVal % 1));
			circleDashoffset.value = `${dashoffset}`;
		}
	});
	</script>

	<style lang="scss" module>
	/* Credit to https://codepen.io/supah/pen/BjYLdW */

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes dash {
		0% {
			stroke-dasharray: 1, 150;
			stroke-dashoffset: 0;
		}
		50% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -35;
		}
		100% {
			stroke-dasharray: 90, 150;
			stroke-dashoffset: -124;
		}
	}

	.root {
		padding: 32px;
		text-align: center;
		cursor: wait;

		--size: 40px;

		&.colored {
			color: var(--accent);
		}

		&.inline {
			display: inline;
			padding: 0;
			--size: 32px;
		}

		&.mini {
			padding: 16px;
			--size: 32px;
		}
		&.em {
			display: inline-block;
			vertical-align: middle;
			padding: 0;
			--size: 1em;
		}
	}

	.container {
		position: relative;
		width: var(--size);
		height: var(--size);
		margin: 0 auto;
	}

	.spinner {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 999;
		width: var(--size);
		height: var(--size);
		animation: spin 2s linear infinite;
	}

	.path {
		stroke: var(--accent);
		stroke-linecap: round;
		//animation: dash 1.2s ease-in-out infinite;
	}
	</style>
