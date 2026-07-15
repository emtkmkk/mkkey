<template>
	<div
		v-if="!muted.muted"
		v-show="!isDeleted"
		ref="el"
		v-hotkey="keymap"
		v-size="{ max: [500, 450, 350, 300] }"
		class="lxwezrsl _block"
		:tabindex="!isDeleted ? '-1' : null"
		:class="{ renote: isRenote }"
	>
		<MkNoteSub
			v-for="note in conversation"
			:key="note.id"
			class="reply-to"
			:note="note"
		/>
		<MkNoteSub
			v-if="appearNote.reply"
			:note="appearNote.reply"
			class="reply-to"
		/>

		<div ref="noteEl" class="article" tabindex="-1">
			<MkNote
				ref="noteComponent"
				tabindex="-1"
				:note="appearNote"
				:detailedView="true"
				:pinned="props.pinned"
				:option="option"
			></MkNote>
		</div>

		<MkNoteSub
			v-for="note in directReplies"
			:key="note.id"
			:note="note"
			class="reply"
			:conversation="replies"
		/>
	</div>
	<div v-else class="_tlPanel muted" @click="muted.muted = false">
		<I18n :src="softMuteReasonI18nSrc(muted.what)" tag="small">
			<template #name>
				<MkA
					v-user-preview="note.userId"
					class="name"
					:to="userPage(note.user)"
				>
					<MkUserName :user="note.user" maxlength="10" />
				</MkA>
			</template>
			<template #reason>
				{{ muted.matched.join(", ") }}
			</template>
		</I18n>
	</div>
</template>

<script lang="ts" setup>
import {
	inject,
	onMounted,
	onUnmounted,
	onUpdated,
	ref,
} from "vue";
import type * as misskey from "calckey-js";
import MkNote from "@/components/MkNote.vue";
import MkNoteSub from "@/components/MkNoteSub.vue";
import { getWordSoftMute } from "@/scripts/check-word-mute";
import { userPage } from "@/filters/user";
import { notePage } from "@/filters/note";
import * as os from "@/os";
import { defaultStore, noteViewInterruptors } from "@/store";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { useNoteCapture } from "@/scripts/use-note-capture";
import { deepClone } from "@/scripts/clone";
import { stream } from "@/stream";
import { NoteUpdatedEvent } from "calckey-js/built/streaming.types";

const props = defineProps<{
	note: misskey.entities.Note;
	pinned?: boolean;
	notAutoFocus?: boolean;
	option?: string;
}>();

const inChannel = inject("inChannel", null);

let note = $ref(deepClone(props.note));

const softMuteReasonI18nSrc = (what?: string) => {
	if (what === "note") return i18n.ts.userSaysSomethingReason;
	if (what === "reply") return i18n.ts.userSaysSomethingReasonReply;
	if (what === "renote") return i18n.ts.userSaysSomethingReasonRenote;
	if (what === "quote") return i18n.ts.userSaysSomethingReasonQuote;

	// I don't think here is reachable, but just in case
	return i18n.ts.userSaysSomething;
};

// plugin
if (noteViewInterruptors.length > 0) {
	onMounted(async () => {
		let result = deepClone(note);
		for (const interruptor of noteViewInterruptors) {
			result = await interruptor.handler(result);
		}
		note = result;
	});
}

const isRenote =
	note.renote != null &&
	note.text == null &&
	note.fileIds.length === 0 &&
	note.poll == null &&
	!note.invisible;

const el = ref<HTMLElement>();
const noteEl = $ref();
const noteComponent = ref<InstanceType<typeof MkNote>>();
let appearNote = $computed(() =>
	isRenote ? (note.renote as misskey.entities.Note) : note
);
const isDeleted = ref(false);
const muted = ref(getWordSoftMute(note, $i, defaultStore.state.mutedWords));
const conversation = ref<misskey.entities.Note[]>([]);
const replies = ref<misskey.entities.Note[]>([]);
const directReplies = ref<misskey.entities.Note[]>([]);
let isScrolling;

