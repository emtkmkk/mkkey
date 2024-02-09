<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
		/></template>
		<MkSpacer :content-max="800">
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
					<XNotes ref="notes" :pagination="notesPagination" />
				</swiper-slide>
				<swiper-slide>
					<XUserList
						ref="users"
						class="_gap"
						:pagination="usersPagination"
					/>
				</swiper-slide>
			</swiper>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch, onMounted } from "vue";
import { Virtual } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import XNotes from "@/components/MkNotes.vue";
import XUserList from "@/components/MkUserList.vue";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import * as os from "@/os";
import "swiper/scss";
import "swiper/scss/virtual";

const props = defineProps<{
	tag: string;
}>();

const notesPagination = {
	endpoint: "notes/search-by-tag" as const,
	limit: 10,
	params: computed(() => ({
		tag: props.tag,
	})),
};

const usersPagination = {
	endpoint: "users/search" as const,
	limit: 10,
	params: computed(() => ({
		query: `#${props.tag}`,
		origin: "combined",
	})),
};

const tabs = ["notes", "users"];
let tab = $ref(tabs[0]);
watch($$(tab), () => syncSlide(tabs.indexOf(tab)));

function post() {
	os.post({
		initialText: ` #${props.tag} `,
		instant: true,
	});
}

const headerActions = $computed(() => [
	{
		icon: "ph-note-pencil ph-bold ph-lg",
		text: i18n.ts.postForm,
		iconOnly: true,
		handler: post,
	},
]);

const headerTabs = $computed(() => [
	{
		key: "notes",
		icon: "ph-note ph-bold ph-lg",
		title: i18n.ts.notes,
	},
	{
		key: "users",
		icon: "ph-users ph-bold ph-lg",
		title: i18n.ts.users,
	},
]);

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

definePageMetadata(
	computed(() => ({
		title: props.tag,
		icon: "ph-hash ph-bold ph-lg",
	}))
);
</script>
