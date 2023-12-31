<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader
				v-model:tab="src"
				:actions="headerActions"
				:tabs="headerTabs"
				:display-my-avatar="true"
			/>
		</template>
		<MkSpacer :content-max="800">
			<div ref="rootEl" v-hotkey.global="keymap" class="cmuxhskf">
				<XPostForm
					v-if="$store.reactiveState.showFixedPostForm.value"
					class="post-form _block"
					fixed
				/>

				<div v-if="queue > 0" class="new">
					<button class="_buttonPrimary" @click="top()">
						{{ `${i18n.ts.newNoteRecived} (${queue >= 29 ? "29+" : queue})` }}
					</button>
				</div>
				<!-- <div v-if="!isMobile" class="tl _block">
				<XTimeline
					ref="tl"
					:key="src"
					class="tl"
					:src="src"
					:sound="true"
					@queue="queueUpdated"
				/>
			</div> *v-else on next div* -->
				<div class="tl _block">
					<swiper
						:touch-angle="$store.state.swipeTouchAngle"
						:threshold="$store.state.swipeThreshold"
						:centeredSlides="$store.state.swipeCenteredSlides"
						:modules="[Virtual]"
						:space-between="20"
						:virtual="true"
						:allow-touch-move="
							!(
								!defaultStore.state.swipeOnDesktop
							)
						"
						@swiper="setSwiperRef"
						@slide-change="onSlideChange"
					>
						<swiper-slide
							v-for="index in timelines"
							:key="index"
							:virtual-index="index"
							style="box-sizing: border-box;"
						>
							<XTimeline
								v-if="index == timelines[swiperRef.activeIndex]"
								ref="tl"
								:key="src"
								class="tl"
								:src="src"
								:list="src === 'list' ? defaultStore.state.thirdTimelineListId : null"
								:antenna="src === 'antenna' ? defaultStore.state.thirdTimelineListId : null"
								:sound="true"
								@queue="queueUpdated"
							/>
						</swiper-slide>
					</swiper>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, watch, ref, onMounted } from "vue";
import { Virtual } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import XTutorial from "@/components/MkTutorialDialog.vue";
import XTimeline from "@/components/MkTimeline.vue";
import XPostForm from "@/components/MkPostForm.vue";
import { scroll } from "@/scripts/scroll";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { instance } from "@/instance";
import { $i } from "@/account";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deviceKind } from "@/scripts/device-kind";
import "swiper/scss";
import "swiper/scss/virtual";

defaultStore.loaded.then(() => {
	if (defaultStore.reactiveState.tutorial.value !== -1) {
		os.popup(XTutorial, {}, {}, "closed");
	}
});

const isLocalTimelineAvailable =
	!instance.disableLocalTimeline ||
	($i != null && ($i.isModerator || $i.isAdmin));
const isRecommendedTimelineAvailable = !instance.disableRecommendedTimeline;
const isGlobalTimelineAvailable =
	!instance.disableGlobalTimeline ||
	($i != null && ($i.isModerator || $i.isAdmin));
const keymap = {
	t: focus,
};

let timelines = [];

if (
	isLocalTimelineAvailable &&
	(defaultStore.state.showLocalPostsInTimeline === "social" ||
	defaultStore.state.showLocalPostsInTimeline === "both")
) {
	timelines.push("home");
}

if (
	isLocalTimelineAvailable &&
	(defaultStore.state.showLocalPostsInTimeline === "home" ||
	defaultStore.state.showLocalPostsInTimeline === "both")
) {
	timelines.push("social");
}

if (isLocalTimelineAvailable && !defaultStore.state.hiddenLTL) {
	timelines.push("local");
}

if (isRecommendedTimelineAvailable &&
    defaultStore.state.thirdTimelineType === "media"
	) {
	timelines.push("recommended");
}
if (defaultStore.state.thirdTimelineType === "spotlight"){
	timelines.push("spotlight");
}
if (defaultStore.state.thirdTimelineType === "list"){
	timelines.push("list");
}
if (defaultStore.state.thirdTimelineType === "antenna"){
	timelines.push("antenna");
}
if (isGlobalTimelineAvailable && !defaultStore.state.hiddenGTL) {
	timelines.push("global");
}

