<template>
	<div class="hoawjimk">
		<!-- プレビュー不可の実ファイルはバナー表示 -->
		<XBanner
			v-for="slot in bannerSlots"
			:key="slot.file.id"
			:media="slot.file"
		/>
		<div
			v-if="gridSlots.length > 0"
			class="gird-container"
			:class="{ dmWidth: inDm, fixedGrid: $store.state.compactGrid }"
			:data-count="gridSlots.length"
		>
			<div
				ref="gallery"
				:data-count="gridSlots.length"
				@click.stop
			>
				<template v-for="slot in gridSlots" :key="slotKey(slot)">
					<!-- 欠落添付: ドライブ削除後などで実体が無いスロット -->
					<div
						v-if="slot.kind === 'missing'"
						class="missing"
						:title="i18n.ts.deletedDriveFile"
					>
						<i class="ph-file-x ph-bold ph-lg"></i>
						<span>{{ i18n.ts.deletedDriveFile }}</span>
					</div>
					<XVideo
						v-else-if="slot.file.type.startsWith('video')"
						:video="slot.file"
					/>
					<XImage
						v-else-if="slot.file.type.startsWith('image')"
						class="image"
						:data-id="slot.file.id"
						:image="slot.file"
						:raw="raw"
					/>
				</template>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ノート等の添付メディア一覧。実ファイルと欠落スロットを fileIds 順に表示する。
 *
 * @remarks
 * `fileIds` を渡すと、`mediaList` に無い ID は「削除されたファイル」プレースホルダになる。
 * 画像拡大は PhotoSwipe（`imageNewTab` が無効のとき）。初期化失敗や itemData 解決失敗は
 * {@link appendErrorLog} に残す（Vue errorHandler 外のため）。
 *
 * @public
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import * as misskey from "calckey-js";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import XBanner from "@/components/MkMediaBanner.vue";
import XImage from "@/components/MkMediaImage.vue";
import XVideo from "@/components/MkMediaVideo.vue";
import * as os from "@/os";
import { FILE_TYPE_BROWSERSAFE } from "@/const";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import {
	buildNoteMediaSlots,
	type NoteMediaSlot,
} from "@/scripts/note-file-attachments";

/** PhotoSwipe に寸法が無いときの仮サイズ（アスペクト比維持用のプレースホルダ） */
const FALLBACK_IMAGE_SIZE = 800;

const props = defineProps<{
	mediaList: misskey.entities.DriveFile[];
	/** ノートの fileIds。指定時は欠落スロットも fileIds 順に表示する */
	fileIds?: string[];
	raw?: boolean;
	inDm?: boolean;
}>();

const gallery = ref<HTMLElement | null>(null);
const pswpZIndex = os.claimZIndex("middle");
let lightbox: PhotoSwipeLightbox | null = null;

/** fileIds 順（または mediaList 順）の全スロット */
const slots = computed(() =>
	buildNoteMediaSlots(props.fileIds, props.mediaList),
);

/** グリッドに載せるスロット（プレビュー可能＋欠落） */
const gridSlots = computed(() =>
	slots.value.filter(
		(slot) => slot.kind === "missing" || previewable(slot.file),
	),
);

/** バナー表示するプレビュー不可の実ファイル */
const bannerSlots = computed(
	() =>
		slots.value.filter(
			(slot): slot is Extract<NoteMediaSlot, { kind: "file" }> =>
				slot.kind === "file" && !previewable(slot.file),
		),
);

/**
 * PhotoSwipe の dataSource 対象になる画像だけを mediaList から抜き出す。
 *
 * @returns ブラウザで安全に表示できる画像ファイル一覧
 * @internal
 */
function lightboxImageFiles(): misskey.entities.DriveFile[] {
	return props.mediaList.filter((media) => {
		if (media.type === "image/svg+xml") return true;
		return (
			media.type.startsWith("image") &&
			FILE_TYPE_BROWSERSAFE.includes(media.type)
		);
	});
}

/**
 * 再初期化判定用の安定キー（参照変更だけでは再初期化しない）。
 *
 * @returns 画像 ID をカンマ連結した文字列
 * @internal
 */
function lightboxSourceKey(): string {
	return lightboxImageFiles()
		.map((media) => media.id)
		.join(",");
}

/**
 * DriveFile の表示用幅・高さを解決する。
 *
 * @remarks
 * `properties` 欠落時は例外にせず仮寸法を返す（拡大自体は続行する）。
 *
 * @param file - 対象ファイル
 * @returns 幅・高さと、orientation による入替が必要か
 * @internal
 */
