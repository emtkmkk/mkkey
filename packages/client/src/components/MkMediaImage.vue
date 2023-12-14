<template>
	<button v-if="hide" class="qjewsnkg" @click="hide = false">
		<ImgWithBlurhash
			class="bg"
			:hash="image.blurhash"
			:title="image.name"
			:alt="image.comment || image.name"
			:force-blurhash="defaultStore.state.enableDataSaverMode"
		/>
		<div class="text">
			<div class="wrapper">
				<b v-if="image.isSensitive" style="display: block"
					><i class="ph-warning ph-bold ph-lg"></i>
					{{ i18n.ts.sensitive }}</b
				>
				<b v-if="(defaultStore.state.enableDataSaverMode && image.size) || !image.isSensitive" style="display: block"
					><i class="ph-image ph-bold ph-lg"></i>
					{{ defaultStore.state.enableDataSaverMode && image.size ? bytes(image.size,2) : i18n.ts.image }}</b
				>
				<span style="display: block">{{ i18n.ts.clickToShow }}</span>
			</div>
		</div>
	</button>
	<div v-else class="gqnyydlz">
		<a class="imageView" :class="{imageContain: !defaultStore.state.thumbnailCover, imageCover: defaultStore.state.thumbnailCover}" :href="image.url" :title="image.name">
			<ImgWithBlurhash
				:hash="image.blurhash"
				:src="url"
				:alt="image.comment || image.name"
				:type="image.type"
				:title="image.name"
				:cover="defaultStore.state.thumbnailCover"
			/>
			<div v-if="image.type === 'image/gif' && !$store.state.compactGrid" class="gif">GIF</div>
		</a>
		<button
			v-if="!$store.state.compactGrid"
			v-tooltip="i18n.ts.hide"
			class="_button hide"
			@click="hide = true"
		>
			<i class="ph-eye-slash ph-bold ph-lg"></i>
		</button>
	</div>
</template>

<script lang="ts" setup>
import { watch } from "vue";
import type * as misskey from "calckey-js";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import ImgWithBlurhash from "@/components/MkImgWithBlurhash.vue";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import bytes from '@/filters/bytes';

const props = defineProps<{
	image: misskey.entities.DriveFile;
	raw?: boolean;
}>();

let hide = $ref(true);

const url =
	props.raw || defaultStore.state.loadRawImages
		? props.image.url
		: defaultStore.state.disableShowingAnimatedImages
		? getStaticImageUrl(props.image.thumbnailUrl)
		: props.image.thumbnailUrl;

// Plugin:register_note_view_interruptor を使って書き換えられる可能性があるためwatchする
watch(
	() => props.image,
	() => {
		hide =
			defaultStore.state.nsfw === "force" || defaultStore.state.enableDataSaverMode
				? true
				: props.image.isSensitive &&
				  defaultStore.state.nsfw !== "ignore";
	},
	{
		deep: true,
		immediate: true,
	}
);
</script>

<style lang="scss" scoped>
.qjewsnkg {
	all: unset;
	position: relative;

	> .bg {
		filter: brightness(0.5);
	}

	> .text {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		display: flex;
		justify-content: center;
		align-items: center;

		> .wrapper {
			display: table-cell;
			text-align: center;
			font-size: 0.8em;
			color: #fff;
		}
	}

	&:focus-visible {
		border: 2px solid var(--accent);
	}
}

.gqnyydlz {
	position: relative;
	//box-shadow: 0 0 0 1px var(--divider) inset;
	background: var(--bg);

	> .hide {
		display: block;
		position: absolute;
		border-radius: 6px;
		background-color: var(--accentedBg);
		-webkit-backdrop-filter: var(--blur, blur(15px));
		backdrop-filter: var(--blur, blur(15px));
		color: var(--accent);
		font-size: 0.8em;
		padding: 12px 14px;
		text-align: center;
		top: 0px;
		right: 0px;

		> i {
			display: block;
		}
	}

	> .imageView {
		display: block;
		cursor: zoom-in;
		overflow: hidden;
		width: 100%;
		height: 100%;
		background-position: center;
		background-repeat: no-repeat;
		box-sizing: border-box;
		&:focus-visible {
			border: 2px solid var(--accent);
		}

		> .gif {
			background-color: var(--fg);
			border-radius: 6px;
			color: var(--accentLighten);
			display: inline-block;
			font-size: 14px;
			font-weight: bold;
			left: 12px;
			opacity: 0.5;
			padding: 0 6px;
			text-align: center;
			top: 12px;
			pointer-events: none;
		}
	}
	> .imageContain {
		background-size: contain;
	}
	> .imageCover {
		background-size: cover;
	}
}
</style>
