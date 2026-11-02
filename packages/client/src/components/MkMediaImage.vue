<template>
	<button v-if="hide" class="qjewsnkg" @click.stop="show">
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
				<b
					v-if="
						(defaultStore.state.enableDataSaverMode &&
							image.size) ||
						!image.isSensitive
					"
					style="display: block"
					><i class="ph-image ph-bold ph-lg"></i>
					{{
						defaultStore.state.enableDataSaverMode && image.size
							? bytes(image.size, 2)
							: i18n.ts.image
					}}</b
				>
				<span style="display: block">{{ i18n.ts.clickToShow }}</span>
			</div>
		</div>
	</button>
	<div v-else class="gqnyydlz">
                <a
                        class="imageView"
                        :class="{
                                imageContain: !defaultStore.state.thumbnailCover,
                                imageCover: defaultStore.state.thumbnailCover,
                        }"
                        :href="href"
                        :title="image.name"
                        :target="defaultStore.state.imageNewTab ? '_blank' : undefined"
                        @click="onAnchorClick"
                >
                        <ImgWithBlurhash
                                :hash="image.blurhash"
                                :src="url"
                                :alt="image.comment || image.name"
				:type="image.type"
				:title="image.name"
				:cover="defaultStore.state.thumbnailCover"
			/>
			<div
				v-if="image.type === 'image/gif' && !$store.state.compactGrid"
				class="gif"
			>
				GIF
			</div>
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
/**
 * @packageDocumentation
 *
 * ノート添付の画像 1 枚。閲覧注意の隠し表示と、クリック時の拡大（または新しいタブで開く）を担う。
 *
 * @remarks
 * - 一覧に出す画像（`src`）はサムネイル。`loadRawImages` か `raw` のときだけ本画像を使う。
 * - リンク先（`href`）は本画像。`loadOriginalImages`（拡大時にオリジナル画質）が有効なら
 *   `originalUrl` を使い、PhotoSwipe の拡大表示（{@link ../components/MkMediaList.vue}）と同じ画像が開くようにする。
 *   以前は常に `url`（Web 公開用の縮小画像）だったため、設定を有効にしても新しいタブでは縮小画像が開いていた。
 * - `imageNewTab` が無効なときはアンカーの既定動作を止め、親の PhotoSwipe に任せる。
 *
 * @public
 */
import { watch } from "vue";
import type * as misskey from "calckey-js";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import ImgWithBlurhash from "@/components/MkImgWithBlurhash.vue";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import bytes from "@/filters/bytes";
import * as os from "@/os";
import { isMobileData } from "@/scripts/datasaver";

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

/**
 * クリック時に開く画像の URL
 *
 * @remarks
 * `loadOriginalImages` が有効ならオリジナル画質（`originalUrl`）、無ければ本画像（`url`）。
 * `originalUrl` はオリジナルと Web 公開用が同じファイルのとき `null` になるので、`url` に落とす。
 *
 * @internal
 */
const href = $computed(() =>
	defaultStore.state.loadOriginalImages
		? props.image.originalUrl || props.image.url
		: props.image.url,
);

async function show() {
	if (props.image.isSensitive && defaultStore.state.openPopupNsfwToCarrior && isMobileData()) {
		const ret = await os.yesno({type: "warning", text: i18n.ts.showSensitiveConfirm})
		if (ret.canceled) {
			return;
		}
		hide = false;
	} else {
                hide = false;
        }
}

function onAnchorClick(ev: MouseEvent) {
        if (!defaultStore.state.imageNewTab) {
                ev.preventDefault();
        }
}

// Plugin:register_note_view_interruptor を使って書き換えられる可能性があるためwatchする
watch(
	() => props.image,
	() => {
		hide =
			defaultStore.state.nsfw === "force" ||
			defaultStore.state.enableDataSaverMode
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
		border: 0.125rem solid var(--accent);
	}
}

.gqnyydlz {
	position: relative;
	//box-shadow: 0 0 0 0.0625rem var(--divider) inset;
	background: var(--bg);

	> .hide {
		display: block;
		position: absolute;
		border-radius: 0.375rem;
		background: var(--accentedBg);
		-webkit-backdrop-filter: var(--blur, blur(15px));
		backdrop-filter: var(--blur, blur(15px));
		color: var(--accent);
		font-size: 0.8em;
		padding: 0.75rem 0.875rem;
		text-align: center;
		top: 0;
		right: 0;

		> i {
			display: block;
		}
	}

	> .imageView {
		display: block;
		position: relative;
		cursor: zoom-in;
		overflow: hidden;
		width: 100%;
		height: 100%;
		background-position: center;
		background-repeat: no-repeat;
		box-sizing: border-box;
		&:focus-visible {
			border: 0.125rem solid var(--accent);
		}

		> .gif {
			position: absolute;
			background: var(--fg);
			border-radius: 0.375rem;
			color: var(--accentLighten);
			display: inline-block;
			font-size: 0.875rem;
			font-weight: bold;
			left: 0.75rem;
			opacity: 0.5;
			padding: 0 0.375rem;
			text-align: center;
			top: 0.75rem;
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
