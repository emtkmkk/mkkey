<template>
	<div class="tdflqwzn" :class="{ isMe }">
		<XReaction
			v-for="(count, reaction) in note.reactions"
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

const localReactions = props.note.reactions.filter(x => x.type?.endsWith("@.:") || !x.type?.includes("@"))

let _reaction = props.note.reactions;
let mergeReactions = [];

for (localreaction in localReactions) {
	const targetReactions = props.note.reactions.filter(x => x.type?.startsWith(localreaction.type));
	_reaction = _reaction.filter(x => x.type !== targetReactions.type);
	localreaction.count = targetReactions.reduce((acc,value) => acc + value.count);
	mergeReactions.push(localreaction);
}

mergeReactions.concat(_reaction);

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
