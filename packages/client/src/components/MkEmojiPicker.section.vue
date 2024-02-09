<template>
	<!-- このコンポーネントの要素のclassは親から利用されるのでむやみに弄らないこと -->
	<section>
		<header class="_acrylic" @click="shown = !shown">
			<i
				class="toggle ph-fw ph-lg"
				:class="
					shown
						? 'ph-caret-down-bold ph-lg'
						: 'ph-caret-up ph-bold ph-lg'
				"
			></i>
			<slot></slot> ({{ emojis.length }})
		</header>
		<div v-if="shown" class="body">
			<template v-for="emoji in emojis">
				<button
					v-if="!errorEmojis.has(emoji)"
					:key="emoji"
					v-tooltip="emoji"
					class="_button item"
					@click="emit('chosen', emoji, $event)"
				>
					<MkEmoji
						class="emoji"
						:emoji="emoji"
						:normal="true"
						:isPicker="true"
						@loaderror="errorEmojis.add(emoji)"
					/>
				</button>
			</template>
		</div>
	</section>
</template>

<script lang="ts" setup>
import { ref } from "vue";

const props = defineProps<{
	emojis: string[];
	initialShown?: boolean;
}>();

const emit = defineEmits<{
	(ev: "chosen", v: string, event: MouseEvent): void;
}>();

const shown = ref(!!props.initialShown);
const errorEmojis = ref(new Set());
</script>

<style lang="scss" scoped></style>
