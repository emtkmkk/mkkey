<template>
	<XContainer :draggable="true" @remove="() => $emit('remove')">
		<template #header
			><i class="ph-align-left ph-bold ph-lg"></i>
			{{ i18n.ts._pages.blocks.text }}</template
		>

		<section class="vckmsadr">
			<textarea v-model="value.text"></textarea>
		</section>
	</XContainer>
</template>

<script lang="ts" setup>
import {} from "vue";
import XContainer from "../page-editor.container.vue";
import { i18n } from "@/i18n";

withDefaults(
	defineProps<{
		value: any;
	}>(),
	{
		value: {
			text: "",
		},
	}
);
</script>

<style lang="scss" scoped>
.vckmsadr {
	> textarea {
		display: block;
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		width: 100%;
		min-width: 100%;
		min-height: 9.375rem;
		border: none;
		box-shadow: none;
		padding: 1rem;
		background: transparent;
		color: var(--fg);
		font-size: 0.875rem;
		box-sizing: border-box;
	}
}
</style>
