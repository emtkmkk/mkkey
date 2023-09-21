<template>
	<MkStickyContainer>
		<template #header><MkPageHeader /></template>
		<MkSpacer :content-max="800">
			<div :class="$style.root">
				<div>{{ errorLog }}</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, onMounted, defineComponent } from "vue";
import { get, set, del } from "@/scripts/idb-proxy";
import { definePageMetadata } from "@/scripts/page-metadata";

const errorLog = ref(""); // 反応性のある参照を初期化

// マウント時にエラーログを取得
onMounted(async () => {
	errorLog.value = (await get("errorLog") || []).join("\n");
});

definePageMetadata({
	title: "errorlog",
	icon: "ph-wrench ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.root {
	background: var(--bg);
	white-space: pre-wrap; 
	overflow-y: auto;
}
</style>
