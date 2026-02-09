<template>
	<div class="tdflqwzn" :class="{ isMe }">
		<XReaction
			v-for="reaction in sortedReactions"
			:key="reaction.name"
			:reaction="reaction.name"
			:count="reaction.count"
			:is-initial="initialReactions.has(reaction.name)"
			:note="note"
			:multi="multi"
		/>
	</div>
</template>

<script lang="ts" setup>
import { computed, unref } from "vue";
import * as misskey from "calckey-js";
import { instance } from "@/instance";
import { $i } from "@/account";
import XReaction from "@/components/MkReactionsViewer.reaction.vue";
import { getVisibleReactions } from "@/scripts/reaction-utils";

const props = defineProps<{
	note: misskey.entities.Note;
	multi?: boolean;
}>();

const reactions = computed(() => getVisibleReactions(props.note));

let lastSortedReactions = ["🅰️", "🅱️"];

const sortedReactions = computed(() => {
	const arrayReactions = Object.keys(reactions.value)
		.filter((name) => {
			return name !== instance.defaultReaction;
		})
		.map((x) => {
			return { name: x, count: reactions.value[x] };
		})
		.sort((a, b) => {
			//前回取得時の並びを維持
			//前回取得時に存在したものを左に（位置を変えない為）
			//そうでない場合数順に
			const _a = a.name.replace(/@[\w:\.\-]+:$/, "@");
			const _b = b.name.replace(/@[\w:\.\-]+:$/, "@");
			return lastSortedReactions.includes(_a) &&
				lastSortedReactions.includes(_b)
				? lastSortedReactions.indexOf(_a) -
						lastSortedReactions.indexOf(_b)
				: lastSortedReactions.includes(_a)
				? -1
				: lastSortedReactions.includes(_b)
				? 1
				: b.count - a.count;
		});
	lastSortedReactions = arrayReactions.map((x) =>
		x.name.replace(/@[\w:\.\-]+:$/, "@")
	);
	return arrayReactions;
});

const initialReactions = new Set(Object.keys(unref(reactions)));

const isMe = computed(() => $i && $i.id === props.note.userId);
</script>

<style lang="scss" scoped>
.tdflqwzn {
	margin-inline: -0.125rem;
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
