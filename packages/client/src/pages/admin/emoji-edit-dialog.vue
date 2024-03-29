<template>
	<XModalWindow
		ref="dialog"
		:width="370"
		:with-ok-button="true"
		@close="$refs.dialog.close()"
		@closed="$emit('closed')"
		@ok="ok()"
	>
		<template #header>:{{ emoji.name }}:</template>

		<div class="_monolithic_">
			<div class="yigymqpb _section">
				<img :src="emoji.url" class="img" />
				<MkInput v-model="name" class="_formBlock">
					<template #label>{{ i18n.ts.name }}</template>
				</MkInput>
				<MkInput
					v-model="category"
					class="_formBlock"
					:datalist="categories"
				>
					<template #label>{{ i18n.ts.category }}</template>
				</MkInput>
				<MkInput v-model="aliases" class="_formBlock">
					<template #label>{{ i18n.ts.tags }}</template>
					<template #caption>{{
						i18n.ts.setMultipleBySeparatingWithSpace
					}}</template>
				</MkInput>
				<MkTextarea
					v-model="license"
					class="_formBlock"
					misskey-auto-complete
				>
					<template #label>{{ i18n.ts.license }}</template>
				</MkTextarea>
				<MkButton danger @click="del()"
					><i class="ph-trash ph-bold ph-lg"></i>
					{{ i18n.ts.delete }}</MkButton
				>
			</div>
		</div>
	</XModalWindow>
</template>

<script lang="ts" setup>
import {} from "vue";
import XModalWindow from "@/components/MkModalWindow.vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import MkTextarea from "@/components/form/textarea.vue";
import * as os from "@/os";
import { unique } from "@/scripts/array";
import { i18n } from "@/i18n";
import { emojiCategories } from "@/instance";

const props = defineProps<{
	emoji: any;
}>();

let dialog = $ref(null);
let name: string = $ref(props.emoji.name);
let category: string = $ref(props.emoji.category);
let aliases: string = $ref(props.emoji.aliases.join(" "));
let categories: string[] = $ref(emojiCategories);
let license: string = $ref(props.emoji.license ?? "");

const emit = defineEmits<{
	(ev: "done", v: { deleted?: boolean; updated?: any }): void;
	(ev: "closed"): void;
}>();

function ok() {
	update();
}

async function update() {
	await os.apiWithDialog("admin/emoji/update", {
		id: props.emoji.id,
		name,
		category,
		aliases: aliases.split(" "),
		license: license === "" ? null : license,
	});

	emit("done", {
		updated: {
			id: props.emoji.id,
			name,
			category,
			aliases: aliases.split(" "),
			license: license === "" ? null : license,
		},
	});

	dialog.close();
}

async function del() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("removeAreYouSure", { x: name }),
	});
	if (canceled) return;

	os.api("admin/emoji/delete", {
		id: props.emoji.id,
	}).then(() => {
		emit("done", {
			deleted: true,
		});
		dialog.close();
	});
}
</script>

<style lang="scss" scoped>
.yigymqpb {
	> .img {
		display: block;
		height: 4rem;
		margin: 0 auto;
	}
}
</style>
