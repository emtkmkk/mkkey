<template>
	<XModalWindow
		ref="dialog"
		:width="600"
		@click="done(true)"
		@close="done(true)"
		@closed="$emit('closed')"
	>
		<template #header>{{ i18n.ts.draft }}</template>

		<div class="_monolithic_">
			<div class="_section">
				<XDraft
					@done="done(true)"
					@save="emit('save', $event)"
					@load="load($event)"
					@delete="emit('delete', $event)"
				/>
			</div>
		</div>
	</XModalWindow>
</template>

<script lang="ts" setup>
import XModalWindow from "@/components/MkModalWindow.vue";
import XDraft from "@/pages/draft.vue";
import { i18n } from "@/i18n";

const emit = defineEmits<{
	(ev: "done", v: { canceled: boolean; result: any }): void;
	(ev: "save", v: { canceled: boolean; key: any; name: any }): void;
	(ev: "load", v: { canceled: boolean; key: any }): void;
	(ev: "delete", v: { canceled: boolean; key: any }): void;
	(ev: "closed"): void;
}>();

const dialog = $ref<InstanceType<typeof XModalWindow>>();

function done(canceled, result?) {
	emit("done", { canceled, result });
	dialog.close();
}
function load(ev) {
	emit("load", ev);
	dialog.close();
}

function close(res) {
	dialog.close();
}
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
