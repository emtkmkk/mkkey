<template>
	<div class="mk-google" @click.stop>
		<input v-model="query" type="search" :placeholder="q" />
		<button @click="search">
			<i class="ph-magnifying-glass ph-bold ph-lg"></i>
			{{ i18n.ts.searchByGoogle }}
		</button>
	</div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { i18n } from "@/i18n";

const props = defineProps<{
	q: string;
}>();

const query = ref(props.q);

const search = () => {
	window.open(`https://www.google.com/search?q=${query.value}`, "_blank");
};
</script>

<style lang="scss" scoped>
.mk-google {
	display: flex;
	margin: 0.5rem 0;

	> input {
		flex-shrink: 1;
		padding: 0.625rem;
		width: 100%;
		height: 2.5rem;
		font-size: 1rem;
		border: solid 0.0625rem var(--divider);
		border-radius: 0.25rem 0 0 0.25rem;
		-webkit-appearance: none;
		-webkit-border-radius: 0.25rem 0 0 0.25rem;
	}

	> button {
		flex-shrink: 0;
		margin: 0;
		padding: 0 1rem;
		border: solid 0.0625rem var(--divider);
		border-left: none;
		border-radius: 0 0.25rem 0.25rem 0;

		&:active {
			box-shadow: 0 0.125rem 0.25rem rgba(#000, 0.15) inset;
		}
	}
}
</style>
