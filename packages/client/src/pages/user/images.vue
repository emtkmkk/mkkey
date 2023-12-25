<template>
	<MkSpacer :content-max="1100">
		<MkButton
			style="text-align: center; margin: auto; margin-top: calc(var(--margin) / 2);"
			v-if="!showImages"
			@click="showImages = true">
			{{ "画像一覧を読み込む" }}
		</MkButton>
		<template v-if="showImages">
			<MkPagination v-slot="{items}" :pagination="pagination">
				<div :class="$style.stream">
					<MkMedias v-for="note in items" :note="note"/>
				</div>
			</MkPagination>
		</template>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref, computed } from "vue";
import MkMedias from "@/components/MkMedias.vue";
import MkPagination from "@/components/MkPagination.vue";
import * as misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import { defaultStore } from "@/store";

let showImages = ref(!defaultStore.state.enableDataSaverMode);

const props = defineProps<{
	user: misskey.entities.User;
}>();

const pagination = {
	endpoint: 'users/notes' as const,
	limit: 10,
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