function resolveImageSize(file: misskey.entities.DriveFile): {
	w: number;
	h: number;
} {
	const propsMeta = file.properties ?? {};
	let w = Number(propsMeta.width);
	let h = Number(propsMeta.height);
	if (!Number.isFinite(w) || w <= 0) w = FALLBACK_IMAGE_SIZE;
	if (!Number.isFinite(h) || h <= 0) h = FALLBACK_IMAGE_SIZE;
	if (propsMeta.orientation != null && propsMeta.orientation >= 5) {
		[w, h] = [h, w];
	}
	return { w, h };
}

/**
 * v-for 用の安定キーを返す。
 *
 * @param slot - メディアスロット
 * @returns DOM キー
 * @internal
 */
function slotKey(slot: NoteMediaSlot): string {
	return slot.kind === "missing" ? `missing:${slot.id}` : slot.file.id;
}

//#region PhotoSwipe

/**
 * 既存 lightbox を破棄する。
 *
 * @internal
 */
function destroyLightbox(): void {
	lightbox?.destroy();
	lightbox = null;
}

/**
 * PhotoSwipe lightbox を初期化する。
 *
 * @remarks
 * - `gallery` 未マウントや `imageNewTab` 有効時は何もしない。
 * - 失敗時は {@link os.appendErrorLog} に残す。
 *
 * @internal
 */
function initLightbox(): void {
	if (defaultStore.state.imageNewTab) return;
	if (!gallery.value) return;

	destroyLightbox();

	try {
		const images = lightboxImageFiles();
		lightbox = new PhotoSwipeLightbox({
			dataSource: images.map((media) => {
				const { w, h } = resolveImageSize(media);
				return {
					src: defaultStore.state.loadOriginalImages
						? media.originalUrl || media.url
						: media.url,
					w,
					h,
					title: media.name,
					alt: media.comment,
				};
			}),
			gallery: gallery.value,
			children: ".image",
			thumbSelector: ".image",
			loop: false,
			padding:
				window.innerWidth > 500
					? {
							top: 32,
							bottom: 32,
							left: 32,
							right: 32,
						}
					: {
							top: 0,
							bottom: 0,
							left: 0,
							right: 0,
						},
			imageClickAction: "close",
			tapAction: "toggle-controls",
			pswpModule: PhotoSwipe,
		});

		lightbox.on("itemData", (ev) => {
			try {
				const { itemData } = ev;
				const element = itemData.element as HTMLElement | undefined;
				if (!element) {
					void os.appendErrorLog(
						`MediaListLightbox: itemData missing element`,
					);
					return;
				}

				const id = element.dataset.id;
				const file = props.mediaList.find((media) => media.id === id);
				if (!file) {
					void os.appendErrorLog(
						`MediaListLightbox: file not found for id=${id ?? "(none)"}`,
					);
					return;
				}

				const { w, h } = resolveImageSize(file);
				itemData.src = defaultStore.state.loadOriginalImages
					? file.originalUrl || file.url
					: file.url;
				itemData.w = w;
				itemData.h = h;
				itemData.title = file.name;
				itemData.msrc = file.thumbnailUrl;
				itemData.alt = file.comment;
				itemData.thumbCropped = true;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				void os.appendErrorLog(
					`MediaListLightbox: itemData error: ${error.message}${
						error.stack ? ` stack:${error.stack}` : ""
					}`,
				);
			}
		});

		lightbox.on("uiRegister", () => {
			lightbox!.pswp.ui.registerElement({
				name: "altText",
				className: "pwsp__alt-text-container",
				appendTo: "wrapper",
				onInit: (el, pwsp) => {
					let textBox = document.createElement("p");
					textBox.className = "pwsp__alt-text";
					el.appendChild(textBox);

					let preventProp = function (ev: Event): void {
						ev.stopPropagation();
					};

					// Allow scrolling/text selection
					el.onwheel = preventProp;
					el.onclick = preventProp;
					el.onpointerdown = preventProp;
					el.onpointercancel = preventProp;
					el.onpointermove = preventProp;

					pwsp.on("change", () => {
						textBox.textContent = pwsp.currSlide.data.alt?.trim();
					});
				},
			});
		});

		lightbox.init();
	} catch (err) {
		destroyLightbox();
		const error = err instanceof Error ? err : new Error(String(err));
		void os.appendErrorLog(
			`MediaListLightbox: init failed: ${error.message}${
				error.stack ? ` stack:${error.stack}` : ""
			}`,
		);
	}
}

/**
 * lightbox を破棄してから必要なら再初期化する。
 *
 * @remarks
 * DOM 更新後に `gallery` が揃うよう `nextTick` する。
 *
 * @internal
 */
