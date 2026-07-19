<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader :actions="headerActions" :tabs="headerTabs"
		/></template>
		<MkSpacer :content-max="1000" :margin-min="16" :margin-max="32">
			<div class="_root">
				<transition
					:name="$store.state.animation ? 'fade' : ''"
					mode="out-in"
				>
					<div v-if="post" class="rkxwuolj">
						<div class="files" @click.stop>
							<!-- PhotoSwipe は MkMediaList 側。単独 MkMediaImage だと拡大しない -->
							<XMediaList
								v-if="post.files?.length"
								:media-list="post.files"
							/>
						</div>
						<div class="body _block">
							<div class="title">{{ post.title }}</div>
							<div class="description">
								<Mfm :text="post.description" />
							</div>
							<div class="info">
								<i class="ph-clock ph-bold ph-lg"></i>
								<MkTime :time="post.createdAt" mode="detail" />
							</div>
							<div class="actions">
								<div class="like">
									<MkButton
										v-if="post.isLiked"
										v-tooltip="i18n.ts._gallery.unlike"
										class="button"
										primary
										@click="unlike()"
										><i class="ph-heart ph-fill ph-lg"></i
										><span
											v-if="post.likedCount > 0"
											class="count"
											>{{ post.likedCount }}</span
										></MkButton
									>
									<MkButton
										v-else
										v-tooltip="i18n.ts._gallery.like"
										class="button"
										@click="like()"
										><i class="ph-heart ph-bold"></i
										><span
											v-if="post.likedCount > 0"
											class="count"
											>{{ post.likedCount }}</span
										></MkButton
									>
								</div>
								<div class="other">
									<button
										v-if="$i && $i.id === post.user.id"
										v-tooltip="i18n.ts.edit"
										v-click-anime
										class="_button"
										@click="edit"
									>
										<i
											class="ph-pencil ph-bold ph-lg ph-fw ph-lg"
										></i>
									</button>
									<button
										v-tooltip="i18n.ts.shareWithNote"
										v-click-anime
										class="_button"
										@click="shareWithNote"
									>
										<i
											class="ph-repeat ph-bold ph-lg ph-fw ph-lg"
										></i>
									</button>
									<button
										v-if="shareAvailable()"
										v-tooltip="i18n.ts.share"
										v-click-anime
										class="_button"
										@click="share"
									>
										<i
											class="ph-share-network ph-bold ph-lg ph-fw ph-lg"
										></i>
									</button>
								</div>
							</div>
							<div class="user">
								<MkAvatar :user="post.user" class="avatar" />
								<div class="name">
									<MkUserName
										:user="post.user"
										style="display: block"
									/>
									<MkAcct :user="post.user" />
								</div>
								<MkFollowButton
									v-if="!$i || $i.id != post.user.id"
									:user="post.user"
									:inline="true"
									:transparent="false"
									:full="true"
									large
									class="koudoku"
									is-following-hidden
								/>
							</div>
						</div>
						<MkAd :prefer="['inline', 'inline-big']" />
						<MkContainer
							:max-height="300"
							:foldable="true"
							class="other"
						>
							<template #header
								><i class="ph-clock ph-bold ph-lg"></i>
								{{ i18n.ts.recentPosts }}</template
							>
							<MkPagination
								v-slot="{ items }"
								:pagination="otherPostsPagination"
							>
								<div class="sdrarzaf">
									<MkGalleryPostPreview
										v-for="post in items"
										:key="post.id"
										:post="post"
										class="post"
									/>
								</div>
							</MkPagination>
						</MkContainer>
					</div>
					<MkError v-else-if="error" @retry="fetchPost()" />
					<MkLoading v-else />
				</transition>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ギャラリー投稿の詳細表示ページ。
 *
 * @remarks
 * - 投稿のメディア・説明・いいね・共有を表示する
 * - 所有者のみ編集ボタンをヘッダーと本文に表示する
 * - 添付メディアの拡大は {@link MkMediaList}（PhotoSwipe）に任せる
 *
 * @public
 */
