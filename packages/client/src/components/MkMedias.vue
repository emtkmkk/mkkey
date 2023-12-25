<template>
	<template v-for="file in note.files.filter((file) => previewable(file))">
		<div 
			v-if="(defaultStore.state.enableDataSaverMode || (file.isSensitive && defaultStore.state.nsfw !== 'ignore')) && !showingFiles.includes(file.id) && (file.type.startsWith('video') || file.type.startsWith('image'))" 
			:class="$style.sensitive"
			@click="showingFiles.push(file.id)">
			<ImgWithBlurhash
				:class="$style.bg"
				:hash="file.blurhash"
				:title="file.name"
				:alt="file.comment || file.name"
				:force-blurhash="defaultStore.state.enableDataSaverMode"
			/>
			<div :class="$style.text">
				<div :class="$style.wrapper">
					<b v-if="file.isSensitive" style="display: block"
						><i class="ph-warning ph-bold ph-lg"></i>
						{{ i18n.ts.sensitive }}</b
					>
					<b v-if="(defaultStore.state.enableDataSaverMode && file.size) || !file.isSensitive" style="display: block"
						><i v-if="file.type.startsWith('image')" class="ph-image ph-bold ph-lg"></i><i v-if="file.type.startsWith('video')" class="ph-file-video ph-bold ph-lg"></i>
						{{ defaultStore.state.enableDataSaverMode && file.size ? bytes(file.size,2) : i18n.ts.image }}</b
					>
					<span style="display: block">{{ i18n.ts.clickToShow }}</span>
				</div>
			</div>
		</div>
		<MkA v-else :class="$style.img" :to="notePage(note)">
			<ImgWithBlurhash
				v-if="file.type.startsWith('video')"
				:hash="file.blurhash"
				:src="thumbnail(file)"
				:title="file.name"/>
			<ImgWithBlurhash
				v-if="file.type.startsWith('image')"
				:hash="file.blurhash"
				:src="thumbnail(file)"
				:title="file.name"/>
			<div v-else :class="$style.sensitive">
				<div v-if="file.isSensitive"><i class="ph-bold ph-file-audio"></i> {{ i18n.ts.sensitive }}</div>
				<div v-else><i class="ph-bold ph-file-audio"></i> {{ i18n.ts.audioFile }}</div>
			</div>
			<div v-if="file.type.startsWith('video')" :class="$style.gif">{{ i18n.ts.video }}</div>
			<div v-if="file.type === 'image/gif'" :class="$style.gif">GIF</div>
		</MkA>
	</template>
</template>

<script lang="ts" setup>

import { notePage } from "@/filters/note.js";
import { i18n } from "@/i18n.js";
import ImgWithBlurhash from "@/components/MkImgWithBlurhash.vue";
import * as Misskey from "misskey-js";
import { defaultStore } from "@/store.js";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import { FILE_TYPE_BROWSERSAFE } from "@/const";
import bytes from '@/filters/bytes';

let showingFiles = $ref<string[]>([]);

function thumbnail(file: Misskey.entities.DriveFile): string {
	return defaultStore.state.disableShowingAnimatedImages
		? getStaticImageUrl(file.url)
		: file.thumbnailUrl;
}

const props = defineProps<{
	note: Misskey.entities.Note;
}>();

const previewable = (file: Misskey.entities.DriveFile): boolean => {
	if (file.type === "image/svg+xml") return true; // svgのwebpublic/thumbnailはpngなのでtrue
	// FILE_TYPE_BROWSERSAFEに適合しないものはブラウザで表示するのに不適切
	return (
		(file.type.startsWith("video") || file.type.startsWith("image")) &&
		FILE_TYPE_BROWSERSAFE.includes(file.type)
	);
};
</script>

<style lang="scss" module>
.img {
	height: 220px;
	border-radius: 6px;
	overflow: clip;
	position: relative;
}

.empty {
	margin: 0;
	padding: 16px;
	text-align: center;
}

.sensitive {
	display: grid;
	place-items: center;
	height: 220px;
	position: relative;
	
	> .bg {
		filter: brightness(0.5);
	}

	> .text {
		position: absolute;
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

.gif {
	position: absolute;
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
</style>
