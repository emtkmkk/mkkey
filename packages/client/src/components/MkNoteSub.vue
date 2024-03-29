<template>
	<div
		v-if="!muted.muted || muted.what === 'reply'"
		ref="el"
		v-size="{ max: [450, 500] }"
		class="wrpstxzv"
		:class="[
			{
				children: depth > 1,
				singleStart: replies.length == 1,
				firstColumn: depth == 1 && conversation,
			},
		]"
	>
		<div v-if="conversation && depth > 1" class="line"></div>
		<div
			class="main"
			@click="noteClick"
			:class="[
				{ colored: defaultStore.state.showVisibilityColor },
				`v-${
					appearNote.visibility === 'specified' && note.ccUserIdsCount
						? 'circle'
						: appearNote.visibility
				}`,
				{ localOnly: appearNote.localOnly },
			]"
		>
			<div class="avatar-container">
				<MkAvatar class="avatar" :user="appearNote.user" />
				<div
					v-if="!conversation || replies.length > 0"
					class="line"
				></div>
			</div>
			<div class="body">
				<XNoteHeader class="header" :note="note" :mini="true" />
				<div class="body">
					<MkSubNoteContent
						class="text"
						:note="note"
						:parentId="appearNote.parentId"
						:conversation="conversation"
						@focusfooter="footerEl.focus()"
						@changeShowContent="(v) => (showContent = v)"
					/>
					<div v-if="info" class="translation">
						<MkLoading v-if="!info.ready" mini />
						<div v-else class="translated">
							<b>{{ info.title }} </b>
							<span v-if="info.copy"> · </span>
							<a
								v-if="info.copy"
								@click.stop="copyToClipboard(info.copy)"
								>{{ i18n.ts.copy }}</a
							>
							<Mfm
								v-if="info.mfm"
								:text="info.text"
								:author="appearNote.user"
								:i="$i"
								:custom-emojis="appearNote.emojis"
							/>
							<div
								style="
									margin-top: 0.5em;
									white-space: pre-wrap;
									overflow-wrap: break-word;
								"
								v-else
							>
								{{ info.text }}
							</div>
						</div>
					</div>
					<div v-if="translating || translation" class="translation">
						<MkLoading v-if="translating" mini />
						<div v-else class="translated">
							<b
								>{{
									i18n.t("translatedFrom", {
										x: translation.sourceLang,
									})
								}}:
							</b>
							<Mfm
								:text="translation.text"
								:author="appearNote.user"
								:i="$i"
								:custom-emojis="appearNote.emojis"
							/>
						</div>
					</div>
				</div>
				<footer ref="footerEl" class="footer" @click.stop tabindex="-1">
					<XReactionsViewer
						v-if="enableEmojiReactions"
						v-show="showContent"
						ref="reactionsViewer"
						:note="appearNote"
					/>
					<button
						v-if="
							$i &&
							defaultStore.state.toolbarAirReply &&
							$i.id !== appearNote.userId &&
							(appearNote.visibility !== 'specified' ||
								(!appearNote?.user.host &&
									appearNote?.ccUserIdsCount))
						"
						v-tooltip.bottom="i18n.ts.airReply"
						class="button _button"
						@click="airReply()"
					>
						<i class="ph-paper-plane-tilt ph-bold ph-lg"></i>
					</button>
					<button
						v-tooltip.noDelay.bottom="i18n.ts.reply"
						class="button _button"
						@click="reply()"
					>
						<i class="ph-arrow-u-up-left ph-bold ph-lg"></i>
						<template v-if="appearNote.repliesCount > 0">
							<p class="count">{{ appearNote.repliesCount }}</p>
						</template>
					</button>
					<XRenoteButton
						ref="renoteButton"
						class="button"
						:note="appearNote"
						:count="appearNote.renoteCount"
					/>
					<XStarButtonNoEmoji
						v-if="!enableEmojiReactions || !showContent"
						class="button"
						:note="appearNote"
						:count="
							Object.values(appearNote.reactions).reduce(
								(partialSum, val) => partialSum + val,
								0
							)
						"
						:reacted="appearNote.myReaction != null"
					/>
					<XStarButton
						v-if="
							enableEmojiReactions &&
							appearNote.myReaction == null &&
							showContent
						"
						ref="starButton"
						class="button"
						:note="appearNote"
					/>
					<button
						v-if="
							enableEmojiReactions && !isMaxReacted && isCanAction
						"
						:title="
							multiReaction
								? (appearNote.myReactions?.length ?? 0) +
								  ' / ' +
								  maxReactions
								: ''
						"
						ref="reactButton"
						v-tooltip.bottom="
							i18n.ts.reaction +
							(multiReaction
								? ' (' +
								  (appearNote.myReactions?.length ?? 0) +
								  ' / ' +
								  maxReactions +
								  ')'
								: '')
						"
						class="button _button"
						:class="{
							unsupported:
								appearNote.user.instance
									?.maxReactionsPerAccount === 0,
						}"
						@click="react()"
					>
						<i
							v-if="multiReaction"
							class="ph-smiley-wink ph-bold ph-lg"
						></i>
						<i v-else class="ph-smiley ph-bold ph-lg"></i>
					</button>
					<button
						v-if="
							enableEmojiReactions &&
							appearNote.myReaction != null &&
							!multiReaction
						"
						ref="reactButton"
						class="button _button reacted"
						@click="undoReact(appearNote)"
					>
						<i class="ph-minus ph-bold ph-lg"></i>
					</button>
					<XQuoteButton class="button" :note="appearNote" />
					<button
						ref="menuButton"
						v-tooltip.noDelay.bottom="i18n.ts.more"
						class="button _button"
						@click="menu()"
					>
						<i class="ph-dots-three-outline ph-bold ph-lg"></i>
					</button>
				</footer>
			</div>
		</div>
		<template v-if="conversation">
			<template v-if="replyLevel < 11 && depth < 5">
				<template v-if="replies.length == 1">
					<MkNoteSub
						v-for="reply in replies"
						:key="reply.id"
						:note="reply"
						class="reply single"
						:conversation="conversation"
						:depth="depth"
						:replyLevel="replyLevel + 1"
						:parentId="appearNote.replyId"
					/>
				</template>
				<template v-else>
					<MkNoteSub
						v-for="reply in replies"
						:key="reply.id"
						:note="reply"
						class="reply"
						:conversation="conversation"
						:depth="depth + 1"
						:replyLevel="replyLevel + 1"
						:parentId="appearNote.replyId"
					/>
				</template>
			</template>
			<div v-else-if="replies.length > 0" class="more">
				<div class="line"></div>
				<MkA class="text _link" :to="notePage(note)"
					>{{ i18n.ts.continueThread }}
					<i class="ph-caret-double-right ph-bold ph-lg"></i
				></MkA>
			</div>
		</template>
	</div>
	<div v-else class="muted" @click="muted.muted = false">
		<I18n :src="softMuteReasonI18nSrc(muted.what)" tag="small">
			<template #name>
				<MkA
					v-user-preview="note.userId"
					class="name"
					:to="userPage(note.user)"
				>
					<MkUserName :user="note.user" />
				</MkA>
			</template>
			<template #reason>
				{{ muted.matched.join(", ") }}
			</template>
		</I18n>
	</div>
