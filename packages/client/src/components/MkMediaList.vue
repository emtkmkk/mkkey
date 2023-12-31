<template>
	<div class="hoawjimk">
		<XBanner
			v-for="media in mediaList.filter((media) => !previewable(media))"
			:key="media.id"
			:media="media"
		/>
		<div
			v-if="mediaList.filter((media) => previewable(media)).length > 0"
			class="gird-container"
			:class="{ dmWidth: inDm, fixedGrid: $store.state.compactGrid, }"
			:data-count="
				mediaList.filter((media) => previewable(media)).length
			"
		>
			<div
				ref="gallery"
				:data-count="
					mediaList.filter((media) => previewable(media)).length
				"
				@click.stop
			>
				<template
					v-for="media in mediaList.filter((media) =>
						previewable(media)
					)"
				>
					<XVideo
						v-if="media.type.startsWith('video')"
						:key="media.id"
						:video="media"
					/>
					<XImage
						v-else-if="media.type.startsWith('image')"
						:key="media.id"
						class="image"
						:data-id="media.id"
						:image="media"
						:raw="raw"
					/>
				</template>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
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

const props = defineProps<{
	mediaList: misskey.entities.DriveFile[];
	raw?: boolean;
	inDm?: boolean;
}>();

const gallery = ref(null);
const pswpZIndex = os.claimZIndex("middle");

onMounted(() => {
	const lightbox = new PhotoSwipeLightbox({
		dataSource: props.mediaList
			.filter((media) => {
				if (media.type === "image/svg+xml") return true; // svgのwebpublicはpngなのでtrue
				return (
					media.type.startsWith("image") &&
					FILE_TYPE_BROWSERSAFE.includes(media.type)
				);
			})
			.map((media) => {
				const item = {
					src: media.url,
					w: media.properties.width,
					h: media.properties.height,
					title: media.name,
					alt: media.comment,
				};
				if (
					media.properties.orientation != null &&
					media.properties.orientation >= 5
				) {
					[item.w, item.h] = [item.h, item.w];
				}
				return item;
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
		const { itemData } = ev;

		// element is children
		const { element } = itemData;

		const id = element.dataset.id;
		const file = props.mediaList.find((media) => media.id === id);

		itemData.src = file.url;
		itemData.w = Number(file.properties.width);
		itemData.h = Number(file.properties.height);
		if (
			file.properties.orientation != null &&
			file.properties.orientation >= 5
		) {
			[itemData.w, itemData.h] = [itemData.h, itemData.w];
		}
		itemData.title = file.name;
		itemData.msrc = file.thumbnailUrl;
		itemData.alt = file.comment;
		itemData.thumbCropped = true;
	});

	lightbox.on("uiRegister", () => {
		lightbox.pswp.ui.registerElement({
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
});

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
		margin-top: 4px;
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
					grid-gap: 8px;
					grid-template-columns: 1fr 1fr;
					grid-template-rows: repeat($row-count, 1fr);

					> * {
						overflow: hidden;
						border-radius: 6px;
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
	bottom: 30px;
	left: 50%;
	transform: translateX(-50%);

	width: 75%;
}

.pwsp__alt-text {
	color: white;
	margin: 0 auto;
	text-align: center;
	padding: 10px;
	background: rgba(0, 0, 0, 0.5);
	border-radius: 5px;

	max-height: 10vh;
	overflow-x: clip;
	overflow-y: auto;
	overscroll-behavior: contain;
}

.pwsp__alt-text:empty {
	display: none;
}
</style>
