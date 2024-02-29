<template>
	<p v-if="cwDetermine" class="cw">
		<MkA
			v-if="!detailed && note.replyId"
			:to="`/notes/${note.replyId}`"
			class="reply-icon"
			@click.stop
		>
			<i class="ph-arrow-bend-left-up ph-bold ph-lg"></i>
		</MkA>
		<MkA
			v-if="
				conversation &&
				note.renoteId &&
				note.renoteId != parentId &&
				!note.replyId
			"
			:to="`/notes/${note.renoteId}`"
			class="reply-icon"
			@click.stop
		>
			<i class="ph-quotes ph-bold ph-lg"></i>
		</MkA>
		<Mfm
			v-if="
				cwDetermine &&
				note.reply?.user &&
				note.reply.user.id !== note.user.id &&
				!note.cw?.includes(`@`)
			"
			class="text"
			:text="
				`@${note.reply.user.username}${
					note.reply.user.host
						? `@${note.reply.user.host}`
						: `@${config.host}`
				} ` + (note.cw ?? '★センシティブメディア')
			"
			:author="note.user"
			:i="$i"
			:custom-emojis="note.emojis"
			:reaction-menu-enabled="true"
			:note="note"
			is-cw
		/>
		<Mfm
			v-else-if="cwDetermine"
			class="text"
			:text="note.cw ?? '★センシティブメディア'"
			:author="note.user"
			:i="$i"
			:custom-emojis="note.emojis"
			:reaction-menu-enabled="true"
			:note="note"
			is-cw
		/>
	</p>
	<div class="wrmlmaau">
		<div
			class="content"
			:class="{
				collapsed,
				isLong,
				showContent: cwView && !showContent,
				disableAnim: disableMfm,
				minimumCw: defaultStore.state.noteAllCw,
				noblur: !cwDetermine,
			}"
		>
			<XCwButton
				ref="cwButton"
				v-if="cwView && !showContent"
				v-model="showContent"
				:note="note"
				v-on:keydown="focusFooter"
			/>
			<div
				class="body"
				v-bind="{
					'aria-label': !showContent ? '' : null,
					tabindex: !showContent ? '-1' : null,
				}"
			>
				<span v-if="note.deletedAt" style="opacity: 0.5">{{
					`(${i18n.ts.deleted})${note.text ? ` <${note.text}>` : ""}`
				}}</span>
				<span v-if="note.isVisible === false" style="opacity: 0.5">{{
					`(${i18n.ts.invisibleNote})`
				}}</span>
				<template v-if="!cwView">
					<MkA
						v-if="!detailed && note.replyId"
						:to="`/notes/${note.replyId}`"
						class="reply-icon"
						@click.stop
					>
						<i class="ph-arrow-bend-left-up ph-bold ph-lg"></i>
					</MkA>
					<MkA
						v-if="
							conversation &&
							note.renoteId &&
							note.renoteId != parentId &&
							!note.replyId
						"
						:to="`/notes/${note.renoteId}`"
						class="reply-icon"
						@click.stop
					>
						<i class="ph-quotes ph-bold ph-lg"></i>
					</MkA>
				</template>
				<Mfm
					v-if="
						note.text &&
						!note.cw &&
						!note.deletedAt &&
						note.isVisible !== false &&
						note.reply?.user &&
						note.reply.user.id !== note.user.id &&
						!note.text?.includes(`@`)
					"
					:text="
						note.deletedAt
							? i18n.ts.deletedNote
							: `@${note.reply.user.username}${
									note.reply.user.host
										? `@${note.reply.user.host}`
										: '@mkkey.net'
							  } ` + note.text
					"
					:author="note.user"
					:i="$i"
					:custom-emojis="note.emojis"
					:reaction-menu-enabled="true"
					:note="note"
				/>
				<Mfm
					v-else-if="note.text && !note.deletedAt && note.isVisible !== false"
					:text="note.deletedAt ? i18n.ts.deletedNote : note.text"
					:author="note.user"
					:i="$i"
					:custom-emojis="note.emojis"
					:reaction-menu-enabled="true"
					:note="note"
				/>
				<MkA
					v-if="!detailed && note.renoteId"
					class="rp"
					:to="`/notes/${note.renoteId}`"
					>{{ i18n.ts.quoteAttached }}: ...</MkA
				>
				<div v-if="note.files.length > 0" class="files">
					<XMediaList :media-list="note.files" />
				</div>
				<XPoll v-if="note.poll" :note="note" class="poll" />
				<template v-if="detailed">
					<MkUrlPreview
						v-for="url in urls"
						:key="url"
						:url="url"
						:compact="true"
						:detail="false"
						class="url-preview"
					/>
					<div
						v-if="note.renote"
						class="renote"
						@click.stop="emit('push', note.renote)"
					>
						<XNoteSimple :note="note.renote" />
					</div>
				</template>
				<div
					v-if="cwView && !showContent"
					tabindex="0"
					v-on:focus="cwButton?.focus()"
				></div>
			</div>
			<XShowMoreButton
				v-if="isLong"
				v-model="collapsed"
				:note="note"
			></XShowMoreButton>
			<XCwButton v-if="cwView" v-model="showContent" :note="note" />
		</div>
		<MkButton
			v-if="hasMfm && defaultStore.state.animatedMfm"
			@click.stop="toggleMfm"
		>
			<template v-if="disableMfm">
				<i class="ph-play ph-bold"></i> {{ i18n.ts._mfm.play }}
			</template>
			<template v-else>
				<i class="ph-stop ph-bold"></i> {{ i18n.ts._mfm.stop }}
			</template>
		</MkButton>
	</div>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import * as misskey from "calckey-js";
