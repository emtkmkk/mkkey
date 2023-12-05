<template>
	<button v-if="modelValue" class="fade _button" @click.stop="toggle">
		<span>{{ i18n.ts.showMore }}<span>{{ ` (${label})` }}</span></span>
	</button>
	<button v-if="!modelValue" class="showLess _button" @click.stop="toggle">
		<span>{{ i18n.ts.showLess }}</span>
	</button>
</template>
<script lang="ts" setup>
import { computed } from "vue";
import { i18n } from "@/i18n";
import { length } from "stringz";
import * as misskey from "calckey-js";
import { concat } from "@/scripts/array";

const props = defineProps<{
	modelValue: boolean;
	note?: misskey.entities.Note;
}>();

const label = computed(() => {
	return props.note ? concat([
		props.note.text
			? [i18n.t("_cw.chars", { count: length(props.note.text) })]
			: [],
		props.note.files && props.note.files.length !== 0
			? [i18n.t("_cw.files", { count: props.note.files.length })]
			: [],
		props.note.poll != null ? [i18n.ts.poll] : [],
		props.note.renote != null ? [i18n.ts.quoteAttached] : [],
	] as string[][]).join(" , ") : "";
});

const emit = defineEmits<{
	(ev: "update:modelValue", v: boolean): void;
}>();

const toggle = () => {
	emit("update:modelValue", !props.modelValue);
};
</script>
<style lang="scss" scoped>
.fade {
	display: block;
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	> span {
		display: inline-block;
		background: var(--panel);
		padding: 0.4em 1em;
		font-size: 0.8em;
		border-radius: 999px;
		box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
	}
	&:hover {
		> span {
			background: var(--panelHighlight);
		}
	}
}
.showLess {
	width: 100%;
	margin-top: 1em;
	position: sticky;
	bottom: var(--stickyBottom);

	> span {
		display: inline-block;
		background: var(--panel);
		padding: 6px 10px;
		font-size: 0.8em;
		border-radius: 999px;
		box-shadow: 0 0 7px 7px var(--bg);
	}
}
</style>
