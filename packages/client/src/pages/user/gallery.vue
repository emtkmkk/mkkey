<template>
	<MkSpacer :content-max="800">
		<MkPagination v-slot="{ items }" :pagination="pagination">
			<div class="jrnovfpt">
				<MkGalleryPostPreview
					v-for="post in items"
					:key="post.id"
					:post="post"
					class="post"
				/>
			</div>
		</MkPagination>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import * as misskey from "calckey-js";
import MkGalleryPostPreview from "@/components/MkGalleryPostPreview.vue";
import MkPagination from "@/components/MkPagination.vue";

const props = withDefaults(
	defineProps<{
		user: misskey.entities.User;
	}>(),
	{}
);

const pagination = {
	endpoint: "users/gallery/posts" as const,
	limit: 6,
	params: computed(() => ({
		userId: props.user.id,
	})),
};
</script>

<style lang="scss" scoped>
.jrnovfpt {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(16.25rem, 1fr));
	grid-gap: 0.75rem;
	margin: var(--margin);
}
</style>
