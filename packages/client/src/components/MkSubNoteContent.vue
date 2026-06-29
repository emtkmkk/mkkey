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
			:allow-remote-emoji="defaultStore.state.showRemoteEmojiTimeline"
			:reaction-menu-enabled="true"
			:note="note"
			:mfm-compat="mfmCompat"
			is-cw
		/>
		<Mfm
			v-else-if="cwDetermine"
			class="text"
			:text="note.cw ?? '★センシティブメディア'"
			:author="note.user"
			:i="$i"
			:custom-emojis="note.emojis"
			:allow-remote-emoji="defaultStore.state.showRemoteEmojiTimeline"
			:reaction-menu-enabled="true"
			:note="note"
			:mfm-compat="mfmCompat"
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
				<span v-if="note.invisible" style="opacity: 0.5">{{
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
						!note.invisible &&
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
					:allow-remote-emoji="defaultStore.state.showRemoteEmojiTimeline"
					:reaction-menu-enabled="true"
					:note="note"
					:mfm-compat="mfmCompat"
				/>
				<Mfm
					v-else-if="note.text && !note.deletedAt && !note.invisible"
					:text="note.deletedAt ? i18n.ts.deletedNote : note.text"
					:author="note.user"
					:i="$i"
					:custom-emojis="note.emojis"
					:allow-remote-emoji="defaultStore.state.showRemoteEmojiTimeline"
					:reaction-menu-enabled="true"
					:note="note"
					:mfm-compat="mfmCompat"
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
						<XNoteSimple :note="note.renote" nocolor />
					</div>
					<MkFolder
						v-if="showReferencesFolder"
						class="references"
						:expanded="refExpand"
						no-style
						@toggle="onReferencesFolderToggle"
					>
						<template #header>{{ referencesHeader }}</template>
						<div
							v-if="isRemoteParentNote && remoteReferencesLoading"
							class="references-loading"
						>
							<MkLoading mini />
						</div>
						<MkButton
							v-else-if="isRemoteParentNote && remoteReferencesError"
							class="references-retry"
							@click.stop="retryRemoteReferences"
						>
							再試行
						</MkButton>
						<div
							v-for="reference in displayReferences"
							:key="reference.id"
							class="reference"
							@click.stop="emit('push', reference)"
						>
							<XNoteSimple :note="reference" />
						</div>
					</MkFolder>
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
/**
 * @packageDocumentation
 *
 * ノート本文の折りたたみ表示（リプライ・RN・参照フォルダ等）。
 *
 * @remarks
 * - ローカル投稿: `pack.references` をそのまま表示。
 * - リモート投稿: `hasReferences` でフォルダを出し、初回展開時のみ lazy API。以降はセッションキャッシュ。
 *
 * @public
 */
import { ref, watch, onMounted } from "vue";
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
import MkFolder from "@/components/MkFolder.vue";
import MkLoading from "@/components/MkLoading.vue";
import { fetchRemoteReferences } from "@/composables/use-remote-references";
import { extractUrlFromMfm } from "@/scripts/extract-url-from-mfm";
import { extractMfmWithAnimation } from "@/scripts/extract-mfm";
import { shouldEnableMfmCompat } from "@/scripts/mfm-compat";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { $i } from "@/account";

const props = defineProps<{
	note: misskey.entities.Note;
	parentId?;
	conversation?;
	detailed?: boolean;
	detailedView?: boolean;
	option?: string;
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
let collapsed = ref(!cwView && isLong);
const urls = props.note.text
	? extractUrlFromMfm(mfm.parse(props.note.text))
			.filter(
				(url) =>
					props.note.renote?.url !== url &&
					props.note.renote?.uri !== url &&
					(!props.note.references?.length ||
						!props.note.references
							.map((x) => x.url)
							.includes(url)) &&
					(!props.note.references?.length ||
						!props.note.references.map((x) => x.uri).includes(url))
			)
			.slice(0, 5)
	: null;
let refExpand = $ref(!!props.option?.includes("references"));

/** リモート親投稿（参照 lazy 取得対象） */
const isRemoteParentNote = $computed(
	() =>
		props.note.userHost != null ||
		(props.note.user?.host != null && props.note.user.host !== config.host),
);

type NoteWithReferencesMeta = misskey.entities.Note & {
	hasReferences?: boolean;
	visibleReferencesCount?: number;
};

const showReferencesFolder = $computed(() => {
	const note = props.note as NoteWithReferencesMeta;
	if (isRemoteParentNote) return note.hasReferences === true;
	return (note.references?.length ?? 0) > 0;
});

let loadedRemoteReferences = $ref<misskey.entities.Note[] | null>(null);
let remoteReferencesLoading = $ref(false);
let remoteReferencesError = $ref(false);

const referencesHeader = $computed(() => {
	const note = props.note as NoteWithReferencesMeta;
	if (isRemoteParentNote) {
		const count =
			loadedRemoteReferences?.length ?? note.visibleReferencesCount ?? 0;
		return count > 0 ? `${count} 件の参照` : "参照";
	}
	return `${note.references?.length ?? 0} 件の参照`;
});

const displayReferences = $computed(() => {
	if (isRemoteParentNote) return loadedRemoteReferences ?? [];
	return props.note.references ?? [];
});

async function loadRemoteReferences(): Promise<void> {
	remoteReferencesLoading = true;
	remoteReferencesError = false;
	try {
		loadedRemoteReferences = await fetchRemoteReferences(props.note.id);
	} catch {
		remoteReferencesError = true;
	} finally {
		remoteReferencesLoading = false;
	}
}

function onReferencesFolderToggle(expanded: boolean): void {
	if (!expanded || !isRemoteParentNote) return;
	if (loadedRemoteReferences != null) return;
	void loadRemoteReferences();
}

function retryRemoteReferences(): void {
	loadedRemoteReferences = null;
	void loadRemoteReferences();
}

onMounted(() => {
	if (refExpand && isRemoteParentNote) {
		void loadRemoteReferences();
	}
});

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

/**
 * 互換モード実装日（この UTC 日付以降に作成されたローカル投稿に互換モードを適用する）。
 * 文字列で比較するためタイムゾーン解釈の差による境界値ミスを防ぐ。
 * @internal
 */
const MFM_COMPAT_IMPLEMENTED_UTC_DATE = "2026-03-17";
const hasPositionForCompat = $computed(() =>
	shouldEnableMfmCompat(props.note.text),
);
const isRemoteNote = $computed(
	() =>
		props.note.user?.host != null && props.note.user.host !== config.host,
);
const isLocalAfterCompatDate = $computed(() => {
	// $computed は自動アンラップされるため .value は不要
	if (isRemoteNote) return false;
	try {
		const created = new Date(props.note.createdAt);
		if (Number.isNaN(created.getTime())) return false;
		// タイムゾーンに依存しないよう、UTC 日付文字列で比較する
		const createdUtcDate = created.toISOString().slice(0, 10);
		return createdUtcDate >= MFM_COMPAT_IMPLEMENTED_UTC_DATE;
	} catch {
		return false;
	}
});
const mfmCompat = $computed(
	() =>
		hasPositionForCompat &&
		(isRemoteNote || isLocalAfterCompatDate),
);

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
						background: var(--tlPanelHighlight);
					}
				}
			}
			> .references {
				padding-top: 0.5rem;
				.reference {
					padding-top: 0.5rem;
					> * {
						padding: 1rem;
						border: solid 0.0625rem var(--accent);
						border-radius: 0.5rem;
						transition: background 0.2s;
						&:hover,
						&:focus-within {
							background: var(--tlPanelHighlight);
						}
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
					background: var(--tlPanel);
					padding: 0.4em 1em;
					font-size: 0.8em;
					border-radius: 999px;
					box-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 20%);
				}
				&:hover {
					> span {
						background: var(--tlPanelHighlight);
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
				background: var(--tlPanel);
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
