<template>
	<MkSpacer :content-max="1100">
		<MkPagination v-slot="{ items }" :pagination="pagination">
			<div :class="$style.stream">
				<MkMedias v-for="note in items" :note="note" />
			</div>
		</MkPagination>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import MkMedias from "@/components/MkMedias.vue";
import MkPagination from "@/components/MkPagination.vue";
import * as misskey from "calckey-js";

const props = defineProps<{
	user: misskey.entities.User;
}>();

const pagination = {
	endpoint: "users/notes" as const,
	limit: 20,
	params: computed(() => ({
		userId: props.user.id,
		withFiles: true,
	})),
};
</script>

<style lang="scss" module>
.root {
	padding: 0.5rem;
}

.stream {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	grid-gap: 0.375rem;
}

@media (min-width: 45rem) {
	.stream {
		grid-template-columns: repeat(auto-fill, minmax(15.625rem, 1fr));
	}
}
</style>