const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isMobile = ref(
	deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD
);
window.addEventListener("resize", () => {
	isMobile.value =
		deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
});

const tlComponent = $ref<InstanceType<typeof XTimeline>>();
const rootEl = $ref<HTMLElement>();

let queue = $ref(0);
const src = $computed({
	get: () => {
		if (timelines.includes(defaultStore.reactiveState.tl.value.src)) {
			return defaultStore.reactiveState.tl.value.src
		} else {
			return timelines?.[0] || null;
		}
	},
	set: (x) => {
		saveSrc(x);
		syncSlide(timelines.indexOf(x));
	},
});

watch($$(src), () => (queue = 0));

function queueUpdated(q: number): void {
	queue = q;
}

function top(): void {
	scroll(rootEl, { top: 0 });
}

async function chooseList(ev: MouseEvent): Promise<void> {
	const lists = await os.api("users/lists/list");
	const items = [
		{
			type: "link" as const,
			text: i18n.ts.manageLists,
			icon: "ph-faders-horizontal ph-bold ph-lg",
			to: "/my/lists",
		},
	].concat(
		lists.map((list) => ({
			type: "link" as const,
			text: list.name,
			icon: "",
			to: `/timeline/list/${list.id}`,
		}))
	);
	os.popupMenu(items, ev.currentTarget ?? ev.target);
}

async function chooseAntenna(ev: MouseEvent): Promise<void> {
	const antennas = await os.api("antennas/list");
	const items = [
		{
			type: "link" as const,
			indicate: false,
			text: i18n.ts.manageAntennas,
			icon: "ph-faders-horizontal ph-bold ph-lg",
			to: "/my/antennas",
		},
	].concat(
		antennas.map((antenna) => ({
			type: "link" as const,
			text: antenna.name,
			icon: "",
			indicate: $i.mutingNotificationTypes.includes("unreadAntenna") && antenna.hasUnreadNote,
			to: `/timeline/antenna/${antenna.id}`,
		}))
	);
	os.popupMenu(items, ev.currentTarget ?? ev.target);
}

function saveSrc(
	newSrc: "home" | "local" | "spotlight" | "recommended" | "list" | "antenna" | "social" | "global"
): void {
	defaultStore.set("tl", {
		...defaultStore.state.tl,
		src: newSrc,
	});
}

async function timetravel(): Promise<void> {
	const { canceled, result: date } = await os.inputDate({
		title: i18n.ts.date,
	});
	if (canceled) return;

	tlComponent.timetravel(date);
}

function focus(): void {
	tlComponent.focus();
}

const headerActions = $computed(() => [
	{
		icon: "ph-list-bullets ph-bold ph-lg",
		title: i18n.ts.lists,
		text: i18n.ts.lists,
		iconOnly: true,
		handler: chooseList,
	},
	{
		icon: "ph-flying-saucer ph-bold ph-lg",
		title: i18n.ts.antennas,
		text: i18n.ts.antennas,
		iconOnly: true,
		handler: chooseAntenna,
	} /* **TODO: fix timetravel** {
	icon: 'ph-calendar-blank ph-bold ph-lg',
	title: i18n.ts.jumpToSpecifiedDate,
	iconOnly: true,
	handler: timetravel,
}*/,
]);

// Swap home timeline with social's functionality

