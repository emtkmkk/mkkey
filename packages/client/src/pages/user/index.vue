<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
			/>
		</template>
		<div>
			<transition name="fade" mode="out-in">
				<div v-if="user">
					<XHome
						v-if="tab === 'home'"
						:user="user"
					/>
					<XImages v-else-if="tab === 'images'" :user="user" />
					<XReactions v-else-if="tab === 'reactions'" :user="user" />
					<XClips v-else-if="tab === 'clips'" :user="user" />
					<XPages v-else-if="tab === 'pages'" :user="user" />
					<XGallery v-else-if="tab === 'gallery'" :user="user" />
					<XCategories v-else-if="tab === 'category'" :user="user" />
				</div>
				<div v-else-if="notFound" class="_fullinfo">
					<img
						src="/static-assets/badges/info.png"
						class="_ghost"
						alt="Info"
					/>
					<div>{{ i18n.ts.userDeletedOrNotFound }}</div>
				</div>
				<MkError v-else-if="error" @retry="fetchUser()" />
				<MkLoading v-else />
			</transition>
		</div>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ユーザーページ（`/@名前` や `/@名前@ホスト`）。
 *
 * @remarks
 * ユーザーが見つからないとき（削除済み・凍結中・存在しない）は、「問題が発生しました」と再試行ボタンではなく、
 * 「削除されたか、見つかりません」とだけ出す。再試行しても結果は変わらないため。
 *
 * @internal
 */
import { defineAsyncComponent, computed, watch } from "vue";
import calcAge from "s-age";
import type * as misskey from "calckey-js";
import { getScrollPosition } from "@/scripts/scroll";
import number from "@/filters/number";
import { userPage, acct as getAcct } from "@/filters/user";
import { resolveUserFromAcct } from "@/scripts/resolve-user-from-acct";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import { search } from "@/scripts/search";

const XHome = defineAsyncComponent(() => import("./home.vue"));
const XImages = defineAsyncComponent(() => import("./images.vue"));
const XReactions = defineAsyncComponent(() => import("./reactions.vue"));
const XClips = defineAsyncComponent(() => import("./clips.vue"));
const XPages = defineAsyncComponent(() => import("./pages.vue"));
const XGallery = defineAsyncComponent(() => import("./gallery.vue"));
const XCategories = defineAsyncComponent(() => import("./categories.vue"));

const props = withDefaults(
	defineProps<{
		acct: string;
		page?: string;
	}>(),
	{
		page: "home",
	}
);

const router = useRouter();

let tab = $ref(props.page);
let user = $ref<null | misskey.entities.UserDetailed>(null);
let error = $ref(null);
/**
 * ユーザーが見つからなかった（削除済み・凍結中・存在しない）。
 *
 * @remarks
 * 再試行しても結果は変わらないので、「問題が発生しました」と再試行ボタンではなく、その旨だけを出す。
 */
let notFound = $computed(() => error?.code === "NO_SUCH_USER");

function userSearch() {
	search(undefined, user?.id);
}

function fetchUser(): void {
	if (props.acct == null) return;
	user = null;
	resolveUserFromAcct(props.acct)
		.then((u) => {
			user = u;
		})
		.catch((err) => {
			error = err;
		});
}

watch(() => props.acct, fetchUser, {
	immediate: true,
});

const headerActions = $computed(() => [
	...(user
		? [
				{
					icon: "ph-magnifying-glass ph-bold ph-lg",
					text: i18n.ts.search,
					handler: userSearch,
				},
		  ]
		: []),
]);

const headerTabs = $computed(() =>
	user
		? [
				{
					key: "home",
					title: i18n.ts.overview,
					icon: "ph-user ph-bold ph-lg",
				},
				...(user.notesCount > 0
					? [
							{
								key: "images",
								title: i18n.ts._timelines.media,
								icon: "ph-images ph-bold ph-lg",
							},
					  ]
					: []),
				...(($i && $i.id === user.id) || user.publicReactions
					? [
							{
								key: "reactions",
								title: i18n.ts.reaction,
								icon: "ph-smiley ph-bold ph-lg",
							},
					  ]
					: []),
				...(user.instance == null
					? [
							...(user.hasClips
								? [
										{
											key: "clips",
											title: i18n.ts.clips,
											icon: "ph-paperclip ph-bold ph-lg",
										},
								  ]
								: []),
							...(user.hasPages
								? [
										{
											key: "pages",
											title: i18n.ts.pages,
											icon: "ph-file-text ph-bold ph-lg",
										},
								  ]
								: []),
							...(user.hasGallerys
								? [
										{
											key: "gallery",
											title: i18n.ts.gallery,
											icon: "ph-image-square ph-bold ph-lg",
										},
								  ]
								: []),
							...(user.hasCategories
								? [
										{
											key: "category",
											title: i18n.ts.category,
											icon: "ph-folder-user ph-bold ph-lg",
										},
								  ]
								: []),
					  ]
					: []),
		  ]
		: null
);

definePageMetadata(
	computed(() =>
		user
			? {
					icon: "ph-user ph-bold ph-lg",
					title: user.name
						? `${user.name} (@${user.username})`
						: `@${user.username}`,
					subtitle: `@${getAcct(user)}`,
					userName: user,
					avatar: user,
					path: `/@${user.username}`,
					share: {
						title: user.name,
					},
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
</style>
