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
import { ref, onMounted, onUnmounted, defineComponent } from "vue";
import { get, set, del } from "@/scripts/idb-proxy";
import { definePageMetadata } from "@/scripts/page-metadata";

const errorLog = ref("");

let intervalId;

const fetchErrorLog = async () => {
	errorLog.value = ((await get("errorLog")) || []).join("\n");
};

onMounted(() => {
	fetchErrorLog();
	intervalId = setInterval(fetchErrorLog, 30000);
});

onUnmounted(() => {
	clearInterval(intervalId);
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
