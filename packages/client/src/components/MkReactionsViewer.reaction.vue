<template>
	<button
		v-if="count > 0 || ['🅰️', '🅱️'].includes(reaction)"
		ref="buttonRef"
		v-ripple="canToggle && !defaultStore.state.showReactionMenu"
		class="hkzvhatu _button"
		:class="{
			reacted,
			canToggle,
			newlyAdded: !isInitial,
		}"
		@click="toggleReaction"
	>
		<XReactionIcon
			class="icon"
			:reaction="
				reacted && note.myReaction !== reaction && !multi
					? note.myReaction
					: reaction
			"
			:custom-emojis="note.emojis"
		/>
		<span
			v-if="!$store.state.hiddenReactionNumber"
			class="count"
			:class="{
				'count-increased': countChanged === 'increased',
				'count-decreased': countChanged === 'decreased',
			}"
			>{{ count }}</span
		>
	</button>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import * as misskey from "calckey-js";
import XDetails from "@/components/MkReactionsViewer.details.vue";
import XReactionIcon from "@/components/MkReactionIcon.vue";
import * as os from "@/os";
import { useTooltip } from "@/scripts/use-tooltip";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { openReactionMenu_ } from "@/scripts/reaction-menu";
import * as sound from "@/scripts/sound.js";

const props = defineProps<{
	reaction: string;
	count: number;
	isInitial: boolean;
	note: misskey.entities.Note;
	multi?: boolean;
}>();

const buttonRef = ref<HTMLElement>();

const countChanged = ref(null);

const canToggle = computed(
	() => $i && (!$i.isSilenced || props.note.user.isFollowed)
);

const reacted = computed(() => {
	return props.multi
		? props.note.myReactions &&
				props.note.myReactions.some(
					(x) =>
						x?.replace(/@[\w:\.\-]+:$/, "@") ===
						props.reaction?.replace(/@[\w:\.\-]+:$/, "@")
				)
		: props.note.myReaction &&
				props.note.myReaction?.replace(/@[\w:\.\-]+:$/, "@") ===
					props.reaction?.replace(/@[\w:\.\-]+:$/, "@");
});

async function toggleReaction(event) {
	if (defaultStore.state.showReactionMenu) {
		const el =
			event &&
			((event.currentTarget ?? event.target) as
				| HTMLElement
				| null
				| undefined);
		await openReactionMenu_(
			props.reaction?.replace("@.", ""),
			props.note,
			canToggle.value,
			props.multi,
			el
		);
	} else {
		if (!canToggle.value) return;

		if (props.multi) {
			if (reacted.value) {
				const confirm = await os.confirm({
					type: "warning",
					text: i18n.ts.cancelReactionConfirm,
				});
				if (confirm.canceled) return;

				os.api("notes/reactions/delete", {
					noteId: props.note.id,
					reaction: props.reaction,
				});
			} else {
				os.api("notes/reactions/create", {
					noteId: props.note.id,
					reaction: props.reaction,
				}).then(() => {
					sound.play("reaction");
				});
			}
		} else {
			const oldReaction = props.note.myReaction;
			if (oldReaction && reacted.value) {
				const confirm = await os.confirm({
					type: "warning",
					text: i18n.ts.cancelReactionConfirm,
				});
				if (confirm.canceled) return;
				os.api("notes/reactions/delete", {
					noteId: props.note.id,
					reaction: props.reaction,
				}).then(() => {
					if (false) {
						os.api("notes/reactions/create", {
							noteId: props.note.id,
							reaction: props.reaction,
						}).then(() => {
							sound.play("reaction");
						});
					}
				});
			} else if (!oldReaction) {
				os.api("notes/reactions/create", {
					noteId: props.note.id,
					reaction: props.reaction,
				}).then(() => {
					sound.play("reaction");
				});
			}
		}
	}
}

watch(
	() => props.count,
	(newVal, oldVal) => {
		if (newVal > oldVal) {
			// 増加時の処理
			countChanged.value = "increased";
		} else if (newVal < oldVal) {
			// 減少時の処理
			countChanged.value = "decreased";
		}

		setTimeout(() => {
			countChanged.value = null;
		}, 500); // 500ms後にリセット
	}
);

useTooltip(
	buttonRef,
	async (showing) => {
		const reactions = await os.apiGet("notes/reactions", {
			noteId: props.note.id,
			type: props.reaction.replace(/@[\w:\.\-]+:$/, "@.:"),
			limit: 11,
			_cacheKey_: props.count,
		});

		const users = reactions.map((x) => x.user);

		const popupReaction = props.multi
			? props.reaction
			: reacted.value && props.note.myReaction !== props.reaction.value
			? props.note.myReaction
			: props.reaction;

		os.popup(
			XDetails,
			{
				showing,
				reaction: popupReaction,
				emojis: props.note.emojis,
				users,
				count: props.count,
				targetElement: buttonRef.value,
			},
			{},
			"closed"
		);
	},
	100
);
</script>

<style lang="scss" scoped>
@keyframes textColorChanged {
	0%,
	100% {
		color: inherit;
	}
	25%,
	75% {
		color: var(--accent);
	}
}
@keyframes textColorChangedRev {
	0%,
	100% {
		color: var(--accent);
	}
	25%,
	75% {
		color: var(--fg);
	}
}
.hkzvhatu {
	display: inline-block;
	height: 2rem;
	margin: 0.125rem;
	padding: 0 0.375rem;
	border-radius: 0.25rem;
	pointer-events: all;
	&.newlyAdded {
		animation: scaleInSmall 0.3s cubic-bezier(0, 0, 0, 1.2);
		:deep(.mk-emoji) {
			animation: scaleIn 0.4s cubic-bezier(0.7, 0, 0, 1.5);
		}
	}
	:deep(.mk-emoji) {
		transition: transform 0.4s cubic-bezier(0, 0, 0, 6);
	}
	&.reacted :deep(.mk-emoji) {
		transition: transform 0.4s cubic-bezier(0, 0, 0, 1);
	}
	&:active {
		:deep(.mk-emoji) {
			transition: transform 0.4s cubic-bezier(0, 0, 0, 1);
			transform: scale(0.85);
		}
	}
	&.canToggle {
		background: rgba(0, 0, 0, 0.05);

		&:hover {
			background: rgba(0, 0, 0, 0.1);
		}
	}

	&:not(.canToggle) {
		cursor: default;
	}

	&.reacted,
	&.reacted:hover {
		background: var(--accentedBg);
		color: var(--accent);
		box-shadow: 0 0 0 0.0625rem var(--accent) inset;

		> .count {
			color: var(--accent);
			font-weight: 600;
		}

		> .icon {
			filter: drop-shadow(0 0 0.125rem rgba(0, 0, 0, 0.5));
		}
	}

	&.reacted,
	&.reacted:hover {
		background: var(--accentedBg);
		color: var(--accent);
		border: 0.0625rem solid var(--accent);
	}

	> .count {
		font-size: 0.9em;
		line-height: 2rem;
		margin: 0 0 0 0.25rem;

		&:not(.reacted).count-increased {
			animation: textColorChanged 1s;
		}

		&:not(.reacted).count-decreased {
			animation: textColorChanged 1s;
		}

		&.reacted.count-increased,
		&.reacted:hover.count-increased {
			animation: textColorChangedRev 1s;
		}

		&.reacted.count-decreased,
		&.reacted:hover.count-decreased {
			animation: textColorChangedRev 1s;
		}
	}
}
</style>
