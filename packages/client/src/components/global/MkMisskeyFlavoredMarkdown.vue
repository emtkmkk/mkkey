<template>
	<MfmCore
		:text="text"
		:plain="plain"
		:nowrap="nowrap"
		:author="author"
		:custom-emojis="customEmojis"
		:is-note="isNote"
		:note-host="noteHost"
		class="havbbuyv"
		:class="{ nowrap }"
		:reaction-menu-enabled="reactionMenuEnabled"
		:note="note"
		:is-cw="isCw"
	/>
</template>

<script lang="ts" setup>
import {} from "vue";
import MfmCore from "@/components/mfm";

const props = withDefaults(
	defineProps<{
		text: string;
		plain?: boolean;
		nowrap?: boolean;
		author?: any;
		customEmojis?: any;
		isNote?: boolean;
		noteHost?: string;
		reactionMenuEnabled?: boolean;
		note?: any;
		isCw?: boolean;
	}>(),
	{
		plain: false,
		nowrap: false,
		author: null,
		isNote: true,
		noteHost: null,
		reactionMenuEnabled: false,
		note: null,
		isCw: false,
	}
);
</script>

<style lang="scss">
.mfm-x2 {
	--mfm-zoom-size: 200%;
}

.mfm-x3 {
	--mfm-zoom-size: 400%;
}

.mfm-x4 {
	--mfm-zoom-size: 600%;
}

.mfm-x2,
.mfm-x3,
.mfm-x4 {
	font-size: var(--mfm-zoom-size);

	.mfm-x2,
	.mfm-x3,
	.mfm-x4 {
		/* only half effective */
		font-size: calc(var(--mfm-zoom-size) / 2 + 50%);

		.mfm-x2,
		.mfm-x3,
		.mfm-x4 {
			/* disabled */
			font-size: 100%;
		}
	}
}

@keyframes mfm-spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

@keyframes mfm-spinX {
	0% {
		transform: perspective(8rem) rotateX(0deg);
	}
	100% {
		transform: perspective(8rem) rotateX(360deg);
	}
}

@keyframes mfm-spinY {
	0% {
		transform: perspective(8rem) rotateY(0deg);
	}
	100% {
		transform: perspective(8rem) rotateY(360deg);
	}
}

@keyframes mfm-jump {
	0% {
		transform: translateY(0);
	}
	25% {
		transform: translateY(-1rem);
	}
	50% {
		transform: translateY(0);
	}
	75% {
		transform: translateY(-0.5rem);
	}
	100% {
		transform: translateY(0);
	}
}

@keyframes mfm-bounce {
	0% {
		transform: translateY(0) scale(1, 1);
	}
	25% {
		transform: translateY(-1rem) scale(1, 1);
	}
	50% {
		transform: translateY(0) scale(1, 1);
	}
	75% {
		transform: translateY(0) scale(1.5, 0.75);
	}
	100% {
		transform: translateY(0) scale(1, 1);
	}
}

// const val = () => `translate(${Math.floor(Math.random() * 20) - 10}px, ${Math.floor(Math.random() * 20) - 10}px)`;
// let css = '';
// for (let i = 0; i <= 100; i += 5) { css += `${i}% { transform: ${val()} }\n`; }
@keyframes mfm-twitch {
	0% {
		transform: translate(0.4375rem, -0.125rem);
	}
	5% {
		transform: translate(-0.1875rem, 0.0625rem);
	}
	10% {
		transform: translate(-0.4375rem, -0.0625rem);
	}
	15% {
		transform: translate(0, -0.0625rem);
	}
	20% {
		transform: translate(-0.5rem, 0.375rem);
	}
	25% {
		transform: translate(-0.25rem, -0.1875rem);
	}
	30% {
		transform: translate(-0.25rem, -0.375rem);
	}
	35% {
		transform: translate(-0.5rem, -0.5rem);
	}
	40% {
		transform: translate(0.25rem, 0.375rem);
	}
	45% {
		transform: translate(-0.1875rem, 0.0625rem);
	}
	50% {
		transform: translate(0.125rem, -0.625rem);
	}
	55% {
		transform: translate(-0.4375rem, 0);
	}
	60% {
		transform: translate(-0.125rem, 0.25rem);
	}
	65% {
		transform: translate(0.1875rem, -0.5rem);
	}
	70% {
		transform: translate(0.375rem, 0.4375rem);
	}
	75% {
		transform: translate(-0.4375rem, -0.125rem);
	}
	80% {
		transform: translate(-0.4375rem, -0.5rem);
	}
	85% {
		transform: translate(0.5625rem, 0.1875rem);
	}
	90% {
		transform: translate(-0.1875rem, -0.125rem);
	}
	95% {
		transform: translate(-0.625rem, 0.125rem);
	}
	100% {
		transform: translate(-0.125rem, -0.375rem);
	}
}

