<template>
	<button
		v-if="canRenote && $store.state.seperateRenoteQuote"
		v-tooltip.bottom="i18n.ts.quote"
		class="eddddedb _button"
		@click="quote()"
	>
		<i class="ph-quotes ph-bold ph-lg"></i>
	</button>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { Note } from "calckey-js/built/entities";
import { pleaseLogin } from "@/scripts/please-login";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";

const props = defineProps<{
	note: Note;
}>();

const canRenote = computed(
	() =>
		["public", "home"].includes(props.note.visibility) ||
		props.note.userId === $i?.id
);

function quote(): void {
	pleaseLogin();
	os.post({
		renote: props.note,
	});
}
</script>

<style lang="scss" scoped>
.eddddedb {
	display: inline-block;
	height: 2rem;
	margin: 0.125rem;
	padding: 0 0.375rem;
	border-radius: 0.25rem;

	&.renoted {
		background: var(--accent);
	}

	> .count {
		display: inline;
		margin-left: 0.5rem;
		opacity: 0.7;
	}
}
</style>