import { computed, watch } from "vue";
import MkButton from "@/components/MkButton.vue";
import * as os from "@/os";
import MkContainer from "@/components/MkContainer.vue";
import MkPagination from "@/components/MkPagination.vue";
import MkGalleryPostPreview from "@/components/MkGalleryPostPreview.vue";
import MkFollowButton from "@/components/MkFollowButton.vue";
import { url } from "@/config";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { shareAvailable } from "@/scripts/share-available";
import XMediaList from "@/components/MkMediaList.vue";
import { useRouter } from "@/router";
import { $i } from "@/account";

const router = useRouter();

const props = defineProps<{
	postId: string;
}>();

let post = $ref(null);
let error = $ref(null);
const otherPostsPagination = {
	endpoint: "users/gallery/posts" as const,
	limit: 6,
	params: computed(() => ({
		userId: post.user.id,
	})),
};

function fetchPost() {
	post = null;
	os.api("gallery/posts/show", {
		postId: props.postId,
	})
		.then((_post) => {
			post = _post;
		})
		.catch((_error) => {
			error = _error;
		});
}

function share() {
	navigator.share({
		title: post.title,
		text: post.description,
		url: `${url}/gallery/${post.id}`,
	});
}

function shareWithNote() {
	os.post({
		initialText: `${post.title} ${url}/gallery/${post.id}`,
	});
}

function like() {
	os.api("gallery/posts/like", {
		postId: props.postId,
	}).then(() => {
		post.isLiked = true;
		post.likedCount++;
	});
}

async function unlike() {
	os.api("gallery/posts/unlike", {
		postId: props.postId,
	}).then(() => {
		post.isLiked = false;
		post.likedCount--;
	});
}

function edit() {
	router.push(`/gallery/${post.id}/edit`);
}

watch(() => props.postId, fetchPost, { immediate: true });

const headerActions = $computed(() =>
	post && $i && $i.id === post.user.id
		? [
				{
					icon: "ph-pencil ph-bold ph-lg",
					text: i18n.ts.edit,
					handler: edit,
				},
		  ]
		: [],
);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() =>
		post
			? {
					title: post.title,
					avatar: post.user,
			  }
			: null
	)
);
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.125s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.rkxwuolj {
	> .files {
		margin-bottom: 0.5rem;
	}

	> .body {
		padding: 2rem;

		> .title {
			font-weight: bold;
			font-size: 1.2em;
			margin-bottom: 1rem;
		}

		> .info {
			margin-top: 1rem;
			font-size: 90%;
			opacity: 0.7;
		}

		> .actions {
			display: flex;
			align-items: center;
			margin-top: 1rem;
			padding: 1rem 0 0 0;
			border-top: solid 0.03125rem var(--divider);

			> .like {
				> .button {
					--accent: #eb6f92;
					--X8: #eb6f92;
					--buttonBg: rgb(216 71 106 / 5%);
					--buttonHoverBg: rgb(216 71 106 / 10%);
					color: #eb6f92;

					::v-deep(.count) {
						margin-left: 0.5em;
					}
				}
			}

			> .other {
				margin-left: auto;

				> button {
					padding: 0.5rem;
					margin: 0 0.5rem;

					&:hover {
						color: var(--fgHighlighted);
					}
				}
			}
		}

		> .user {
			margin-top: 1rem;
			padding: 1rem 0 0 0;
			border-top: solid 0.03125rem var(--divider);
			display: flex;
			align-items: center;

			> .avatar {
				width: 3.25rem;
				height: 3.25rem;
			}

			> .name {
				margin: 0 0 0 0.75rem;
				font-size: 90%;
			}

			> .koudoku {
				margin-left: auto;
			}
		}
	}
}

.sdrarzaf {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(16.25rem, 1fr));
	grid-gap: 0.75rem;
	margin: var(--margin);

	> .post {
	}
}
</style>
