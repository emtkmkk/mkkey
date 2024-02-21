<template>
	<button
		v-if="canRenote"
		ref="buttonRef"
		v-tooltip.bottom="i18n.ts.renote"
		class="eddddedb _button canRenote"
		@click="renote(false, $event)"
	>
		<i v-if="!renoteCompleted" class="ph-repeat ph-bold ph-lg"></i>
		<i v-else class="ph-repeat ph-bold ph-lg ph-fill success"></i>
		<p v-if="count > 0" class="count">{{ count }}</p>
	</button>
	<button v-else class="eddddedb _button">
		<i class="ph-lock-simple ph-bold ph-lg"></i>
	</button>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import type * as misskey from "calckey-js";
import Ripple from "@/components/MkRipple.vue";
import XDetails from "@/components/MkUsersTooltip.vue";
import { pleaseLogin } from "@/scripts/please-login";
import * as os from "@/os";
import { $i } from "@/account";
import { useTooltip } from "@/scripts/use-tooltip";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";

const props = defineProps<{
	note: misskey.entities.Note;
	count: number;
}>();

const buttonRef = ref<HTMLElement>();

const renoteCompleted = ref(false);

const canRenote = computed(
	() =>
		["public", "home"].includes(props.note.visibility) ||
		props.note.userId === $i.id
);

useTooltip(buttonRef, async (showing) => {
	const renotes = await os.api("notes/renotes", {
		noteId: props.note.id,
		limit: 11,
	});

	const users = renotes.map((x) => x.user);

	if (users.length < 1) return;

	os.popup(
		XDetails,
		{
			showing,
			users,
			count: props.count,
			targetElement: buttonRef.value,
		},
		{},
		"closed"
	);
});

const renote = async (viaKeyboard = false, ev?: MouseEvent) => {
	pleaseLogin();

	const renotes = await os.api("notes/renotes", {
		noteId: props.note.id,
		limit: 11,
	});

	const users = renotes.map((x) => x.user.id);
	const hasRenotedBefore = users.includes($i.id);

	let buttonActions = [];

	if (props.note.visibility === "public" && !props.note.localOnly && !$i?.isSilenced) {
		buttonActions.push({
			text: i18n.ts.renote,
			textStyle: "font-weight: bold",
			icon: "ph-repeat ph-bold ph-lg",
			danger: false,
			action: () => {
				doRenote(
					{
						renoteId: props.note.id,
						visibility: "public",
						localOnly: false,
					},
					ev
				);
			},
		});
	}

	if (
		["public", "home"].includes(props.note.visibility) &&
		!props.note.localOnly && !$i?.isSilenced
	) {
		buttonActions.push({
			text: i18n.ts.renoteAsUnlisted,
			icons: ["ph-repeat ph-bold ph-lg", "ph-house ph-bold ph-lg"],
			danger: false,
			action: () => {
				doRenote(
					{
						renoteId: props.note.id,
						visibility: "home",
						localOnly: false,
					},
					ev
				);
			},
		});
	}

	if (["public"].includes(props.note.visibility) && !$i?.isSilenced) {
		buttonActions.push({
			text:
				props.note.localOnly && props.note.userId !== $i.id
					? i18n.ts.renoteToLFLF
					: i18n.ts.renoteToLocalFollowers,
			icons: ["ph-repeat ph-bold ph-lg", "ph-hand-heart ph-bold ph-lg"],
			danger: false,
			action: () => {
				doRenote(
					{
						renoteId: props.note.id,
						visibility: "public",
						localOnly: true,
					},
					ev
				);
			},
		});
	}

	if (
		["public", "home"].includes(props.note.visibility) &&
		props.note.localOnly && !$i?.isSilenced
	) {
		buttonActions.push({
			text: i18n.ts.renoteToLFLFHome,
			icons: [
				"ph-repeat ph-bold ph-lg",
				"ph-hand-heart ph-bold ph-lg",
				"ph-house ph-bold ph-lg",
			],
			danger: false,
			action: () => {
				doRenote(
					{
						renoteId: props.note.id,
						visibility: "home",
						localOnly: true,
					},
					ev
				);
			},
		});
	}

	if (props.note.visibility === "specified") {
		buttonActions.push({
			text: i18n.ts.renoteToRecipients,
			icons: [
				"ph-repeat ph-bold ph-lg",
				"ph-envelope-simple-open ph-bold ph-lg",
			],
			danger: false,
			action: () => {
				doRenote(
					{
						renoteId: props.note.id,
						visibility: "specified",
						visibleUserIds: props.note.visibleUserIds,
					},
					ev
				);
			},
		});
	} else {
		buttonActions.push({
			text:
				props.note.localOnly && props.note.userId !== $i.id
					? i18n.ts.renoteToLFLFFollowers
					: i18n.ts.renoteToFollowers,
			icons:
				props.note.localOnly && props.note.userId !== $i.id
					? [
							"ph-repeat ph-bold ph-lg",
							"ph-hand-heart ph-bold ph-lg",
							"ph-lock-simple ph-bold ph-lg",
					  ]
					: [
							"ph-repeat ph-bold ph-lg",
							"ph-lock-simple ph-bold ph-lg",
					  ],
			danger: false,
			action: () => {
				doRenote(
					{
						renoteId: props.note.id,
						visibility: "followers",
					},
					ev
				);
			},
		});
	}

	if (!defaultStore.state.seperateRenoteQuote) {
		buttonActions.push({
			text: i18n.ts.quote,
			icon: "ph-quotes ph-bold ph-lg",
			danger: false,
			action: () => {
				os.post({
					renote: props.note,
				});
			},
		});
	}

	if (hasRenotedBefore) {
		buttonActions.push({
			text: i18n.ts.unrenote,
			icon: "ph-trash ph-bold ph-lg",
			danger: true,
			action: () => {
				os.api("notes/unrenote", {
					noteId: props.note.id,
				});
			},
		});
	}
	os.popupMenu(buttonActions, buttonRef.value, { viaKeyboard });
};

async function doRenote(data, ev?: MouseEvent) {
	if (renoteCompleted.value) {
		const { canceled } = await os.yesno({
			type: "question",
			text: "この投稿は先程RTした様です。再度RTしますか？",
		});
		if (canceled) {
			return;
		}
	}
	const el =
		ev &&
		((ev.currentTarget ?? ev.target) as HTMLElement | null | undefined);
	if (el) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + el.offsetWidth / 2;
		const y = rect.top + el.offsetHeight / 2;
		os.popup(Ripple, { x, y }, {}, "end");
		renoteCompleted.value = true;
	}
	return os.api("notes/create", data);
}
</script>

<style lang="scss" scoped>
.eddddedb {
	display: inline-block;
	height: 2rem;
	margin: 0.125rem;
	padding: 0 0.375rem;
	border-radius: 0.25rem;

	&:not(.canRenote) {
		cursor: default;
	}

	&.renoted {
		background: var(--accent);
	}

	> .count {
		display: inline;
		margin-left: 0.5rem;
		opacity: 0.7;
	}
}
.success {
	color: var(--success);
}
</style>