// NOTE: 返信・リアクション・RT・メニューは内側の MkNote（detailedView）にそのまま実装があるため、
// ここでは委譲するだけにする（重複実装のドリフト・未接続refによるクラッシュを避ける）
const keymap = {
	r: () => noteComponent.value?.reply(true),
	"e|a|plus": () => noteComponent.value?.react(true),
	q: () => noteComponent.value?.renote(true),
	esc: blur,
	"m|o": () => noteComponent.value?.menu(true),
	s: () => noteComponent.value?.toggleShowContent(),
};

useNoteCapture({
	rootEl: el,
	note: $$(appearNote),
	isDeletedRef: isDeleted,
});

function focus() {
	if (!props.notAutoFocus) {
		noteEl.focus();
	}
}

function blur() {
	noteEl.blur();
}

os.api("notes/children", {
	noteId: appearNote.id,
	limit: 30,
	depth: 12,
}).then((res) => {
	replies.value = res;
	directReplies.value = res
		.filter(
			(note) =>
				note.replyId === appearNote.id ||
				note.renoteId === appearNote.id
		)
		.reverse();
});

if (appearNote.replyId) {
	os.api("notes/conversation", {
		noteId: appearNote.replyId,
		limit: 30,
	}).then((res) => {
		conversation.value = res.reverse();
		focus();
	});
}

async function onNoteUpdated(noteData: NoteUpdatedEvent): Promise<void> {
	const { type, id, body } = noteData;

	let found = -1;
	if (id === appearNote.id) {
		found = 0;
	} else {
		for (let i = 0; i < replies.value.length; i++) {
			const reply = replies.value[i];
			if (reply.id === id) {
				found = i + 1;
				break;
			}
		}
	}

	if (found === -1) {
		return;
	}

	switch (type) {
		case "replied":
			const { id: createdId } = body;
			const replyNote = await os.api("notes/show", {
				noteId: createdId,
			});

			replies.value.splice(found, 0, replyNote);
			if (found === 0) {
				directReplies.value.push(replyNote);
			}
			break;

		case "deleted":
			if (found === 0) {
				isDeleted.value = true;
			} else {
				replies.value.splice(found - 1, 1);
			}
			break;
	}
}

document.addEventListener("wheel", () => {
	isScrolling = true;
});

onMounted(async () => {
	stream.on("noteUpdated", onNoteUpdated);
	isScrolling = false;
	noteEl?.scrollIntoView();
	if (!defaultStore.state.confirmShowImgCompress && note.files?.some((x) => x.originalUrl)) {
		const { canceled } = await os.yesno({
					type: "question",
					text: i18n.ts.loadOriginalImageConfirm,
				})
				defaultStore.set("loadOriginalImages", !canceled);
				defaultStore.set("confirmShowImgCompress", true);
				if (!canceled) location.reload();
	}
});

onUpdated(() => {
	if (!isScrolling) {
		noteEl?.scrollIntoView();
	}
});

onUnmounted(() => {
	stream.off("noteUpdated", onNoteUpdated);
});
</script>

