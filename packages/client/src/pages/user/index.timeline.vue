<template>
	<MkStickyContainer>
		<template #header>
			<MkTab v-model="include" :class="$style.tab" @contextmenu.stop="onContextmenu">
				<option :value="null">{{ i18n.ts.notes }}</option>
				<option value="highlight">{{ i18n.ts.highlight }}</option>
				<option value="replies">{{ i18n.ts.notesAndReplies }}</option>
				<option value="files">{{ i18n.ts.withFiles }}</option>
			</MkTab>
		</template>
		<XNotes re :key="generateUniqueKey()" :no-gap="true" :pagination="pagination" />
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import * as misskey from "calckey-js";
import XNotes from "@/components/MkNotes.vue";
import MkTab from "@/components/MkTab.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import { MenuLabel, MenuButton } from "@/types/menu";

const props = defineProps<{
	user: misskey.entities.UserDetailed;
}>();

const include = ref<string | null>(null);

const endpoint = computed(() => {
		return include.value != "highlight" ? "users/notes" : "users/featured-notes"
})

const pagination = {
	endpoint,
	limit: 10,
	params: computed(() => ({
		userId: props.user.id,
		includeReplies: include.value === "replies",
		withFiles: include.value === "files",
		showVisitor: include.value === "visitor",
		privateOnly: include.value === "private",
		untilDate: travelDate ? travelDate.valueOf() : undefined
	})),
};
const generateUniqueKey = () => {
  return `${include.value}-${Math.floor(Date.now() / 10000)}`;
};

const lastBackedDate = $computed(() => defaultStore.reactiveState.lastBackedDate?.value?.[endpoint.value]);

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
			...( travelDate ? [{
				type: "label",
				text: i18n.ts.showingPastTimeline,
			} as MenuLabel,{
				type: "label",
				text: travelDate.toLocaleString(),
			} as MenuLabel] : []),
			...(!travelDate && lastBackedDate?.createdAt && Date.now() - Date.parse(lastBackedDate?.createdAt) < 30 * 60 * 1000 ? [{
				icon: 'ph-arrow-arc-left ph-bold ph-lg',
				text: i18n.ts.lastBackedDate as string,
				action: () => {
					let lastDate = new Date(lastBackedDate?.date);
					lastDate.setSeconds(lastDate.getSeconds() + 1);
					travelDate = lastDate;
				},
			} as MenuButton] : []),
			{
				icon: 'ph-calendar-blank ph-bold ph-lg',
				text: i18n.ts.jumpToSpecifiedDate as string,
				action: () => {
					timetravel()
				},
			} as MenuButton,
		],
		ev
	);
};
</script>

<style lang="scss" module>
.tab {
	margin: calc(var(--margin) / 2) 0;
	padding: calc(var(--margin) / 2) 0;
	background: var(--bg);
}
</style>
