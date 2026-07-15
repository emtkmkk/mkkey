<template>
	<MkSpacer :content-max="1100">
		<MkPagination v-slot="{ items }" :pagination="pagination">
			<div :class="$style.stream">
				<MkMedias v-for="note in items" :key="note.id" :note="note" />
			</div>
		</MkPagination>
	</MkSpacer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * プロフィール「メディア」タブ。添付ファイル付きノートをグリッド表示する。
 *
 * @remarks
 * - `users/notes` を `withFiles: true` で取得し、各ノートを {@link MkMedias} で描画する。
 * - NSFW 除外はサーバー側ではなく {@link MkMedias} 側のオーバーレイで行う。
 * - NOTE: `v-for` には必ず `:key="note.id"` を付けること。欠けると追加読込時に
 *   コンポーネント再利用でセンシティブ表示状態が別ノートへ引き継がれる。
 *
 * @see MkMedias
 * @see MkPagination
 *
 * @public
 */
import { computed } from "vue";
import MkMedias from "@/components/MkMedias.vue";
import MkPagination from "@/components/MkPagination.vue";
import * as misskey from "calckey-js";

const props = defineProps<{
	/** 表示対象ユーザー */
	user: misskey.entities.User;
}>();

/**
 * 添付ファイル付きノートのページング設定。
 *
 * @remarks
 * limit は初回 20 件。続きは {@link MkPagination} 側で untilId 取得する。
 */
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