</template>

<script lang="ts" setup>
import { inject, ref } from "vue";
import type { Ref } from "vue";
import * as misskey from "calckey-js";
import XNoteHeader from "@/components/MkNoteHeader.vue";
import MkSubNoteContent from "@/components/MkSubNoteContent.vue";
import XReactionsViewer from "@/components/MkReactionsViewer.vue";
import XStarButton from "@/components/MkStarButton.vue";
import XStarButtonNoEmoji from "@/components/MkStarButtonNoEmoji.vue";
import XRenoteButton from "@/components/MkRenoteButton.vue";
import XQuoteButton from "@/components/MkQuoteButton.vue";
import { pleaseLogin } from "@/scripts/please-login";
import { getNoteMenu } from "@/scripts/get-note-menu";
import { getWordSoftMute } from "@/scripts/check-word-mute";
import { notePage } from "@/filters/note";
import { useRouter } from "@/router";
import { userPage } from "@/filters/user";
import * as os from "@/os";
import { reactionPicker } from "@/scripts/reaction-picker";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { useNoteCapture } from "@/scripts/use-note-capture";
import { defaultStore } from "@/store";
import { deepClone } from "@/scripts/clone";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import * as sound from "@/scripts/sound.js";

const router = useRouter();

const props = withDefaults(
	defineProps<{
		note: misskey.entities.Note;
		conversation?: misskey.entities.Note[];
		parentId?;

		// how many notes are in between this one and the note being viewed in detail
		depth?: number;
		// the actual reply level of this note within the conversation thread
		replyLevel?: number;
	}>(),
	{
		depth: 1,
		replyLevel: 1,
	}
);

