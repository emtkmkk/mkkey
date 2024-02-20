<template>
	<div
		class="mkw-onlineUsers"
		:class="{
			_panel: !widgetProps.transparent,
			pad: !widgetProps.transparent,
		}"
	>
		<span v-if="widgetProps.showOnline" class="text" data-v-93ec8385="">
			接続中:
			<b data-v-93ec8385="">{{ onlineUsersCount + honlineUsersCount }}</b
			>{{ showCount === 4 || showCount === 2 ? "  " : "" }}
			<br v-if="showCount === 3"
		/></span>
		<span v-if="widgetProps.showAway" class="text" data-v-93ec8385="">
			離席中:
			<b data-v-93ec8385="">{{ activeUsersCount + hactiveUsersCount }}</b
			>{{
				(showCount === 3 && widgetProps.showOnline) ||
				(showCount === 2 && !widgetProps.showOnline)
					? "  "
					: ""
			}}
			<br
				v-if="
					showCount === 4 ||
					(!widgetProps.showOnline && showCount === 3)
				"
		/></span>
		<span v-if="widgetProps.showOffline" class="text" data-v-93ec8385="">
			切断中:
			<b data-v-93ec8385="">{{
				offline1UsersCount + offline2UsersCount + offline3UsersCount
			}}</b
			>{{ widgetProps.showSleep ? "  " : "" }}
		</span>
		<span v-if="widgetProps.showSleep" class="text" data-v-93ec8385="">
			休眠中:
			<b data-v-93ec8385="">{{
				sleepUsersCount + dsleepUsersCount + dsleep2UsersCount
			}}</b>
		</span>
		<!-- <span v-if="widgetProps.showOnline && widgetProps.superDetails" class="text" data-v-93ec8385="">
		接続中: <b data-v-93ec8385="">{{ onlineUsersCount }}</b> / <b data-v-93ec8385="">{{ honlineUsersCount }}</b>
		<br></span>
		<span v-if="widgetProps.showAway && widgetProps.superDetails" class="text" data-v-93ec8385="">
		離席中: <b data-v-93ec8385="">{{ activeUsersCount }}</b> / <b data-v-93ec8385="">{{ hactiveUsersCount }}</b>
		<br></span>
		<span v-if="widgetProps.showOffline && widgetProps.superDetails" class="text" data-v-93ec8385="">
		切断中: <b data-v-93ec8385="">{{ offline1UsersCount }}</b> / <b data-v-93ec8385="">{{ offline2UsersCount }}</b> / <b data-v-93ec8385="">{{ offline3UsersCount }}</b>
		<br></span>
		<span v-if="widgetProps.showSleep && widgetProps.superDetails" class="text" data-v-93ec8385="">
		休眠中: <b data-v-93ec8385="">{{ sleepUsersCount }}</b> / <b data-v-93ec8385="">{{ dsleepUsersCount }}</b> / <b data-v-93ec8385="">{{ dsleep2UsersCount }}</b>
		</span> -->
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import {
	useWidgetPropsManager,
	Widget,
	WidgetComponentEmits,
	WidgetComponentExpose,
	WidgetComponentProps,
} from "./widget";
import { GetFormResultType } from "@/scripts/form";
import * as os from "@/os";
import { useInterval } from "@/scripts/use-interval";
import MkUserOnlineIndicator from "@/components/MkUserOnlineIndicatorDummy.vue";
import { i18n } from "@/i18n";

const name = "onlineUsersDetails";

const widgetPropsDef = {
	transparent: {
		type: "boolean" as const,
		default: true,
	},
	showOnline: {
		type: "boolean" as const,
		default: true,
	},
	showAway: {
		type: "boolean" as const,
		default: true,
	},
	showOffline: {
		type: "boolean" as const,
		default: true,
	},
	showSleep: {
		type: "boolean" as const,
		default: true,
	},
	superDetails: {
		type: "boolean" as const,
		default: false,
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

const showCount =
	(widgetProps.showOnline ? 1 : 0) +
	(widgetProps.showAway ? 1 : 0) +
	(widgetProps.showOffline ? 1 : 0) +
	(widgetProps.showSleep ? 1 : 0);
const onlineUsersCount = ref(0);
const honlineUsersCount = ref(0);
const activeUsersCount = ref(0);
const hactiveUsersCount = ref(0);
const offline1UsersCount = ref(0);
const offline2UsersCount = ref(0);
const offline3UsersCount = ref(0);
const sleepUsersCount = ref(0);
const dsleepUsersCount = ref(0);
const dsleep2UsersCount = ref(0);

const tick = () => {
	os.api("get-online-users-count/detail").then((res) => {
		onlineUsersCount.value = res.onlineCount;
		activeUsersCount.value = res.activeCount;
		offline1UsersCount.value = res.offlineCount;
		sleepUsersCount.value = res.sleepCount;
	});
};

useInterval(tick, 1000 * 15, {
	immediate: true,
	afterMounted: true,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.mkw-onlineUsers {
	text-align: center;

	&.pad {
		padding: 1rem 0;
	}

	> .text {
		::v-deep(b) {
			color: var(--badge);
		}

		::v-deep(span) {
			opacity: 0.7;
		}
	}
}
</style>
