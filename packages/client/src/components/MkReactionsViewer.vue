<template>
	<div class="tdflqwzn" :class="{ isMe }">
		<XReaction
			v-for="(count, reaction) in mergeReactions"
			:key="reaction"
			:reaction="reaction"
			:count="count"
			:is-initial="initialReactions.has(reaction)"
			:note="note"
		/>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import * as misskey from "calckey-js";
import { $i } from "@/account";
import XReaction from "@/components/MkReactionsViewer.reaction.vue";

const props = defineProps<{
	note: misskey.entities.Note;
}>();

const localReactions = Object.keys(props.note.reactions).filter(x => x.endsWith("@.:"));

let _reactions = props.note.reactions?.filter(x => true);
let mergeReactions = {};

for (const localReaction in localReactions) {
	const targetReactions = Object.keys(_reactions).filter(x => x.startsWith(localReaction.replace(".:","")));
	let totalCount = 0;
	targetReactions.forEach(x => {
		totalCount += _reactions[x];
		delete _reactions[x];
	});
	mergeReactions[localReaction] = totalCount;
}

mergeReactions = {...mergeReactions, ..._reactions};

const initialReactions = new Set(Object.keys(mergeReactions));

const isMe = computed(() => $i && $i.id === props.note.userId);
</script>

<style lang="scss" scoped>
.tdflqwzn {
	margin-inline: -2px;
	margin-top: 0.2em;
	width: 100%;

	&:empty {
		display: none;
	}

	&.isMe {
		> span {
			cursor: default !important;
		}
	}
}
</style>
