<template>
	<button
		v-if="canRenote && showSeparateQuoteButton"
		v-tooltip.bottom="i18n.ts.quote"
		class="eddddedb _button"
		@click="quote()"
	>
		<i class="ph-quotes ph-bold ph-lg"></i>
	</button>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * リノートとは別に「引用」専用ボタンを出すコンポーネント。
 *
 * @remarks
 * 外観の `seperateRenoteQuote` がオンのとき表示するが、非フォロワー誤爆防止がオンかつ
 * 投稿者が閲覧者をフォローしていない他人ノートでは `effectiveSeparateRenoteQuoteForNote` により非表示にし、引用は RT メニューから開く。
 *
 * @public
 */
import { computed } from "vue";
import type * as misskey from "calckey-js";
import { pleaseLogin } from "@/scripts/please-login";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { effectiveSeparateRenoteQuoteForNote } from "@/scripts/stranger-air-reply-toolbar";

const props = defineProps<{
	note: misskey.entities.Note;
}>();

const canRenote = computed(
	() =>
		["public", "home"].includes(props.note.visibility) ||
		props.note.userId === $i?.id,
);

/** 外観設定＋非フォロワー誤爆防止による実効の「引用を別ボタン」 */
const showSeparateQuoteButton = computed(() =>
	effectiveSeparateRenoteQuoteForNote(props.note),
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