let note = $ref(deepClone(props.note));

const multiReaction =
	$i &&
	$i.patron &&
	(!props.note.user.host ||
		props.note.user.instance?.maxReactionsPerAccount > 1);
const maxReactions = multiReaction
	? Math.min(props.note.user.instance?.maxReactionsPerAccount ?? 3, 64)
	: 1;
const isCanAction = $i && (!$i.isSilenced || props.note.user.isFollowed);
const isMaxReacted = $computed(() =>
	multiReaction
		? props.note.myReactions?.length >= maxReactions
		: props.note.myReaction != null
);

const showContent = ref(false);

const softMuteReasonI18nSrc = (what?: string) => {
	if (what === "note") return i18n.ts.userSaysSomethingReason;
	if (what === "reply") return i18n.ts.userSaysSomethingReasonReply;
	if (what === "renote") return i18n.ts.userSaysSomethingReasonRenote;
	if (what === "quote") return i18n.ts.userSaysSomethingReasonQuote;

	// I don't think here is reachable, but just in case
	return i18n.ts.userSaysSomething;
};

const isRenote =
	note.renote != null &&
	note.text == null &&
	note.fileIds.length === 0 &&
	note.poll == null;

const el = ref<HTMLElement>();
const footerEl = ref<HTMLElement>();
const menuButton = ref<HTMLElement>();
const starButton = ref<InstanceType<typeof XStarButton>>();
const renoteButton = ref<InstanceType<typeof XRenoteButton>>();
const reactButton = ref<HTMLElement>();
let appearNote = $computed(() =>
	isRenote ? (note.renote as misskey.entities.Note) : note
);
const isDeleted = ref(false);
const muted = ref(getWordSoftMute(note, $i, defaultStore.state.mutedWords));
const translation = ref(null);
const translating = ref(false);
const info = ref(null);
const replies: misskey.entities.Note[] =
	props.conversation
		?.filter(
			(item) =>
				item.replyId === props.note.id ||
				item.renoteId === props.note.id
		)
		.reverse() ?? [];
const enableEmojiReactions = defaultStore.state.enableEmojiReactions;

useNoteCapture({
	rootEl: el,
	note: $$(appearNote),
	isDeletedRef: isDeleted,
});

function reply(viaKeyboard = false): void {
	pleaseLogin();
	os.post({
		reply: appearNote,
		animation: !viaKeyboard,
	}).then(() => {
		focus();
	});
}

function airReply(viaKeyboard = false): void {
	const v =
		appearNote.user.host != null && appearNote.visibility === "public"
			? "home"
			: appearNote.visibility;
	os.post({
		airReply: appearNote,
		initialVisibility: v,
		initialLocalOnly: appearNote.user.host == null,
		key: appearNote.id,
		animation: !viaKeyboard,
	}).then(() => {
		focus();
	});
}

function react(viaKeyboard = false): void {
	pleaseLogin();
	blur();
	reactionPicker.show(
		reactButton.value,
		(reaction) => {
			os.api("notes/reactions/create", {
				noteId: appearNote.id,
				reaction: reaction,
			}).then(() => {
				sound.play("reaction");
			});
		},
		() => {
			focus();
		}
	);
}