async function refreshLightbox(): Promise<void> {
	destroyLightbox();
	if (defaultStore.state.imageNewTab) return;
	await nextTick();
	initLightbox();
}

//#endregion

onMounted(() => {
	void refreshLightbox();
});

onUnmounted(() => {
	destroyLightbox();
});

watch(
	() => defaultStore.state.imageNewTab,
	() => {
		void refreshLightbox();
	},
);

// 画像構成が変わったとき、または gallery が後から出たときに再初期化
watch(
	() => [lightboxSourceKey(), gallery.value] as const,
	() => {
		void refreshLightbox();
	},
);

const previewable = (file: misskey.entities.DriveFile): boolean => {
	if (file.type === "image/svg+xml") return true; // svgのwebpublic/thumbnailはpngなのでtrue
	// FILE_TYPE_BROWSERSAFEに適合しないものはブラウザで表示するのに不適切
	return (
		(file.type.startsWith("video") || file.type.startsWith("image")) &&
		FILE_TYPE_BROWSERSAFE.includes(file.type)
	);
};
</script>

<style lang="scss" scoped>
@use "sass:math";
.hoawjimk {
	> .dmWidth {
		min-width: 20rem;
		max-width: 40rem;
	}

	> .gird-container {
		position: relative;
		width: 100%;
		margin-top: 0.25rem;
		border-radius: var(--radius);
		overflow: hidden;
		pointer-events: none;

		$num: 1;
		@while $num <= 16 {
			$row-count: math.ceil(math.div($num, 2));
			$additional-rows: $row-count - 2;
			$padding-top-value: 56.25% + max(0, $additional-rows) * 28.125%;

			@if $num != 1 and $num % 2 == 1 {
				$row-count: $row-count + 1;
				$padding-top-value: $padding-top-value + 28.125%;
			}

			&[data-count="#{$num}"] {
				&:before {
					content: "";
					display: block;
					padding-top: $padding-top-value;
				}

				> div {
					position: absolute;
					top: 0;
					right: 0;
					bottom: 0;
					left: 0;
					display: grid;
					grid-gap: 0.5rem;
					grid-template-columns: 1fr 1fr;
					grid-template-rows: repeat($row-count, 1fr);

					> * {
						overflow: hidden;
						border-radius: 0.375rem;
						pointer-events: all;
					}
					@if $num == 1 or $num % 2 == 1 {
						> *:nth-child(1) {
							grid-column: 1 / 3;
						}
					}

					@if $num != 1 and $num % 2 == 1 {
						> *:nth-child(1) {
							grid-row: span 2;
						}
						> *:nth-child(#{$num}) {
							grid-column: 2 / 3;
						}
					}
				}

				&.fixedGrid {
					// 要素数に応じたpadding-topの調整
					@if $num <= 8 {
						&:before {
							padding-top: 28.125%;
						}
					}
					@if $num > 8 and $num <= 16 {
						&:before {
							padding-top: 56.25%;
						}
					}

					> div {
						// 8列のグリッドとして表示
						grid-template-columns: repeat(8, 1fr);

						@if $num <= 8 {
							grid-template-rows: repeat(1, 1fr);
						}
						@if $num > 8 and $num <= 16 {
							grid-template-rows: repeat(2, 1fr);
						}

						// 以前のグリッド設定をリセット
						> * {
							grid-column: auto;
							grid-row: auto;
						}
					}
				}
			}
			$num: $num + 1;
		}

		.missing {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.35rem;
			padding: 0.5rem;
			background: var(--bg);
			color: var(--fgTransparentWeak);
			font-size: 0.75rem;
			text-align: center;
			box-sizing: border-box;
			min-height: 0;

			> i {
				font-size: 1.5rem;
				opacity: 0.7;
			}

			> span {
				line-height: 1.3;
				word-break: break-word;
			}
		}
	}
}
</style>

<style lang="scss">
.pswp {
	// なぜか機能しない
	//z-index: v-bind(pswpZIndex);
	z-index: 2000000;
}
.pwsp__alt-text-container {
	display: flex;
	flex-direction: row;
	align-items: center;

	position: absolute;
	bottom: 1.875rem;
	left: 50%;
	transform: translateX(-50%);

	width: 75%;
}
.pwsp__alt-text {
	color: white;
	margin: 0 auto;
	text-align: center;
	padding: 0.625rem;
	background: rgba(0, 0, 0, 0.5);
	border-radius: 0.3125rem;

	max-height: calc(var(--vh, 1vh) * 10);
	overflow-x: clip;
	overflow-y: auto;
	overscroll-behavior: contain;
}

.pwsp__alt-text:empty {
	display: none;
}
</style>
