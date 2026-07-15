<template>
	<template
		v-for="file in previewableFiles"
		:key="file.id"
	>
		<button
			v-if="isHidden(file)"
			type="button"
			:class="$style.sensitive"
			@click.stop="show(file)"
		>
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
					<b
						v-if="
							(defaultStore.state.enableDataSaverMode &&
								file.size) ||
							!file.isSensitive
						"
						style="display: block"
						><i
							v-if="file.type.startsWith('image')"
							class="ph-image ph-bold ph-lg"
						></i
						><i
							v-if="file.type.startsWith('video')"
							class="ph-file-video ph-bold ph-lg"
						></i>
						{{
							defaultStore.state.enableDataSaverMode && file.size
								? bytes(file.size, 2)
								: i18n.ts.image
						}}</b
					>
					<span style="display: block">{{
						i18n.ts.clickToShow
					}}</span>
				</div>
			</div>
		</button>
		<MkA v-else :class="$style.img" :to="notePage(note)">
			<ImgWithBlurhash
				v-if="file.type.startsWith('video')"
				:hash="file.blurhash"
				:src="thumbnail(file)"
				:title="file.name"
			/>
			<ImgWithBlurhash
				v-if="file.type.startsWith('image')"
				:hash="file.blurhash"
				:src="thumbnail(file)"
				:title="file.name"
			/>
			<div v-else :class="$style.sensitive">
				<div v-if="file.isSensitive">
					<i class="ph-bold ph-file-audio"></i>
					{{ i18n.ts.sensitive }}
				</div>
				<div v-else>
					<i class="ph-bold ph-file-audio"></i>
					{{ i18n.ts.audioFile }}
				</div>
			</div>
			<div v-if="file.type.startsWith('video')" :class="$style.gif">
				{{ i18n.ts.video }}
			</div>
			<div v-if="file.type === 'image/gif'" :class="$style.gif">GIF</div>
		</MkA>
	</template>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * プロフィール「メディア」タブ向けのノート添付ファイルグリッドセル。
 *
 * @remarks
 * - センシティブ / データセーバー時はオーバーレイを出し、クリックで個別に表示する。
 * - {@link MkMediaImage} と同様に `nsfw === 'force'`・キャリア回線確認に対応する。
 * - NOTE: `showingFiles` はコンポーネントローカル状態のため、親の `v-for` に
 *   `:key` が無いと無限スクロール時に別ノートへ状態が引き継がれる。
 * - NOTE: `note.files` が欠ける場合があるため null ガードする。
 *
 * @see MkMediaImage
 * @see images.vue
 *
 * @public
 */
import { computed, watch } from "vue";
import { notePage } from "@/filters/note.js";
import { i18n } from "@/i18n.js";
import ImgWithBlurhash from "@/components/MkImgWithBlurhash.vue";
import type * as Misskey from "misskey-js";
import { defaultStore } from "@/store.js";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import { FILE_TYPE_BROWSERSAFE } from "@/const";
import bytes from "@/filters/bytes";
import * as os from "@/os";
import { isMobileData } from "@/scripts/datasaver";

const props = defineProps<{
	/** 添付ファイルを持つノート */
	note: Misskey.entities.Note;
}>();

/** オーバーレイ解除済みファイル ID 一覧 */
let showingFiles = $ref<string[]>([]);

/**
 * ブラウザで安全にプレビューできるファイルか判定する。
 *
 * @param file - 判定対象のドライブファイル
 * @returns プレビュー対象なら true
 *
 * @remarks
 * svg の webpublic/thumbnail は png のため常に true とする。
 * FILE_TYPE_BROWSERSAFE に無い画像・動画は除外する。
 *
 * @internal
 */
const previewable = (file: Misskey.entities.DriveFile): boolean => {
	if (file.type === "image/svg+xml") return true;
	return (
		(file.type.startsWith("video") || file.type.startsWith("image")) &&
		FILE_TYPE_BROWSERSAFE.includes(file.type)
	);
};

/**
 * プレビュー可能な添付ファイル一覧。
 *
 * @remarks
 * `note.files` が undefined/null の場合は空配列を返す（レンダリング例外防止）。
 */
const previewableFiles = computed(() =>
	(props.note.files ?? []).filter((file) => previewable(file))
);

/**
 * サムネイル URL を返す。
 *
 * @param file - 対象ファイル
 * @returns 静止画化が有効なら static URL、否则 サムネイル URL
 *
 * @internal
 */
function thumbnail(file: Misskey.entities.DriveFile): string {
	return defaultStore.state.disableShowingAnimatedImages
		? getStaticImageUrl(file.url)
		: file.thumbnailUrl;
}

/**
 * オーバーレイで隠すべきファイルかどうかを返す。
 *
 * @param file - 判定対象
 * @returns 隠す場合 true
 *
 * @remarks
 * - `nsfw === 'force'` またはデータセーバーモードなら画像・動画を常に隠す
 * - センシティブかつ `nsfw !== 'ignore'` のときも隠す
 * - ユーザーがクリックして `showingFiles` に入ったものは表示する
 *
 * @internal
 */
function isHidden(file: Misskey.entities.DriveFile): boolean {
	if (
		!(file.type.startsWith("video") || file.type.startsWith("image"))
	) {
		return false;
	}
	if (showingFiles.includes(file.id)) {
		return false;
	}
	return (
		defaultStore.state.nsfw === "force" ||
		defaultStore.state.enableDataSaverMode ||
		(file.isSensitive && defaultStore.state.nsfw !== "ignore")
	);
}

/**
 * センシティブ / データセーバーオーバーレイを解除して表示する。
 *
 * @param file - 表示するファイル
 *
 * @remarks
 * センシティブかつキャリア回線確認が有効なときのみ確認ダイアログを出す。
 * {@link MkMediaImage} の show と同じ方針。
 *
 * @internal
 */
async function show(file: Misskey.entities.DriveFile): Promise<void> {
	if (
		file.isSensitive &&
		defaultStore.state.openPopupNsfwToCarrior &&
		isMobileData()
	) {
		const ret = await os.yesno({
			type: "warning",
			text: i18n.ts.showSensitiveConfirm,
		});
		if (ret.canceled) {
			return;
		}
	}
	if (!showingFiles.includes(file.id)) {
		showingFiles.push(file.id);
	}
}

/** ノートが差し替わった場合、表示解除状態を初期化する */
watch(
	() => props.note.id,
	() => {
		showingFiles = [];
	}
);

/**
 * NSFW / データセーバー設定変更時は表示解除状態をクリアする。
 *
 * @remarks
 * 設定変更後に「すでに表示したまま」にならないようにする（MkMediaImage の watch に相当）。
 */
watch(
	() => [defaultStore.state.nsfw, defaultStore.state.enableDataSaverMode] as const,
	() => {
		showingFiles = [];
	}
);
</script>

<style lang="scss" module>
.img {
	height: 13.75rem;
	border-radius: 0.375rem;
	overflow: clip;
	position: relative;
}

.empty {
	margin: 0;
	padding: 1rem;
	text-align: center;
}

.sensitive {
	all: unset;
	box-sizing: border-box;
	display: grid;
	place-items: center;
	width: 100%;
	height: 13.75rem;
	position: relative;
	cursor: pointer;
	border-radius: 0.375rem;
	overflow: clip;

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

	&:focus-visible {
		outline: 0.125rem solid var(--accent);
		outline-offset: 0.125rem;
	}
}

.gif {
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
</style>
