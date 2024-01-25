<template>
  <XModalWindow ref="dialog" @click="cancel()" @close="cancel()" @closed="$emit('closed')" >
    <template #header>{{ name }}</template>
			<XEmojiDetailed 
				:emoji="emoji"
			/>
  </XModalWindow>
</template>

<script lang="ts" setup>
import * as Misskey from 'calckey-js';
import { defineProps } from 'vue';
import XModalWindow from "@/components/MkModalWindow.vue";
import XEmojiDetailed from "@/components/MkCustomEmojiDetailed.vue";
const props = defineProps<{
  emoji: any,
}>();
const emit = defineEmits<{
	(ev: 'ok', cropped: Misskey.entities.DriveFile): void;
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();
const dialog = $ref<InstanceType<typeof XModalWindow>>();
const cancel = () => {
	console.log('cancel');
	emit('cancel');
	dialog.close();
};

const name = typeof props.emoji === "string" ? props.emoji : props.emoji ? `:${props.emoji.name}${props.emoji.host ? '@' + props.emoji.host : ''}:` : '';
</script>