const headerTabs = $computed(() => [
	...(isLocalTimelineAvailable &&
	(defaultStore.state.showLocalPostsInTimeline === "social" ||
	defaultStore.state.showLocalPostsInTimeline === "both")
		? [
				{
					key: "home",
					title: i18n.ts._timelines.home,
					icon: "ph-house ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(isLocalTimelineAvailable &&
	defaultStore.state.showLocalPostsInTimeline === "home"
		? [
				{
					key: "social",
					title: i18n.ts._timelines.home,
					icon: "ph-house ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(isLocalTimelineAvailable &&
	defaultStore.state.showLocalPostsInTimeline === "both"
		? [
				{
					key: "social",
					title: i18n.ts._timelines.social,
					icon: "ph-handshake ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(isLocalTimelineAvailable && !defaultStore.state.hiddenLTL
		? [
				{
					key: "local",
					title: i18n.ts._timelines.local,
					icon: "ph-users ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	/* ...(isLocalTimelineAvailable &&
	defaultStore.state.showLocalPostsInTimeline === "home"
		? [
				{
					key: "home",
					title: i18n.ts._timelines.social,
					icon: "ph-handshake ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: isLocalTimelineAvailable
		? [
				{
					key: "social",
					title: i18n.ts._timelines.social,
					icon: "ph-handshake ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []), */
	...(isRecommendedTimelineAvailable && defaultStore.state.thirdTimelineType === "media"
		? [
				{
					key: "recommended",
					title: i18n.ts._timelines.recommended,
					icon: "ph-images-square ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(defaultStore.state.thirdTimelineType === "spotlight"
		? [
				{
					key: "spotlight",
					title: i18n.ts._timelines.spotlight,
					icon: "ph-star-four ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(defaultStore.state.thirdTimelineType === "list"
		? [
				{
					key: "list",
					title: i18n.ts._timelines.list,
					icon: "ph-list-bullets ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(defaultStore.state.thirdTimelineType === "antenna"
		? [
				{
					key: "antenna",
					title: i18n.ts._timelines.antenna,
					icon: "ph-flying-saucer ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
	...(isGlobalTimelineAvailable && !defaultStore.state.hiddenGTL
		? [
				{
					key: "global",
					title: i18n.ts._timelines.global,
					icon: "ph-planet ph-bold ph-lg",
					iconOnly: true,
				},
		  ]
		: []),
]);

definePageMetadata(
	computed(() => ({
		title: timelines == null || timelines.length == 0 ? i18n.ts.wall : i18n.ts.timeline,
		icon:
			src === "local"
				? "ph-users ph-bold ph-lg"
				: src === "social" &&
				  defaultStore.state.showLocalPostsInTimeline === "home"
				? "ph-house ph-bold ph-lg"
				: src === "social"
				? "ph-handshake ph-bold ph-lg"
				: src === "recommended"
				? "ph-images-square ph-bold ph-lg"
				: src === "spotlight"
				? "ph-star-four ph-bold ph-lg"
				: src === "list"
				? "ph-list-bullets ph-bold ph-lg"
				: src === "antenna"
				? "ph-flying-saucer ph-bold ph-lg"
				: src === "global"
				? "ph-planet ph-bold ph-lg"
				: src === "home" &&
				  defaultStore.state.showLocalPostsInTimeline === "home"
				? "ph-handshake ph-bold ph-lg"
				: "ph-house ph-bold ph-lg",
	}))
);

let swiperRef: any = null;

function setSwiperRef(swiper) {
	swiperRef = swiper;
	syncSlide(timelines.indexOf(src));
}

function onSlideChange() {
	saveSrc(timelines[swiperRef.activeIndex]);
}

function syncSlide(index) {
	swiperRef.slideTo(index);
}

onMounted(() => {
	syncSlide(
		timelines.indexOf(defaultStore.state.tl?.src || swiperRef.activeIndex)
	);
});
</script>

<style lang="scss" scoped>
.cmuxhskf {
	--swiper-theme-color: var(--accent);

	> .new {
		position: sticky;
		top: calc(var(--stickyTop, 0px) + 16px);
		z-index: 1000;
		width: 100%;
		pointer-events: none;

		> button {
			display: block;
			margin: var(--margin) auto 0 auto;
			padding: 8px 16px;
			border-radius: 32px;
			pointer-events: all;
		}
	}

	> .post-form {
		border-radius: var(--radius);
	}

	> .tl {
		background: none;
		border-radius: var(--radius);
		overflow: clip;
	}
}
</style>
