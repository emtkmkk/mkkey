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

const localReactions = Object.keys(props.note.reactions)?.filter(x => x.endsWith("@.:") || !x.includes("@"));

let _reactions = props.note.reactions;
let mergeReactions = {};

for (localReaction in localReactions) {
	const targetReactions = Object.keys(_reactions).filter(x => x.startsWith(localReaction.type.slice(0,-1));
	let totalCount = 0;
	targetReactions.forEach(x => {
		totalCount += _reaction[x];
		delete _reaction[x];
	})
	mergeReactions[localReaction] = totalCount;
}

mergeReactions = {...mergeReactions,..._reactions};

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
