<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
				@contextmenu.stop="onContextmenu"
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
					<XNotes
						v-if="tab === 'notes'"
						key="notes"
						ref="notes"
						:pagination="notesPagination"
					/>
				</swiper-slide>
				<swiper-slide v-if="showMediaTab">
					<XNotes
						v-if="tab === 'medianotes'"
						key="medianotes"
						ref="medianotes"
						:pagination="medianotesPagination"
					/>
				</swiper-slide>
				<swiper-slide v-if="!user">
					<XUserList
						v-if="tab === 'users'"
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
/**
 * @packageDocumentation
 *
 * 検索結果ページ（`/search?q=...`）。投稿・メディア付き投稿・ユーザーをタブで切り替えて表示する。
 *
 * @remarks
 * - 投稿の絞り込み構文（`user:` / `file:` / `filter:` など）は検索 API（`notes/search`）が解釈する。
 * - NB: タブ（`tabs`）とスライド（`swiper-slide`）は並び順で対応している。
 *   タブを条件付きで隠すときは、対応するスライドにも同じ条件の `v-if` を付けること（付けないと番号がずれる）。
 *
 * @internal
 */
import { computed, watch, onMounted } from "vue";
import { Virtual } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import XNotes from "@/components/MkNotes.vue";
import XUserList from "@/components/MkUserList.vue";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import "swiper/scss";
import "swiper/scss/virtual";
import { MenuLabel, MenuButton } from "@/types/menu";
import * as os from "@/os";

const props = defineProps<{
	query: string;
	channel?: string;
	user?: string;
}>();

const notesPagination = {
	endpoint: "notes/search" as const,
	limit: 10,
	params: computed(() => ({
		query: props.query,
		channelId: props.channel,
		userId: props.user,
		untilDate: travelDate ? travelDate.valueOf() : undefined,
	})),
};

const medianotesPagination = {
	endpoint: "notes/search" as const,
	limit: 10,
	params: computed(() => ({
		query: props.query + "+filter:media",
		channelId: props.channel,
		userId: props.user,
		untilDate: travelDate ? travelDate.valueOf() : undefined,
	})),
};

const usersPagination = {
	endpoint: "users/search" as const,
	limit: 10,
	params: computed(() => ({
		query: props.query,
		origin: "combined",
	})),
};

/**
 * 「メディア」タブを出すかどうか
 *
 * @remarks
 * `filter:media` 指定済み、または `file:`（特定ファイルを添付した投稿）指定のときは、
 * 「投稿」タブと結果が同じになるため出さない。
 *
 * @internal
 */
const showMediaTab =
	!props.query?.includes("filter:media") &&
	!/(^|[\s+])file:/i.test(props.query ?? "");

let tabs = [
	"notes",
	...(showMediaTab ? ["medianotes"] : []),
	...(!props.user && !props.channel ? ["users"] : []),
];
let tab = $ref(tabs[0]);
watch($$(tab), () => syncSlide(tabs.indexOf(tab)));

const headerActions = $computed(() => []);

const headerTabs = $computed(() => [
	{
		key: "notes",
		icon: "ph-magnifying-glass ph-bold ph-lg",
		title: i18n.ts.notes,
	},
	...(showMediaTab
		? [
				{
					key: "medianotes",
					icon: "ph-images ph-bold ph-lg",
					title: i18n.ts._timelines.media,
				},
		  ]
		: []),
	...(props.user
		? []
		: [
				{
					key: "users",
					icon: "ph-users ph-bold ph-lg",
					title: i18n.ts.users,
				},
		  ]),
]);

const lastBackedDate = $computed(
	() => defaultStore.reactiveState.lastBackedDate?.value?.[endpoint.value]
);

let travelDate = $ref<Date | undefined>(undefined);

async function timetravel(defaultDate?: Date): Promise<void> {
	const { canceled, result: date } = await os.inputDateTime({
		title: i18n.ts.date,
		default: travelDate || defaultDate || new Date(),
	});
	if (canceled || !date || Date.now() < date.valueOf()) {
		travelDate = undefined;
		return;
	}

	travelDate = date;
}

const onContextmenu = (ev: MouseEvent) => {
	os.contextMenu(
		[
			...(travelDate
				? [
						{
							type: "label",
							text: i18n.ts.showingPastTimeline,
						} as MenuLabel,
						{
							type: "label",
							text: travelDate.toLocaleString(),
						} as MenuLabel,
						{
							icon: "ph-arrow-line-up ph-bold ph-lg",
							text: i18n.ts.jumpToNow as string,
							action: () => {
								travelDate = undefined;
							},
						} as MenuButton,
				  ]
				: []),
			...(!travelDate &&
			lastBackedDate?.createdAt &&
			Date.now() - Date.parse(lastBackedDate?.createdAt) < 30 * 60 * 1000
				? [
						{
							icon: "ph-arrow-arc-left ph-bold ph-lg",
							text: i18n.ts.lastBackedDate as string,
							action: () => {
								let lastDate = new Date(lastBackedDate?.date);
								lastDate.setSeconds(lastDate.getSeconds() + 1);
								travelDate = lastDate;
							},
						} as MenuButton,
				  ]
				: []),
			{
				icon: "ph-calendar-blank ph-bold ph-lg",
				text: i18n.ts.jumpToSpecifiedDate as string,
				action: () => {
					timetravel();
				},
			} as MenuButton,
		],
		ev
	);
};

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
		title: i18n.t("searchWith", { q: props.query }),
		icon: "ph-magnifying-glass ph-bold ph-lg",
	}))
);
</script>
