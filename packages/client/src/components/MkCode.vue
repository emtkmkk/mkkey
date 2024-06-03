<template>
	<template v-if="!inline">
		<div :class="$style.codeBlockRoot">
			<button :class="$style.codeBlockCopyButton" class="_button" @click="copy">
				<i class="ph-bold ph-lg ph-copy"></i>
			</button>
			<XCode :code="code" :lang="lang" :inline="inline" />
		</div>
	</template>
	<XCode v-else :code="code" :lang="lang" :inline="inline" />
</template>

<script lang="ts" setup>
import copyToClipboard from "@/scripts/copy-to-clipboard";
import { defineAsyncComponent } from "vue";
import * as os from "@/os";

const props = defineProps<{
	code: string;
	lang?: string;
	inline?: boolean;
}>();

function copy() {
	copyToClipboard(props.code);
	os.success();
}
const XCode = defineAsyncComponent(
	() => import("@/components/MkCode.core.vue")
);
</script>

<style module lang="scss">
.codeBlockRoot {
	position: relative;
}

.codeBlockCopyButton {
	position: absolute;
	top: 8px;
	right: 8px;
	opacity: 0.5;

	&:hover {
		opacity: 0.8;
	}
}
</style>
