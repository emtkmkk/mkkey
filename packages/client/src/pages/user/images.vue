<template>
	<MkSpacer :content-max="1100">
		<MkPagination v-slot="{items}" :pagination="pagination">
			<div :class="$style.stream">
				<MkMedias v-for="note in items" :note="note"/>
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
	endpoint: 'users/notes' as const,
	limit: 20,
	params: computed(() => ({
		userId: props.user.id,
		withFiles: true,
	})),
};
</script>

<style lang="scss" module>
.root {
	padding: 8px;
}

.stream {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	grid-gap: 6px;
}

@media (min-width: 720px) {
	.stream {
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
	}
}
</style>