import * as mfm from "mfm-js";
import * as os from "@/os";
import * as config from "@/config";
import XNoteSimple from "@/components/MkNoteSimple.vue";
import XMediaList from "@/components/MkMediaList.vue";
import XPoll from "@/components/MkPoll.vue";
import MkUrlPreview from "@/components/MkUrlPreview.vue";
import XShowMoreButton from "@/components/MkShowMoreButton.vue";
import XCwButton from "@/components/MkCwButton.vue";
import MkButton from "@/components/MkButton.vue";
import { extractUrlFromMfm } from "@/scripts/extract-url-from-mfm";
import { extractMfmWithAnimation } from "@/scripts/extract-mfm";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { $i } from "@/account";

const props = defineProps<{
	note: misskey.entities.Note;
	parentId?;
	conversation?;
	detailed?: boolean;
	detailedView?: boolean;
}>();

const emit = defineEmits<{
	(ev: "push", v): void;
	(ev: "focusfooter"): void;
	(ev: "changeShowContent"): void;
}>();

const cwButton = ref<HTMLElement>();
const isSensitive =
	props.note.files && props.note.files.some((file) => file.isSensitive);
const cwDetermine =
	props.note.cw || (isSensitive && defaultStore.state.nsfw === "toCW");
const cwView = cwDetermine || defaultStore.state.noteAllCw;
const isLong =
	!props.detailedView &&
	!cwView &&
	props.note.text != null &&
	(props.note.text.split("\n").length > 9 ||
		props.note.text.length > 500 ||
		(!defaultStore.state.compactGrid &&
			(props.note.files?.length > 4 || props.note.files?.length === 3)));
const collapsed = $ref(!cwView && isLong);
const urls = props.note.text
	? extractUrlFromMfm(mfm.parse(props.note.text))
			.filter(
				(url) =>
					props.note.renote?.url !== url &&
					props.note.renote?.uri !== url
			)
			.slice(0, 5)
	: null;

let showContent = ref(!cwView);

watch(
	showContent,
	(n) => {
		emit("changeShowContent", n);
	},
	{ immediate: true }
);

const mfms = props.note.text
	? extractMfmWithAnimation(mfm.parse(props.note.text))
	: null;

const hasMfm = $ref(mfms && mfms.length > 0);

let disableMfm = $ref(hasMfm && defaultStore.state.animatedMfm);

