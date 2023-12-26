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
			v-if="src && !forceBlurhash"
			:src="src"
			:title="title"
			:type="type"
			:alt="alt"
			@load="onLoad"
		/>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { decode } from "blurhash";

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

function onLoad() {
	loaded = true;
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
