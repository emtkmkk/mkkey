<template>
	<div :class="[$style.root, { [$style.focused]: focused }]" @click="inputEl?.focus()">
		<span v-for="(tag, i) in tags" :key="`${i}:${tag}`" :class="$style.chip">
			{{ tag }}
			<button class="_button" :class="$style.remove" :aria-label="`${tag} を消す`" @click.stop="removeAt(i)">
				<i class="ph-x ph-bold"></i>
			</button>
		</span>
		<input
			ref="inputEl"
			v-model="draft"
			:class="$style.input"
			:placeholder="tags.length === 0 ? placeholder : ''"
			@keydown="onKeydown"
			@input="onInput"
			@compositionstart="composing = true"
			@compositionend="onCompositionEnd"
			@focus="focused = true"
			@blur="onBlur"
		/>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字のタグ（別名）の入力欄。空白で区切った語を、札（チップ）として並べる。
 *
 * @remarks
 * 値（v-model）は今までどおり「空白区切りの文字列」のまま扱う（下書きや API に渡す形を変えないため）。
 * - 半角・全角の空白、Enter、カンマで区切って札にする。欄から離れたときも、書きかけの語を札にする
 * - 日本語入力の変換中（composition）は区切らない（変換の確定に使う空白・Enter で札にならないように）
 * - 札の × で消せる。欄が空のときの Backspace で最後の札を消す
 * - 同じ語は 1 つにまとめる
 *
 * @internal
 */
import { computed, ref } from "vue";

const props = defineProps<{
	/** 空白区切りのタグ */
	modelValue: string;
	placeholder?: string;
}>();

const emit = defineEmits<{
	(ev: "update:modelValue", v: string): void;
}>();

/** 区切りに使う文字（半角・全角の空白、カンマ） */
const SEPARATOR = /[\s　,，、]+/;

const inputEl = ref<HTMLInputElement>();
const draft = ref("");
const composing = ref(false);
const focused = ref(false);

const tags = computed(() => props.modelValue.split(SEPARATOR).filter(Boolean));

/**
 * 札の一覧を値として返す。
 *
 * @param list - 札
 */
function commit(list: string[]): void {
	emit("update:modelValue", [...new Set(list)].join(" "));
}

/** 書きかけの語を札にする */
function flush(): void {
	const words = draft.value.split(SEPARATOR).filter(Boolean);
	draft.value = "";
	if (words.length > 0) commit([...tags.value, ...words]);
}

function removeAt(i: number): void {
	commit(tags.value.filter((_, j) => j !== i));
}

function onKeydown(ev: KeyboardEvent): void {
	if (composing.value || ev.isComposing) return;
	if (ev.key === "Enter") {
		ev.preventDefault();
		flush();
	} else if (ev.key === "Backspace" && draft.value === "" && tags.value.length > 0) {
		removeAt(tags.value.length - 1);
	}
}

/** 区切りの文字が入ったら、その手前までを札にする（貼り付けにも対応） */
function onInput(): void {
	if (composing.value) return;
	if (SEPARATOR.test(draft.value)) flush();
}

function onCompositionEnd(): void {
	composing.value = false;
	// 変換を確定した結果に全角空白などが入っていれば区切る
	if (SEPARATOR.test(draft.value)) flush();
}

function onBlur(): void {
	focused.value = false;
	flush();
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;
	min-height: 38px;
	padding: 4px 8px;
	box-sizing: border-box;
	border-radius: 6px;
	background: var(--panel);
	border: solid 1px var(--inputBorder);
	cursor: text;
}

.focused {
	border-color: var(--accent);
}

.chip {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: 1px 4px 1px 8px;
	border-radius: 6px;
	font-size: 0.9em;
	background: var(--accentedBg);
	color: var(--accent);
}

.remove {
	display: inline-flex;
	padding: 2px;
	font-size: 0.8em;
	opacity: 0.7;
}

.input {
	flex: 1;
	min-width: 6em;
	border: none;
	outline: none;
	background: transparent;
	color: var(--fg);
	font: inherit;
	height: 28px;
}
</style>