// const val = () => `translate(${Math.floor(Math.random() * 6) - 3}px, ${Math.floor(Math.random() * 6) - 3}px) rotate(${Math.floor(Math.random() * 24) - 12}deg)`;
// let css = '';
// for (let i = 0; i <= 100; i += 5) { css += `${i}% { transform: ${val()} }\n`; }
@keyframes mfm-shake {
	0% {
		transform: translate(-0.1875rem, -0.0625rem) rotate(-8deg);
	}
	5% {
		transform: translate(0, -0.0625rem) rotate(-10deg);
	}
	10% {
		transform: translate(0.0625rem, -0.1875rem) rotate(0deg);
	}
	15% {
		transform: translate(0.0625rem, 0.0625rem) rotate(11deg);
	}
	20% {
		transform: translate(-0.125rem, 0.0625rem) rotate(1deg);
	}
	25% {
		transform: translate(-0.0625rem, -0.125rem) rotate(-2deg);
	}
	30% {
		transform: translate(-0.0625rem, 0.125rem) rotate(-3deg);
	}
	35% {
		transform: translate(0.125rem, 0.0625rem) rotate(6deg);
	}
	40% {
		transform: translate(-0.125rem, -0.1875rem) rotate(-9deg);
	}
	45% {
		transform: translate(0, -0.0625rem) rotate(-12deg);
	}
	50% {
		transform: translate(0.0625rem, 0.125rem) rotate(10deg);
	}
	55% {
		transform: translate(0, -0.1875rem) rotate(8deg);
	}
	60% {
		transform: translate(0.0625rem, -0.0625rem) rotate(8deg);
	}
	65% {
		transform: translate(0, -0.0625rem) rotate(-7deg);
	}
	70% {
		transform: translate(-0.0625rem, -0.1875rem) rotate(6deg);
	}
	75% {
		transform: translate(0, -0.125rem) rotate(4deg);
	}
	80% {
		transform: translate(-0.125rem, -0.0625rem) rotate(3deg);
	}
	85% {
		transform: translate(0.0625rem, -0.1875rem) rotate(-10deg);
	}
	90% {
		transform: translate(0.0625rem, 0) rotate(3deg);
	}
	95% {
		transform: translate(-0.125rem, 0) rotate(-3deg);
	}
	100% {
		transform: translate(0.125rem, 0.0625rem) rotate(2deg);
	}
}

@keyframes mfm-rubberBand {
	from {
		transform: scale3d(1, 1, 1);
	}
	30% {
		transform: scale3d(1.25, 0.75, 1);
	}
	40% {
		transform: scale3d(0.75, 1.25, 1);
	}
	50% {
		transform: scale3d(1.15, 0.85, 1);
	}
	65% {
		transform: scale3d(0.95, 1.05, 1);
	}
	75% {
		transform: scale3d(1.05, 0.95, 1);
	}
	to {
		transform: scale3d(1, 1, 1);
	}
}

@keyframes mfm-rainbow {
	0% {
		filter: hue-rotate(0deg) contrast(150%) saturate(150%);
	}
	100% {
		filter: hue-rotate(360deg) contrast(150%) saturate(150%);
	}
}

@keyframes mfm-fade {
	0% {
		opacity: 0;
	}
	100% {
		opacity: 1;
	}
}
</style>

<style lang="scss" scoped>
.havbbuyv {
	white-space: pre-wrap;

	&.nowrap {
		white-space: pre;
		word-wrap: normal; // https://codeday.me/jp/qa/20190424/690106.html
		overflow: hidden;
		text-overflow: ellipsis;
	}

	::v-deep(blockquote) {
		display: block;
		margin: 0.5rem 0;
		padding-left: 0.75rem;
		color: var(--fgTransparentWeak);
		border-left: solid 0.25rem var(--fgTransparent);
	}

	::v-deep(pre) {
		font-size: 0.8em;
	}

	> ::v-deep(code) {
		font-size: 0.8em;
		word-break: break-all;
		padding: 0.25rem 0.375rem;
	}
}
</style>
