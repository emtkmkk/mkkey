<template>
	<div class="tdflqwzn" :class="{ isMe }">
		<XReaction
			v-for="reaction in sortedReactions"
			:key="reaction.name"
			:reaction="reaction.name"
			:count="reaction.count"
			:is-initial="initialReactions.has(reaction.name)"
			:note="note"
		/>
	</div>
</template>

<script lang="ts" setup>
import { computed, unref } from "vue";
import * as misskey from "calckey-js";
import { $i } from "@/account";
import XReaction from "@/components/MkReactionsViewer.reaction.vue";

const props = defineProps<{
	note: misskey.entities.Note;
}>();


const reactions = computed(() => {
	let _reactions = {...props.note.reactions};

	if (props.note.tags && props.note.text?.includes("#ゴルベーザ四天王バトル")) {
		if (!_reactions["🅰"]) {
			_reactions["🅰"] = 0;
		}
		if (!_reactions["🅱"]) {
			_reactions["🅱"] = 0;
		}
	}

	const localReactions = Object.keys(_reactions).filter(x => x.endsWith("@.:"));
	const mergeReactions = {};
	
	localReactions.forEach((localReaction) => {
		const targetReactions = Object.keys(_reactions).filter(x => x.startsWith(localReaction.replace(".:","")));
		let totalCount = 0;
		targetReactions.forEach(x => {
			totalCount += _reactions[x];
			delete _reactions[x];
		});
		mergeReactions[localReaction] = totalCount;
	});
	return {...mergeReactions, ..._reactions};
});

const sortedReactions = computed(() => {
	const arrayReactions = Object.keys(reactions).map((x) => { return {name:x, count:reactions[x],}; }).sort((a,b) => b.count - a.count);
	return arrayReactions;
});

const initialReactions = new Set(Object.keys(unref(reactions)));

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
