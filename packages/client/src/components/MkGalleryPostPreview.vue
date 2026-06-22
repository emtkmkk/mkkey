<template>
	<MkA :to="`/gallery/${post.id}`" class="ttasepnz _panel" tabindex="-1">
		<div class="thumbnail">
			<ImgWithBlurhash
				v-if="thumbnailFile"
				class="img"
				:src="thumbnailFile.thumbnailUrl"
				:hash="thumbnailFile.blurhash"
			/>
			<div v-else class="img no-image">
				<i class="ph-image-square ph-bold ph-lg"></i>
			</div>
		</div>
		<article>
			<header>
				<MkAvatar :user="post.user" class="avatar" />
			</header>
			<footer>
				<span class="title">{{ post.title }}</span>
			</footer>
		</article>
	</MkA>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ギャラリー投稿のプレビューカード。
 *
 * @remarks
 * - 一覧表示用のサムネイルとタイトルを表示する
 * - 添付ファイルがない場合はプレースホルダーを表示する
 *
 * @public
 */
import { computed } from "vue";
import * as misskey from "calckey-js";
import ImgWithBlurhash from "@/components/MkImgWithBlurhash.vue";

const props = defineProps<{
	post: misskey.entities.GalleryPost;
}>();

// サムネイル表示に使う先頭ファイル（存在しない場合は null）
const thumbnailFile = computed(() => props.post.files?.[0] ?? null);
</script>

<style lang="scss" scoped>
.ttasepnz {
	display: block;
	position: relative;
	height: 12.5rem;

	&:hover {
		text-decoration: none;
		color: var(--accent);

		> .thumbnail {
			transform: scale(1.1);
		}

		> article {
			> footer {
				&:before {
					opacity: 1;
				}
			}
		}
	}

	> .thumbnail {
		width: 100%;
		height: 100%;
		position: absolute;
		transition: all 0.5s ease;

		> .img {
			width: 100%;
			height: 100%;
			object-fit: cover;

			&.no-image {
				display: flex;
				align-items: center;
				justify-content: center;
				background: var(--panel);
				color: var(--fgTransparentWeak);
				font-size: 2rem;
			}
		}
	}

	> article {
		position: absolute;
		z-index: 1;
		width: 100%;
		height: 100%;

		> header {
			position: absolute;
			top: 0;
			width: 100%;
			padding: 0.75rem;
			box-sizing: border-box;
			display: flex;

			> .avatar {
				margin-left: auto;
				width: 2rem;
				height: 2rem;
			}
		}

		> footer {
			position: absolute;
			bottom: 0;
			width: 100%;
			padding: 1rem;
			box-sizing: border-box;
			color: #fff;
			text-shadow: 0 0 0.5rem var(--shadow);
			background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));

			&:before {
				content: "";
				display: block;
				position: absolute;
				z-index: -1;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: linear-gradient(rgba(0, 0, 0, 0.4), transparent);
				opacity: 0;
				transition: opacity 0.5s ease;
			}

			> .title {
				font-weight: bold;
			}
		}
	}
}
</style>
