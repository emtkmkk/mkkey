<template>
	<MkContainer :show-header="widgetProps.showHeader" class="mkw-userList">
		<template #header
			><i class="ph-user-list ph-bold ph-lg"></i>
			{{ list ? list.name : i18n.ts._widgets.userList }}</template
		>
		<template #func="{ buttonStyleClass }"
			><button
				class="_button"
				:class="buttonStyleClass"
				@click="configure()"
			>
				<i class="ph-gear-six ph-bold ph-lg"></i></button
		></template>

		<div class="wsdlkfj">
			<div v-if="widgetProps.listId == null" class="init">
				<MkButton primary @click="chooseList">{{
					i18n.ts._widgets._userList.chooseList	
				}}</MkButton>
			</div>
			<MkLoading v-else-if="fetching" />
			<div v-else class="users">
				<MkAvatars :user-ids="users" :sortStatus="widgetProps.sortStatus" :hiddenOfflineSleep="widgetProps.hiddenOfflineSleep" class="userAvatars" />
			</div>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
import { useWidgetPropsManager, Widget, WidgetComponentExpose } from "./widget";
import { GetFormResultType } from "@/scripts/form";
import MkContainer from "@/components/MkContainer.vue";
import MkAvatars from "@/components/MkAvatars.vue";
import * as os from "@/os";
import { useInterval } from "@/scripts/use-interval";
import { i18n } from "@/i18n";
import MkButton from "@/components/MkButton.vue";

const name = "userList";
const widgetPropsDef = {
	showHeader: {
		type: "boolean" as const,
		default: true,
	},
	sortStatus: {
		type: "boolean" as const,
		default: false,
	},
	hiddenOfflineSleep: {
		type: "boolean" as const,
		default: false,
	},
	highFrequencyReload: {
		type: "boolean" as const,
		default: false,
	},
	listId: {
		type: "string" as const,
		default: null,
		hidden: true,
	},
};
type WidgetProps = GetFormResultType<typeof widgetPropsDef>;
// 現時点ではvueの制限によりimportしたtypeをジェネリックに渡せない
//const props = defineProps<WidgetComponentProps<WidgetProps>>();
//const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();
const { widgetProps, configure, save } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit
);
let list = $ref();
let users = $ref([]);
let fetching = $ref(true);
async function chooseList() {
	const lists = await os.api("users/lists/list");
	const { canceled, result: list } = await os.select({
		title: i18n.ts.selectList,
		items: lists.map((x) => ({
			value: x,
			text: x.name,
		})),
		default: widgetProps.listId,
	});
	if (canceled) return;
	widgetProps.listId = list.id;
	save();
	fetch();
}
const fetch = () => {
	if (widgetProps.listId == null) {
		fetching = false;
		return;
	}
	os.api("users/lists/show", {
		listId: widgetProps.listId,
	}).then((_list) => {
		list = _list;
		os.api("users/show", {
			userIds: list.userIds,
		}).then((_users) => {
			users = list.userIds;
			fetching = false;
		});
	});
};
useInterval(fetch, (widgetProps.highFrequencyReload ? 1000 * 60 : 1000 * 300), {
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
.wsdlkfj {
	> .init {
		padding: 16px;
	}
}
</style>
