<template>
	<div class="xubzgfgb" :class="{ cover }" :title="title">
		<canvas
			v-if="!loaded || forceBlurhash"
			ref="canvas"
			:width="size"
			:height="size"
			:title="title"
		/>
		<img
			v-if="currentSrc && !forceBlurhash"
			:src="currentSrc"
			:title="title"
			:type="type"
			:alt="alt"
			@load="onLoad"
			@error="onError"
		/>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * blurhash のぼかし画像を下地に、本画像を読み込んで表示するコンポーネント
 *
 * @remarks
 * 本画像の読み込みが終わるまでは blurhash を canvas に描いておく。
 * 本画像が外部メディアプロキシ経由で、読み込みに失敗したりエラー画像が返ってきたりしたときは、
 * {@link getMediaFallbackUrls} の順に別の URL で読み直す。
 *
 * @internal
 */
import { onMounted, watch } from "vue";
import { decode } from "blurhash";
import {
	getMediaFallbackUrls,
	isProxyErrorImage,
} from "@/scripts/media-proxy-fallback";

const props = withDefaults(
	defineProps<{
		src?: string | null;
		hash?: string;
		alt?: string | null;
		type?: string | null;
		title?: string | null;
		size?: number;
		cover?: boolean;
		forceBlurhash?: boolean;
	}>(),
	{
		src: null,
		type: null,
		alt: "",
		title: null,
		size: 64,
		cover: true,
		forceBlurhash: false,
	}
);

const canvas = $ref<HTMLCanvasElement>();
let loaded = $ref(false);

/**
 * 試す URL の一覧（先頭が元の `src`、以降は失敗時の代わり）
 *
 * @internal
 */
const candidates = $computed(() =>
	props.src ? [props.src, ...getMediaFallbackUrls(props.src)] : [],
);

/**
 * いま表示している URL が {@link candidates} の何番目か
 *
 * @internal
 */
let attempt = $ref(0);

/**
 * いま表示している URL
 *
 * @internal
 */
const currentSrc = $computed(() => candidates[attempt] ?? props.src);

// 表示する画像そのものが変わったら、最初の URL から試し直す
watch(
	() => props.src,
	() => {
		attempt = 0;
	},
);

/**
 * 次の URL へ切り替える
 *
 * @remarks
 * 最後の URL まで失敗したときは切り替えず、そのまま表示しておく。
 *
 * @returns 切り替えたら `true`
 * @internal
 */
function tryNext(): boolean {
	if (attempt >= candidates.length - 1) return false;
	attempt++;
	return true;
}

function draw() {
	if (canvas == null) return;
	const ctx = canvas.getContext("2d");
	if (ctx == null) return;

	if (props.hash == null) {
		const blackImageData = ctx.createImageData(props.size, props.size);
		for (let i = 0; i < blackImageData.data.length; i += 4) {
			blackImageData.data[i] = 0;
			blackImageData.data[i + 1] = 0;
			blackImageData.data[i + 2] = 0;
			blackImageData.data[i + 3] = 255;
		}
		ctx.putImageData(blackImageData, 0, 0);
		return;
	}

	const pixels = decode(props.hash, props.size, props.size);
	const imageData = ctx.createImageData(props.size, props.size);
	imageData.data.set(pixels);
	ctx.putImageData(imageData, 0, 0);
}

/**
 * 本画像の読み込みが終わったとき
 *
 * @remarks
 * 外部プロキシがエラー画像を返していたら、成功扱いにせず次の URL へ切り替える。
 *
 * @param ev - load イベント
 * @internal
 */
async function onLoad(ev: Event) {
	const img = ev.target as HTMLImageElement;
	const src = currentSrc;
	if (await isProxyErrorImage(img)) {
		// 判定の間に別の画像へ変わっていたら何もしない
		if (src === currentSrc && tryNext()) return;
	}
	loaded = true;
}

/**
 * 本画像の読み込みに失敗したとき
 *
 * @internal
 */
function onError() {
	tryNext();
}

onMounted(() => {
	draw();
});
</script>

<style lang="scss" scoped>
.xubzgfgb {
	position: relative;
	width: 100%;
	height: 100%;

	> canvas,
	> img {
		display: block;
		width: 100%;
		height: 100%;
	}

	> canvas {
		position: absolute;
		object-fit: cover;
	}

	> img {
		object-fit: contain;
	}

	&.cover {
		> img {
			object-fit: cover;
		}
	}
}
</style>
