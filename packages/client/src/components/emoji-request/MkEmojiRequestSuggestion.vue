<template>
	<div :class="$style.root">
		<button
			v-if="state === 'apply'"
			class="_button"
			:class="[$style.text, $style.clickable]"
			@click="emit('apply')"
		>
			<i class="ph-lightbulb ph-bold"></i> 管理者の提案：<span :class="$style.value">{{ text }}</span>
		</button>
		<div v-else-if="state === 'applied'" :class="$style.text">
			<i class="ph-check ph-bold"></i> 管理者の提案を入れました
		</div>
		<div v-else :class="[$style.text, $style.plain]">
			<i class="ph-lightbulb ph-bold"></i> 管理者の提案：<span :class="$style.value">{{ text }}</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 再申請の画面で、入力欄の下に出す「管理者の提案：〇〇」（R2）。
 *
 * @remarks
 * 補足の説明文と同じ大きさ・アクセント色の文字で出す。ボタンの見た目にはしない。
 * - apply：押すと提案の値が入る（入力欄が空か、元の申請内容のままのとき）
 * - applied：提案の値が入っている
 * - plain：申請者がこの画面で書き換えた後。書き直したものを上書きしないよう、押しても何も起きない
 * どの状態にするかは申請ページ側で決める。
 *
 * @internal
 */
defineProps<{
	/** 提案の値を文にしたもの */
	text: string;
	state: "apply" | "applied" | "plain";
}>();

const emit = defineEmits<{
	(ev: "apply"): void;
}>();
</script>

<style lang="scss" module>
.root {
	margin: 4px 0 0;
}

.text {
	display: block;
	text-align: left;
	font-size: 0.85em;
	line-height: 1.6;
	color: var(--accent);
}

.clickable {
	text-decoration: underline dotted;
	text-underline-offset: 3px;
}

.plain {
	opacity: 0.7;
}

.value {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
</style>