<style lang="scss" scoped>
.lxwezrsl {
	font-size: 1.05em;
	position: relative;
	transition: box-shadow 0.1s ease;
	contain: content;

	&:focus-visible {
		outline: none;

		&:after {
			content: "";
			pointer-events: none;
			display: block;
			position: absolute;
			z-index: 10;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			margin: auto;
			width: calc(100% - 0.5rem);
			height: calc(100% - 0.5rem);
			border: solid 0.0625rem var(--focus);
			border-radius: var(--radius);
			box-sizing: border-box;
		}
	}

	&:hover > .article > .main > .footer > .button {
		opacity: 1;
	}
	> .reply-to {
		margin-bottom: -1rem;
		padding-bottom: 1rem;
	}

	> .renote {
		display: flex;
		align-items: center;
		padding: 1rem 2rem 0.5rem 2rem;
		line-height: 1.75rem;
		white-space: pre;
		color: var(--renote);

		> .avatar {
			flex-shrink: 0;
			display: inline-block;
			width: 1.75rem;
			height: 1.75rem;
			margin: 0 0.5rem 0 0;
			border-radius: 0.375rem;
		}

		> i {
			margin-right: 0.25rem;
		}

		> span {
			overflow: hidden;
			flex-shrink: 1;
			text-overflow: ellipsis;
			white-space: nowrap;

			> .name {
				font-weight: bold;
			}
		}

		> .info {
			margin-left: auto;
			font-size: 0.9em;

			> .time {
				flex-shrink: 0;
				color: inherit;

				> .dropdownIcon {
					margin-right: 0.25rem;
				}
			}
		}
	}

	> .renote + .article {
		padding-top: 0.5rem;
	}

	> .article {
		padding-block: 1.75rem 0.375rem;
		padding-top: 0.75rem;
		font-size: 1.1rem;
		overflow: clip;
		outline: none;
		scroll-margin-top: calc(var(--stickyTop) + (var(--vh, 1vh) * 20));
		:deep(.article) {
			cursor: unset;
		}
		&:first-of-type {
			padding-top: 1.75rem;
		}
	}

	> .reply {
		border-top: solid 0.03125rem var(--divider);
		cursor: pointer;
		padding-top: 1.5rem;
		padding-bottom: 0.625rem;
		@media (pointer: coarse) {
			cursor: default;
		}
	}

	// Hover
	.reply :deep(.main),
	.reply-to,
	:deep(.more) {
		position: relative;
		&::before {
			content: "";
			position: absolute;
			inset: -0.75rem -1.5rem;
			bottom: -0;
			background: var(--panelHighlight);
			border-radius: var(--radius);
			opacity: 0;
			transition: opacity 0.2s;
			z-index: -1;
		}
		&.reply-to {
			&::before {
				inset: 0 0.5rem;
			}
			&:not(.max-width_450px)::before {
				bottom: 0.75rem;
			}
			&:first-of-type::before {
				top: 0.75rem;
			}
			&.reply.max-width_500px:first-of-type::before {
				top: 0.25rem;
			}
		}
		// &::after {
		// 	content: "";
		// 	position: absolute;
		// 	inset: -9999px;
		// 	background: var(--modalBg);
		// 	opacity: 0;
		// 	z-index: -2;
		// 	pointer-events: none;
		// 	transition: opacity .2s;
		// }
		&.more::before {
			inset: 0 !important;
		}
		&:hover,
		&:focus-within {
			&::before {
				opacity: 1;
			}
		}
		// @media (pointer: coarse) {
		// 	&:has(.button:focus-within) {
		// 		z-index: 2;
		// 		--X13: transparent;
		// 		&::after {
		// 			opacity: 1;
		// 			backdrop-filter: var(--modalBgFilter);
		// 		}
		// 	}
		// }
	}

	&.max-width_500px {
		font-size: 0.9em;
	}
	&.max-width_450px {
		> .reply-to:first-child {
			padding-top: 0.875rem;
		}
		> .renote {
			padding: 0.5rem 1rem 0 1rem;
		}

		> .article {
			padding: 0.375rem 0 0 0;
			> .header > .body {
				padding-left: 0.625rem;
			}
		}
	}

	&.max-width_350px {
		> .article {
			> .main {
				> .footer {
					> .button {
						&:not(:last-child) {
							margin-right: 1.125rem;
						}
					}
				}
			}
		}
	}

	&.max-width_300px {
		font-size: 0.825em;

		> .article {
			> .main {
				> .footer {
					> .button {
						&:not(:last-child) {
							margin-right: 0.75rem;
						}
					}
				}
			}
		}
	}
}

.muted {
	padding: 0.5rem;
	text-align: center;
	opacity: 0.7;
}
</style>
