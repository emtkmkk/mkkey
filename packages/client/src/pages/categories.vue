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
							:pagination="featuredCategoriesPagination"
						>
							<MkCategoryPreview
								v-for="item in items"
								:key="item?.category?.id ?? item?.id"
								class="ckltabjg"
								:category="item?.category ?? item"
							/>
						</MkPagination>
					</div>
				</swiper-slide>
				<swiper-slide>
					<XDraggable
						v-model="followCategoryIds"
						class="zoaiodol"
						:item-key="(item) => item"
						animation="150"
						delay="100"
						delay-on-touch-only="true"
					>
						<template #item="{ element }">
							<div v-if="followCategories.map((x) => x.id).includes(element)" class="rknalgpo _gap">
								<MkCategoryPreview
									:key="element"
									class="ckltabjg"
									:category="followCategories.find((x) => x.id === element)"
								/>
							</div>
						</template>
					</XDraggable>
				</swiper-slide>
				<swiper-slide>
					<div class="rknalgpo my">
						<div class="buttoncontainer">
							<MkButton class="new primary" @click="create()"
								><i class="ph-plus ph-bold ph-lg"></i>
								{{ i18n.ts._categories.newCategory }}</MkButton
							>
						</div>
						<MkPagination
							key="my"
							v-if="tab === 'my'"
							v-slot="{ items }"
							:pagination="myCategoriesPagination"
						>
							<MkCategoryPreview
								v-for="item in items"
								:key="item?.category?.id ?? item?.id"
								class="ckltabjg"
								:category="item?.category ?? item"
							/>
						</MkPagination>
					</div>
				</swiper-slide>
			</swiper>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch, onMounted, defineAsyncComponent } from "vue";
import { Virtual } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import MkCategoryPreview from "@/components/MkCategoryPreview.vue";
import MkPagination from "@/components/MkPagination.vue";
import MkButton from "@/components/MkButton.vue";
import { useRouter } from "@/router";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deviceKind } from "@/scripts/device-kind";
import { defaultStore } from "@/store";
import { followCategories, sortCustomCategory } from "@/instance";
import "swiper/scss";
import "swiper/scss/virtual";

const router = useRouter();

const XDraggable = defineAsyncComponent(() =>
	import("vuedraggable").then((x) => x.default)
);

const followCategoryIds = $computed(
	defaultStore.makeGetterSetter("followCategories")
);

let tab = $ref("featured");
const tabs = ["featured", "following", "my"];
watch($$(tab), () => syncSlide(tabs.indexOf(tab)));
watch($$(followCategoryIds), () => sortCustomCategory())
	
const featuredCategoriesPagination = {
	endpoint: "categories/featured" as const,
	limit: 20,
};
const myCategoriesPagination = {
	endpoint: "i/categories" as const,
	limit: 10,
};

function create() {
	router.push("/categories/new");
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
		title: i18n.ts._categories.featured,
		icon: "ph-fire-simple ph-bold ph-lg",
	},
	{
		key: "following",
		title: i18n.ts._categories.following,
		icon: "ph-plus ph-bold ph-lg",
	},
	{
		key: "my",
		title: i18n.ts._categories.my,
		icon: "ph-crown-simple ph-bold ph-lg",
	},
]);

definePageMetadata(
	computed(() => ({
		title: i18n.ts.categories,
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
