<template>
	<MkSpacer :content-max="800">
		<MkPagination v-slot="{ items }" ref="list" :pagination="pagination">
			<MkCategoryPreview
				v-for="category in items"
				:key="category.id"
				:category="category"
				class="_gap"
			/>
		</MkPagination>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import * as misskey from "calckey-js";
import MkCategoryPreview from "@/components/MkCategoryPreview.vue";
import MkPagination from "@/components/MkPagination.vue";

const props = defineProps<{
	user: misskey.entities.User;
}>();

const pagination = {
	endpoint: "users/categorys" as const,
	limit: 20,
	params: computed(() => ({
		userId: props.user.id,
	})),
};
</script>

<style lang="scss" scoped></style>
