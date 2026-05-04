<template>
	<span v-if="resolvedName" :class="$style.menuRoot">
		<span :class="$style.menuCode">{{ displayCanonicalCode }}</span>{{ resolvedName }}
	</span>
	<span v-else>{{ menuCode }}</span>
</template>

<script lang="ts" setup>
/**
 * saize MFM 用インラインバッジ。
 *
 * @remarks
 * - データは `@/scripts/data/saize-menu-data` のマップを参照する。
 *
 * @public
 */
import { computed } from "vue";
import { saizeMenuItems } from "@/scripts/data/saize-menu-data";

const props = defineProps<{
	menuCode: string;
}>();

/** 商品コードパターン（4 文字・末尾 2 桁は数字） */
const SAIZE_MENU_CODE_RE = /^[a-zA-Z0-9]{2}[0-9]{2}$/;

const upperCode = computed(() => props.menuCode.trim().toUpperCase());

const validCode = computed(() => SAIZE_MENU_CODE_RE.test(props.menuCode.trim()));

/**
 * 表示用コード（先頭ゼロを壊さないよう parseInt は使わない）。
 * 正規表現通過時は必ず 4 文字。
 */
const displayCanonicalCode = computed(() =>
	validCode.value ? upperCode.value : "",
);

const resolvedName = computed(() => {
	if (!validCode.value) return null;
	return saizeMenuItems[upperCode.value] ?? null;
});
</script>

<style module>
.menuRoot {
	display: inline;
	box-sizing: border-box;
	border: 2px solid #0aa546;
	padding-right: 0.2em;
	border-radius: 6px;
	background-color: #0aa546;
	color: var(--fgOnAccent);
	font-weight: 700;
	font-size: 0.8em;
	line-height: calc(1.75em - 4px);
	box-decoration-break: clone;
}

.menuCode {
	display: inline;
	box-sizing: border-box;
	text-align: center;
	padding: 0 0.4em;
	border-radius: 4px;
	margin-right: 0.2em;
	line-height: calc(1.75em - 4px);
	background-color: var(--panel);
	color: #0aa546;
}
</style>