async function toggleMfm() {
	if (disableMfm) {
		if (!defaultStore.state.animatedMfmWarnShown) {
			const { canceled } = await os.confirm({
				type: "warning",
				text: i18n.ts._mfm.warn,
			});
			if (canceled) return;

			defaultStore.set("animatedMfmWarnShown", true);
		}

		disableMfm = false;
	} else {
		disableMfm = true;
	}
}

function focusFooter(ev) {
	if (ev.key == "Tab" && !ev.getModifierState("Shift")) {
		emit("focusfooter");
	}
}
</script>

<style lang="scss" scoped>
.reply-icon {
	display: inline-block;
	border-radius: 0.375rem;
	padding: 0.2em 0.2em;
	margin-right: 0.2em;
	color: var(--accent);
	transition: background 0.2s;
	&:hover,
	&:focus {
		background: var(--buttonHoverBg);
	}
}
.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	margin-bottom: 0.625rem;
	overflow-wrap: break-word;
	> .text {
		margin-right: 0.5rem;
	}
}

.wrmlmaau {
	.content {
		overflow-wrap: break-word;
		> .body {
			transition: filter 0.1s;
			> .rp {
				margin-left: 0.25rem;
				font-style: oblique;
				color: var(--renote);
			}
			.reply-icon {
				display: inline-block;
				border-radius: 0.375rem;
				padding: 0.2em 0.2em;
				margin-right: 0.2em;
				color: var(--accent);
				transition: background 0.2s;
				&:hover,
				&:focus {
					background: var(--buttonHoverBg);
				}
			}
			> .files {
				margin-top: 0.4em;
				margin-bottom: 0.4em;
			}
			> .url-preview {
				margin-top: 0.5rem;
			}

			> .poll {
				font-size: 80%;
			}

			> .renote {
				padding-top: 0.5rem;
				> * {
					padding: 1rem;
					border: solid 0.0625rem var(--renote);
					border-radius: 0.5rem;
					transition: background 0.2s;
					&:hover,
					&:focus-within {
						background-color: var(--panelHighlight);
					}
				}
			}
		}

		&.collapsed,
		&.showContent {
			position: relative;
			max-height: calc(9em + 3.125rem);
			> .body {
				max-height: inherit;
				mask: linear-gradient(black calc(100% - 4rem), transparent);
				-webkit-mask: linear-gradient(
					black calc(100% - 4rem),
					transparent
				);
				padding-inline: 3.125rem;
				margin-inline: -3.125rem;
				margin-top: -3.125rem;
				padding-top: 3.125rem;
				overflow: hidden;
				user-select: none;
				-webkit-user-select: none;
				-moz-user-select: none;
			}
			&.collapsed > .body {
				box-sizing: border-box;
			}
			&.showContent {
				> .body {
					min-height: 2em;
					max-height: 5em;
					filter: blur(8px);
					:deep(span) {
						animation: none !important;
						transform: none !important;
					}
					:deep(img) {
						filter: blur(18px);
					}
				}
				:deep(.fade) {
					inset: 0;
					top: 2.5rem;
				}
				&.minimumCw {
					> .body {
						max-height: 2em;
					}
				}
				&.noblur {
					> .body {
						filter: none;
					}
				}
			}

			:deep(.fade) {
				display: block;
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				> span {
					display: inline-block;
					background: var(--panel);
					padding: 0.4em 1em;
					font-size: 0.8em;
					border-radius: 999px;
					box-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 20%);
				}
				&:hover {
					> span {
						background: var(--panelHighlight);
					}
				}
			}
		}

		:deep(.showLess) {
			width: 100%;
			margin-top: 1em;
			position: sticky;
			bottom: var(--stickyBottom);

			> span {
				display: inline-block;
				background: var(--panel);
				padding: 0.375rem 0.625rem;
				font-size: 0.8em;
				border-radius: 999px;
				box-shadow: 0 0 0.4375rem 0.4375rem var(--bg);
			}
		}

		&.disableAnim :deep(span) {
			animation: none !important;
		}
	}
	> :deep(button) {
		margin-top: 0.625rem;
		margin-left: 0;
		margin-right: 0.4rem;
	}
}
</style>
