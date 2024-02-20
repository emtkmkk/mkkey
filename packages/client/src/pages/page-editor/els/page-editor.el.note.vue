<template>
	<XContainer :draggable="true" @remove="() => $emit('remove')">
		<template #header
			><i class="ph-sticker ph-bold ph-lg"></i>
			{{ i18n.ts._pages.blocks.note }}</template
		>

		<section style="padding: 0 1rem 0 1rem">
			<MkInput v-model="id">
				<template #label>{{ i18n.ts._pages.blocks._note.id }}</template>
				<template #caption>{{
					props.value.note ||
					i18n.ts._pages.blocks._note.idDescription
				}}</template>
			</MkInput>
			<MkSwitch v-model="value.detailed"
				><span>{{
					i18n.ts._pages.blocks._note.detailed
				}}</span></MkSwitch
			>

			<XNote
				v-if="note && !value.detailed"
				:key="note.id + ':normal'"
				v-model:note="note"
				style="margin-bottom: 1rem"
			/>
			<XNoteDetailed
				v-if="note && value.detailed"
				:key="note.id + ':detail'"
				v-model:note="note"
				style="margin-bottom: 1rem"
			/>
		</section>
	</XContainer>
</template>

<script lang="ts" setup>
import { ref, unref, watch } from "vue";
import XContainer from "../page-editor.container.vue";
import MkInput from "@/components/form/input.vue";
import MkSwitch from "@/components/form/switch.vue";
import XNote from "@/components/MkNote.vue";
import XNoteDetailed from "@/components/MkNoteDetailed.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

const props = withDefaults(
	defineProps<{
		value: any;
	}>(),
	{
		value: {
			note: null,
			detailed: false,
		},
	}
);

let id: any = ref(props.value.note);
let note: any = ref(null);

watch(
	id,
	async (newId) => {
		if (
			newId &&
			(newId.startsWith("http://") || newId.startsWith("https://"))
		) {
			props.value.note = (
				newId.endsWith("/") ? newId.slice(0, -1) : newId
			)
				.split("/")
				.pop();
		} else {
			props.value.note = newId;
		}

		note =
			unref(props.value.note)?.length === 10
				? await os.api("notes/show", {
						noteId: unref(props.value.note),
				  })
				: undefined;
	},
	{
		immediate: true,
	}
);
</script>
