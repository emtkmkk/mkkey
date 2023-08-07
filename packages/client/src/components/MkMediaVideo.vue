<template>
	<div
		v-if="hide"
		class="icozogqfvdetwohsdglrbswgrejoxbdj"
		@click="hide = false"
	>
		<div>
			<b v-if="video.isSensitive" style="display: block"
				><i class="ph-warning ph-bold ph-lg"></i>
				{{ i18n.ts.sensitive }}</b
			>
			<b v-if="(defaultStore.state.enableDataSaverMode && video.size) || !video.isSensitive" style="display: block"
				><i class="ph-file-video ph-bold ph-lg"></i>
				{{ defaultStore.state.enableDataSaverMode && video.size ? bytes(video.size,2) : i18n.ts.video }}</b
			>
			<span>{{ i18n.ts.clickToShow }}</span>
		</div>
	</div>
	<div v-else class="kkjnbbplepmiyuadieoenjgutgcmtsvu">
		<VuePlyr
			:options="{
				controls: [
					'play-large',
					'play',
					'progress',
					'current-time',
					'mute',
					'volume',
					'pip',
					'download',
					'fullscreen',
				],
				disableContextMenu: false,
			}"
		>
			<video
				:poster="video.thumbnailUrl"
				:title="video.comment"
				:aria-label="video.comment"
				preload="none"
				controls
				@contextmenu.stop
			>
				<source :src="video.url" :type="videoType" />
			</video>
		</VuePlyr>
		<i class="ph-eye-slash ph-bold ph-lg" @click="hide = true"></i>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import VuePlyr from "vue-plyr";
import type * as misskey from "calckey-js";
import { defaultStore } from "@/store";
import "vue-plyr/dist/vue-plyr.css";
import { i18n } from "@/i18n";
import bytes from '@/filters/bytes';

const props = defineProps<{
	video: misskey.entities.DriveFile;
}>();

const videoType = computed(() => {
	return props.video.type === 'video/quicktime' ? 'video/mp4' : props.video.type;
});

const hide = ref(
	defaultStore.state.nsfw === "force" || defaultStore.state.enableDataSaverMode
		? true
		: props.video.isSensitive && defaultStore.state.nsfw !== "ignore"
);
</script>

<style lang="scss" scoped>
.kkjnbbplepmiyuadieoenjgutgcmtsvu {
	position: relative;
	--plyr-color-main: var(--accent);

	> i {
		display: block;
		position: absolute;
		border-radius: 6px;
		background-color: var(--fg);
		color: var(--accentLighten);
		font-size: 14px;
		opacity: 0.5;
		padding: 9px 15px;
		text-align: center;
		cursor: pointer;
		top: 0px;
		right: 0px;
	}

	> video {
		display: flex;
		justify-content: center;
		align-items: center;

		font-size: 3.5em;
		overflow: hidden;
		background-position: center;
		background-size: cover;
		width: 100%;
		height: 100%;
	}
}

.icozogqfvdetwohsdglrbswgrejoxbdj {
	display: flex;
	justify-content: center;
	align-items: center;
	background: #111;
	color: #fff;

	> div {
		display: table-cell;
		text-align: center;
		font-size: 12px;

		> b {
			display: block;
		}
	}
}
</style>