function undoReact(note): void {
	const oldReaction = note.myReaction;
	if (!oldReaction) return;
	os.api("notes/reactions/delete", {
		noteId: note.id,
	});
}

const currentClipPage = inject<Ref<misskey.entities.Clip> | null>(
	"currentClipPage",
	null
);

function menu(viaKeyboard = false): void {
	os.popupMenu(
		getNoteMenu({
			note: note,
			translating,
			translation,
			menuButton,
			isDeleted,
			currentClipPage,
			info,
		}),
		menuButton.value,
		{
			viaKeyboard,
		}
	).then(focus);
}

function focus() {
	el.value.focus();
}

function blur() {
	el.value.blur();
}

function noteClick(e) {
	if (document.getSelection().type === "Range") {
		e.stopPropagation();
	} else {
		router.push(notePage(props.note));
	}
}
</script>

<style lang="scss" scoped>
.wrpstxzv {
	padding: 1rem 2rem;
	&.children {
		padding: 0.625rem 0 0 var(--indent);
		padding-left: var(--indent) !important;
		font-size: 1em;
		cursor: auto;

		&.max-width_450px {
			padding: 0.625rem 0 0 0.5rem;
		}
	}

	> .main {
		display: flex;
		cursor: pointer;

		> .avatar-container {
			margin-right: 0.5rem;
			> .avatar {
				flex-shrink: 0;
				display: block;
				width: 2.375rem;
				height: 2.375rem;
				border-radius: 0.5rem;
			}
		}

		> .body {
			flex: 1;
			min-width: 0;
			margin: 0 -12.5rem;
			padding: 0 12.5rem;
			overflow: clip;
			@media (pointer: coarse) {
				cursor: default;
			}

			> .header {
				margin-bottom: 0.125rem;
				cursor: auto;
			}

			> .body {
				> .translation {
					border: solid 0.03125rem var(--divider);
					border-radius: var(--radius);
					padding: 0.75rem;
					margin-top: 0.5rem;
				}
			}
			> .footer {
				position: relative;
				z-index: 2;
				display: flex;
				flex-wrap: wrap;
				pointer-events: none; // Allow clicking anything w/out pointer-events: all; to open post

				> .button {
					margin: 0;
					padding: 0.5rem;
					opacity: 0.7;
					flex-grow: 1;
					max-width: 3.5em;
					width: max-content;
					min-width: max-content;
					pointer-events: all;
					transition: opacity 0.2s;
					&:first-of-type {
						margin-left: -0.5em;
					}
					&:hover {
						color: var(--fgHighlighted);
					}

					> .count {
						display: inline;
						margin: 0 0 0 0.5rem;
						opacity: 0.7;
					}

					&.reacted {
						color: var(--accent);
					}

					> .unsupported {
						opacity: 0.15 !important;
					}
				}
			}
		}
	}
	&:first-child > .main > .body {
		margin-top: -12.5rem;
		padding-top: 12.5rem;
	}
	&.reply {
		--avatarSize: 2.375rem;
		.avatar-container {
			margin-right: 0.5rem !important;
		}
	}
	> .reply,
	> .more {
		margin-top: 0.625rem;
		&.single {
			padding: 0 !important;
			> .line {
				display: none;
			}
		}
	}

	> .more {
		display: flex;
		padding-block: 0.625rem;
		font-weight: 600;
		> .line {
			flex-grow: 0 !important;
			margin-top: -0.625rem !important;
			margin-bottom: 0.625rem !important;
			margin-right: 0.625rem !important;
			&::before {
				border-left-style: dashed !important;
				border-bottom-left-radius: 6.25rem !important;
			}
		}
		i {
			font-size: 1em !important;
			vertical-align: middle !important;
		}
		a {
			position: static;
			&::before {
				content: "";
				position: absolute;
				inset: 0;
			}
			&::after {
				content: unset;
			}
		}
	}

	&.reply,
	&.reply-to,
	&.reply-to-more {
		> .main:hover,
		> .main:focus-within {
			:deep(.footer .button) {
				opacity: 1;
			}
		}
	}

	&.reply-to,
	&.reply-to-more {
		padding-bottom: 0;
		&:first-child {
			padding-top: 1.5rem;
		}
		.line::before {
			margin-bottom: -1rem;
		}
	}

	// Reply Lines
	&.reply,
	&.reply-to,
	&.reply-to-more {
		--indent: calc(var(--avatarSize) - 0.3125rem);
		> .main {
			> .avatar-container {
				display: flex;
				flex-direction: column;
				align-items: center;
				margin-right: 0.875rem;
				width: var(--avatarSize);
				> .avatar {
					width: var(--avatarSize);
					height: var(--avatarSize);
					margin: 0;
				}
			}
		}
		.line {
			position: relative;
			width: var(--avatarSize);
			display: flex;
			flex-grow: 1;
			margin-bottom: -0.625rem;
			&::before {
				content: "";
				position: absolute;
				border-left: 0.125rem solid var(--X13);
				margin-left: calc((var(--avatarSize) / 2) - 0.0625rem);
				width: calc(var(--indent) / 2);
				inset-block: 0;
				min-height: 0.5rem;
			}
		}
	}
	&.reply-to,
	&.reply-to-more {
		> .main > .avatar-container > .line {
			margin-bottom: 0 !important;
		}
	}
	&.single,
	&.singleStart {
		> .main > .avatar-container > .line {
			margin-bottom: -0.625rem !important;
		}
	}
	.reply.children:not(:last-child) {
		// Line that goes through multiple replies
		position: relative;
		> .line {
			position: absolute;
			top: 0;
			left: 0;
			bottom: 0;
		}
	}
	// Reply line connectors
	.reply.children:not(.single) {
		position: relative;
		> .line {
			position: absolute;
			left: 0;
			top: 0;
			&::after {
				content: "";
				position: absolute;
				border-left: 0.125rem solid var(--X13);
				border-bottom: 0.125rem solid var(--X13);
				margin-left: calc((var(--avatarSize) / 2) - 0.0625rem);
				width: calc(var(--indent) / 2);
				height: calc((var(--avatarSize) / 2));
				border-bottom-left-radius: calc(var(--indent) / 2);
				top: 0.5rem;
			}
		}
		&:not(:last-child) > .line::after {
			mask: linear-gradient(
				to right,
				transparent 0.125rem,
				black 0.125rem
			);
			-webkit-mask: linear-gradient(
				to right,
				transparent 0.125rem,
				black 0.125rem
			);
		}
	}
	// End Reply Divider
	.children > .main:last-child {
		padding-bottom: 1em;
		&::before {
			bottom: 1em;
		}
		// &::after {
		// 	content: "";
		// 	border-top: 0.0625rem solid var(--X13);
		// 	position: absolute;
		// 	bottom: 0;
		// 	margin-left: calc(var(--avatarSize) + 0.75rem);
		// 	inset-inline: 0;
		// }
	}
	&.firstColumn > .children:last-child > .main {
		padding-bottom: 0 !important;
		&::before {
			bottom: 0 !important;
		}
		// &::after { content: unset }
	}

	&.max-width_500px {
		:not(.reply) > & {
			.reply {
				--avatarSize: 1.5rem;
				--indent: calc(var(--avatarSize) - 0.25rem);
			}
		}
		&.firstColumn {
			> .main,
			> .line,
			> .children:not(.single) > .line {
				--avatarSize: 2.1875rem;
				--indent: 2.1875rem;
			}
			> .children:not(.single) {
				padding-left: 1.75rem !important;
			}
		}
	}
	&.max-width_450px {
		padding: 0.875rem 1rem;
		&.reply-to,
		&.reply-to-more {
			padding: 0.875rem 1rem;
			padding-top: 0.875rem !important;
			padding-bottom: 0 !important;
			margin-bottom: 0 !important;
		}
		> .main > .avatar-container {
			margin-right: 0.625rem;
		}
	}
}

.muted {
	padding: 0.5rem;
	text-align: center;
	opacity: 0.7;
}
</style>
