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
import * as config from "@/config";
import { $i } from "@/account";
import XReaction from "@/components/MkReactionsViewer.reaction.vue";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";

const props = defineProps<{
	note: misskey.entities.Note;
	multi?: boolean;
}>();

const reactions = computed(() => {
	let _reactions = { ...props.note.reactions };

	if (
		props.note.tags &&
		props.note.text?.includes("#ゴルベーザ百天王バトル")
	) {
		if (_reactions["🅰️"] == null) {
			_reactions["🅰️"] = 0;
		}
		if (_reactions["🅱️"] == null) {
			_reactions["🅱️"] = 0;
		}
	}

	const localReactions = Object.keys(_reactions).filter((x) =>
		x.includes("@")
	);
	const mergeReactions = {};
	const reactionMuted = defaultStore.state.reactionMutedWords.map((x) => {
		return {
			name: x.replaceAll(":", "").replace("@", ""),
			exact: /^:@?\w+:$/.test(x),
			hostmute: /^:?@[\w.-]/.test(x),
		};
	});

	localReactions.forEach((localReaction) => {
		if (!_reactions || _reactions.length === 0) return;
		const targetReactions = Object.keys(_reactions).filter((x) =>
			x.startsWith(localReaction.replace(/@[\w:\.\-]+:$/, "@"))
		);
		if (targetReactions?.length === 0) return;
		let totalCount = 0;
		let maxReaction = {
			reaction: localReaction,
			count: _reactions[localReaction],
		};
		targetReactions.forEach((x) => {
			if (
				!localReaction.endsWith("@.:") &&
				maxReaction.count < _reactions[x]
			) {
				maxReaction = { reaction: x, count: _reactions[x] };
			}
			totalCount += _reactions[x];
			delete _reactions[x];
		});

		//ミュートリアクション判定
		if (
			reactionMuted.some((x) => {
				const emojiName = localReaction
					.replace(":", "")
					.replace(/@[\w:\.\-]+:$/, "");
				const emojiHost = localReaction
					.replace(/^:[\w:\.\-]+@/, "")
					.replace(":", "");
				return (
					(defaultStore.state.remoteReactionMute &&
						emojiHost &&
						emojiHost !== "." &&
						emojiHost !== config.host) ||
					(!x.hostmute && !x.exact && emojiName.includes(x.name)) ||
					(!x.hostmute && x.name === emojiName) ||
					(x.hostmute && !x.exact && emojiHost.includes(x.name)) ||
					(x.hostmute && x.name === emojiHost)
				);
			})
		)
			totalCount = 0;

		mergeReactions[maxReaction.reaction] = totalCount;
	});
	return { ...mergeReactions, ..._reactions };
});

let lastSortedReactions = ["🅰️", "🅱️"];

const sortedReactions = computed(() => {
	const arrayReactions = Object.keys(reactions.value)
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
