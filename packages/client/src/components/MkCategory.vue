<template>
	<div
		v-if="category.contents"
		class="iroscrza center"
	>
		<XSection
			:key="'custom:' + category.id"
			:initial-shown="true"
			:emojis="
				category.contents
			"
			>{{ category.name }}</XSection
		>
	</div>
</template>

<script lang="ts">
import {
	ref,
	defineComponent,
	onMounted,
	nextTick,
	onUnmounted,
	PropType,
} from "vue";
import { url } from "@/config";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import XSection from "@/components/MkEmojiPicker.section.vue";

export default defineComponent({
	props: {
		category: {
			type: Array as PropType<string[]>,
			required: true,
		},
	},
	setup(props, ctx) {
		return {
			category
		};
	},
});
</script>

<style lang="scss" scoped>
.iroscrza {
	&.serif {
		> div {
			font-family: serif;
		}
	}

	&.center {
		text-align: center;
	}
}
</style>
