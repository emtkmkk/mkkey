<template>
	<div
		v-if="hide"
		class="icozogqfvdetwohsdglrbswgrejoxbdj"
		@click="show"
	>
		<ImgWithBlurhash
			class="bg"
			:hash="video.blurhash"
			:title="video.name"
			:alt="video.comment || video.name"
			:force-blurhash="defaultStore.state.enableDataSaverMode"
		/>
		<div class="text">
			<div class="wrapper">
				<b v-if="video.isSensitive" style="display: block"
					><i class="ph-warning ph-bold ph-lg"></i>
					{{ i18n.ts.sensitive }}</b
				>
				<b
					v-if="
						(defaultStore.state.enableDataSaverMode &&
							video.size) ||
						!video.isSensitive
					"
					style="display: block"
					><i class="ph-file-video ph-bold ph-lg"></i>
					{{
						defaultStore.state.enableDataSaverMode && video.size
							? bytes(video.size, 2)
							: i18n.ts.video
					}}</b
				>
				<span style="display: block">{{ i18n.ts.clickToShow }}</span>
			</div>
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
				ref="videoEl"
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
/**
 * @packageDocumentation
 *
 * 投稿に添付された動画を表示するコンポーネント（Plyr のプレーヤー）。
 *
 * @remarks
 * - センシティブ・データセーバー時は、押すまで動画を隠す。
 * - 全画面にしたとき、動画の縦横に合わせて画面の向きを固定する（`scripts/video-fullscreen-orientation.ts`）。
 *   横長の動画なら、端末の自動回転がオフでも横向きで見られる（Android の Chrome など、対応ブラウザのみ）。
 *
 * @internal
 */
import { ref, computed, onBeforeUnmount } from "vue";
import VuePlyr from "vue-plyr";
import type * as misskey from "calckey-js";
import * as os from "@/os";
import ImgWithBlurhash from "@/components/MkImgWithBlurhash.vue";
import { defaultStore } from "@/store";
import "vue-plyr/dist/vue-plyr.css";
import { i18n } from "@/i18n";
import bytes from "@/filters/bytes";
import { isMobileData } from "@/scripts/datasaver";
import { watchVideoFullscreenOrientation } from "@/scripts/video-fullscreen-orientation";

const props = defineProps<{
	video: misskey.entities.DriveFile;
}>();

/** 動画要素（隠している間は null） */
const videoEl = ref<HTMLVideoElement | null>(null);

// 全画面にしたら動画の縦横に合わせて向きを固定する。動画の情報が未読込ならドライブの縦横を使う
const stopOrientationWatch = watchVideoFullscreenOrientation(
	() => videoEl.value,
	props.video.properties
);
onBeforeUnmount(stopOrientationWatch);

const videoType = computed(() => {
	return props.video.type === "video/quicktime"
		? "video/mp4"
		: props.video.type;
});

const hide = ref(
	defaultStore.state.nsfw === "force" ||
		defaultStore.state.enableDataSaverMode
		? true
		: props.video.isSensitive && defaultStore.state.nsfw !== "ignore"
);

async function show() {
	if (props.video.isSensitive && defaultStore.state.openPopupNsfwToCarrior && isMobileData()) {
		const ret = await os.yesno({type: "warning", text: i18n.ts.showSensitiveConfirm})
		if (ret.canceled) {
			return;
		}
		hide.value = false;
	} else {
		hide.value = false;
	}
}
</script>

<style lang="scss" scoped>
.kkjnbbplepmiyuadieoenjgutgcmtsvu {
	position: relative;
	--plyr-color-main: var(--accent);

	> i {
		display: block;
		position: absolute;
		border-radius: 0.375rem;
		background: var(--fg);
		color: var(--accentLighten);
		font-size: 0.875rem;
		opacity: 0.5;
		padding: 0.5625rem 0.9375rem;
		text-align: center;
		cursor: pointer;
		top: 0;
		right: 0;
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
}
</style>
