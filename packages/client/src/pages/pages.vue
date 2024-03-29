<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
		/></template>
		<MkSpacer :content-max="700">
			<swiper
				:touch-angle="$store.state.swipeTouchAngle"
				:threshold="$store.state.swipeThreshold"
				:centeredSlides="$store.state.swipeCenteredSlides"
				:modules="[Virtual]"
				:space-between="20"
				:virtual="true"
				:allow-touch-move="!!defaultStore.state.swipeOnDesktop"
				@swiper="setSwiperRef"
				@slide-change="onSlideChange"
			>
				<swiper-slide>
					<div class="rknalgpo">
						<MkPagination
							key="featured"
							v-if="tab === 'featured'"
							v-slot="{ items }"
							:pagination="featuredPagesPagination"
						>
							<MkPagePreview
								v-for="item in items"
								:key="item?.page?.id ?? item?.id"
								class="ckltabjg"
								:page="item?.page ?? item"
							/>
						</MkPagination>
					</div>
				</swiper-slide>
				<swiper-slide>
					<div class="rknalgpo liked">
						<MkPagination
							key="liked"
							v-if="tab === 'liked'"
							v-slot="{ items }"
							:pagination="likedPagesPagination"
						>
							<MkPagePreview
								v-for="like in items"
								:key="like.page.id ?? like.id"
								class="ckltabjg"
								:page="like.page ?? like"
							/>
						</MkPagination>
					</div>
				</swiper-slide>
				<swiper-slide>
					<div class="rknalgpo my">
						<div class="buttoncontainer">
							<MkButton class="new primary" @click="create()"
								><i class="ph-plus ph-bold ph-lg"></i>
								{{ i18n.ts._pages.newPage }}</MkButton
							>
						</div>
						<MkPagination
							key="my"
							v-if="tab === 'my'"
							v-slot="{ items }"
							:pagination="myPagesPagination"
						>
							<MkPagePreview
								v-for="item in items"
								:key="item?.page?.id ?? item?.id"
								class="ckltabjg"
								:page="item?.page ?? item"
							/>
						</MkPagination>
					</div>
				</swiper-slide>
			</swiper>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch, onMounted } from "vue";
import { Virtual } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import MkPagePreview from "@/components/MkPagePreview.vue";
import MkPagination from "@/components/MkPagination.vue";
import MkButton from "@/components/MkButton.vue";
import { useRouter } from "@/router";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deviceKind } from "@/scripts/device-kind";
import { defaultStore } from "@/store";
import "swiper/scss";
import "swiper/scss/virtual";

const router = useRouter();

let tab = $ref("featured");
const tabs = ["featured", "liked", "my"];
watch($$(tab), () => syncSlide(tabs.indexOf(tab)));

const featuredPagesPagination = {
	endpoint: "pages/featured" as const,
	limit: 20,
};
const likedPagesPagination = {
	endpoint: "i/page-likes" as const,
	limit: 10,
};
const myPagesPagination = {
	endpoint: "i/pages" as const,
	limit: 10,
};

function create() {
	router.push("/pages/new");
}

const headerActions = $computed(() => [
	{
		icon: "ph-plus ph-bold ph-lg",
		text: i18n.ts.create,
		handler: create,
	},
]);

const headerTabs = $computed(() => [
	{
		key: "featured",
		title: i18n.ts._pages.featured,
		icon: "ph-fire-simple ph-bold ph-lg",
	},
	{
		key: "liked",
		title: i18n.ts._pages.liked,
		icon: "ph-heart ph-bold ph-lg",
	},
	{
		key: "my",
		title: i18n.ts._pages.my,
		icon: "ph-crown-simple ph-bold ph-lg",
	},
]);

definePageMetadata(
	computed(() => ({
		title: i18n.ts.pages,
		icon: "ph-file-text ph-bold ph-lg",
	}))
);

let swiperRef = null;

function setSwiperRef(swiper) {
	swiperRef = swiper;
	syncSlide(tabs.indexOf(tab));
}

function onSlideChange() {
	tab = tabs[swiperRef.activeIndex];
}

function syncSlide(index) {
	swiperRef.slideTo(index);
}

onMounted(() => {
	syncSlide(tabs.indexOf(swiperRef.activeIndex));
});
</script>

<style lang="scss" scoped>
.rknalgpo {
	> .buttoncontainer {
		display: grid;
		justify-content: center;
		margin-bottom: 1rem;
	}

	&.my .ckltabjg:first-child {
		margin-top: 1rem;
	}

	.ckltabjg:not(:last-child) {
		margin-bottom: 0.5rem;
	}

	@media (min-width: 31.25rem) {
		.ckltabjg:not(:last-child) {
			margin-bottom: 1rem;
		}
	}
}
</style>
