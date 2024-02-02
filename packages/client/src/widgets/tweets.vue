<template>
	<MkContainer
		:show-header="widgetProps.showHeader"
		:style="`height: ${widgetProps.height}px; overflow: scroll;`"
		:scrollable="true"
	>
		<template #header><i class="ph-twitter-logo ph-bold ph-lg"></i>Tweets</template>
		<template #func
			><button class="_button" @click="configure">
				<i class="ph-gear-six ph-bold ph-lg"></i></button
		></template>

		<div>
			<MkLoading v-if="fetching" />
			<div v-else-if="widgetProps.compactView">
				<iframe
					v-for="e in tweets"
					:src="`https://${widgetProps.nitterUrl}/${e[1]}/status/${e[2]}/embed`"
					:width="widgetProps.width - widthAdjust"
					:class="$style.tweet"
					height=100
					scrolling="no"
				></iframe>
			</div>
			<div v-else>
				<iframe 
					:src="`https://${widgetProps.nitterUrl}/${widgetProps.accounts}/with_replies`"
					:width="widgetProps.width - widthAdjust"
					:height="widgetProps.height"
					:class="$style.tweets"
					:key="iframeUpdate"
				></iframe>
			</div>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
	useWidgetPropsManager,
	Widget,
	WidgetComponentEmits,
	WidgetComponentExpose,
	WidgetComponentProps,
} from "./widget";
import { GetFormResultType } from "@/scripts/form";
import * as os from "@/os";
import MkContainer from "@/components/MkContainer.vue";
import { useInterval } from "@/scripts/use-interval";
import { defaultStore } from "@/store";

const name = "tweets";

const widthAdjust = 15;

const widgetPropsDef = {
	accounts: {
		type: "string" as const,
		default: "FF_XIV_JP,FFXIV_NEWS_JP,IIDX_OFFICIAL,popn_team"
	},
	height: {
		type: "number" as const,
		default: 450,
	},
	width: {
		type: "number" as const,
		default: 300 + widthAdjust,
	},
	withReplies: {
		type: "boolean" as const,
		default: false,
	},
	compactView: {
		type: "boolean" as const,
		default: false,
	},
	nitterUrl: {
		type: "string" as const,
		default: "nitter.holo-mix.com"
	},
	showHeader: {
		type: "boolean" as const,
		default: true,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

// 現時点ではvueの制限によりimportしたtypeをジェネリックに渡せない
//const props = defineProps<WidgetComponentProps<WidgetProps>>();
//const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();

const { widgetProps, configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit
);

const twitter = "twitter.com";

const iframeUpdate = ref(false);
const theme = ref(defaultStore.state.darkMode ? "dark" : "light");
const tweets = ref([]);
const fetching = ref(true);
const regex = new RegExp(`https://${twitter}/\(\\w{1,15}\)/status/\(\\d\+\)`);

const tick = async () => {
	if (widgetProps.compactView) {
		fetch(`/api/fetch-rss?url=https://${widgetProps.nitterUrl}/${widgetProps.accounts}/${widgetProps.withReplies ? "with_replies/" : ""}rss`, {}).then((res) => {
			res.json().then((feed) => {
				tweets.value = feed.items.map((e) => e.link.match(regex));
				fetching.value = false;
			});
		});
	} else {
		fetching.value = true;
		iframeUpdate.value ^= true;
		await new Promise((r) => setTimeout(r, 800));
		fetching.value = false;
	}
};

watch(() => widgetProps.url, tick);

useInterval(tick, 120000, {
	immediate: true,
	afterMounted: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.tweet {
	border: none;
	display: block;
	padding: 1px 0 0 0;
}

.tweets {
	border: none;
	display: block;
}
</style>
