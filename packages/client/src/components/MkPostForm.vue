<template>
	<section
		v-size="{ max: [310, 500] }"
		class="gafaadew"
		:class="{ modal, _popup: modal }"
		:aria-label="i18n.ts._pages.blocks.post"
		@dragover.stop="onDragover"
		@dragenter="onDragenter"
		@dragleave="onDragleave"
		@drop.stop="onDrop"
	>
		<header>
			<button
				v-if="
					(!fixed || $store.state.CloseAllClearButton) &&
					!$store.state.hiddenCloseButton
				"
				class="cancel _button"
				:tabindex="headerButtonsTabindex"
				@click="cancel"
			>
				<i class="ph-x ph-bold ph-lg"></i>
			</button>
			<button
				v-if="!$store.state.hiddenAccountButton"
				v-click-anime
				v-tooltip="i18n.ts.switchAccount"
				class="account _button"
				:tabindex="headerButtonsTabindex"
				@click="openAccountMenu"
			>
				<MkAvatar :user="postAccount ?? $i" class="avatar" />
			</button>
			<div class="right">
				<span
					v-if="!$store.state.hiddenTextCount"
					class="text-count"
					:class="{ over: textLength > maxTextLength }"
					>{{
						maxTextLength - textLength > 999
							? textLength
							: i18n.t("remainingLength", {
									n: maxTextLength - textLength,
							  })
					}}
				</span>
				<span v-if="localOnly && isChannel" class="local-only"
					><i class="ph-hand-fist ph-bold ph-lg"></i
				></span>
				<span
					v-if="
						localOnly &&
						!isChannel &&
						($store.state.rememberNoteVisibility ||
							!$store.state.firstPostButtonVisibilityForce ||
							visibility === 'specified')
					"
					class="local-only"
					><i class="ph-hand-heart ph-bold ph-lg"></i
				></span>
				<button
					v-if="
						$store.state.rememberNoteVisibility ||
						!$store.state.firstPostButtonVisibilityForce ||
						isChannel ||
						visibility === 'specified'
					"
					ref="visibilityButton"
					v-tooltip="i18n.ts.visibility"
					class="_button visibility"
					:class="{ addblank: $store.state.hiddenMFMHelp && false }"
					:disabled="!canFollower"
					:tabindex="headerButtonsTabindex"
					@click="setVisibility"
				>
					<span v-if="visibility === 'public'"
						><i class="ph-planet ph-bold ph-lg"></i
					></span>
					<span v-if="visibility === 'home'"
						><i class="ph-house ph-bold ph-lg"></i
					></span>
					<span v-if="visibility === 'followers'"
						><i class="ph-lock-simple ph-bold ph-lg"></i
					></span>
					<span v-if="visibility === 'specified'"
						><i class="ph-envelope-simple-open ph-bold ph-lg"></i
					></span>
				</button>
				<button
					v-if="!$store.state.hiddenDraftButton"
					class="_button visibility"
					:class="{ addblank: $store.state.hiddenMFMHelp }"
					:tabindex="headerButtonsTabindex"
					@click="openDraft"
				>
					<i class="ph-notepad ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenMFMHelp"
					v-tooltip="i18n.ts._mfm.cheatSheet"
					class="_button preview"
					:tabindex="headerButtonsTabindex"
					@click="openCheatSheet"
				>
					<i class="ph-question ph-bold ph-lg"></i>
				</button>
				<template v-if="!$store.state.hiddenPostButton && !postLocked">
					<button
						v-for="button in submitButtonConfigs"
						:key="button.key"
						:class="[button.buttonClass, button.classObject ?? {}]"
						:disabled="button.disabled"
						:tabindex="headerButtonsTabindex"
						data-cy-open-post-form-submit
						@click="handleQuickPost(button)"
					>
						{{ button.label }}
						<i :class="button.iconClass"></i>
						<i
							v-if="button.extraIconClass"
							:class="button.extraIconClass"
						></i>
					</button>
				</template>
			</div>
		</header>
		<div class="form" :class="{ fixed }">
			<XNoteSimple v-if="reply" class="preview" :note="reply" nocolor />
			<XNoteSimple v-if="renote" class="preview" :note="renote" nocolor />
			<div v-if="quoteId" class="with-quote">
				<i class="ph-quotes ph-bold ph-lg"></i>
				<button
					@click="
						() => {
							os.pageWindow(`/notes/${quoteId}`);
						}
					"
				>
					{{ `${i18n.ts.quoteAttached} ${quoteId}` }}</button
				><button class="_button" @click="quoteId = null">
					<i class="ph-x ph-bold ph-lg"></i>
				</button>
			</div>
			<div v-if="referenceIds?.length" class="with-references" :class="{refOn: referencesFlg}">
				<button class="_button" @click="referencesFlg = !referencesFlg">
					<i v-show="referencesFlg" class="ph-check-square ph-bold ph-lg"></i>
					<i v-show="!referencesFlg" class="ph-square ph-bold ph-lg"></i>
				</button>
				<i class="ph-stack ph-bold ph-lg"></i>
				{{ `${i18n.ts.referencesAttached} ×${referenceIds?.length}` }}
				<button class="_button" @click="referenceIds = []">
					<i class="ph-x ph-bold ph-lg"></i>
				</button>
			</div>
			<div
				v-if="visibility === 'specified'"
				class="to-specified"
				:class="{
					nomargin:
						canCc ||
						(visibility === 'specified' &&
							visibleUsersCc?.length > 0),
				}"
			>
				<span style="margin-right: 0.5rem">{{
					i18n.ts.recipient
				}}</span>
				<div class="visibleUsers">
					<span v-for="u in visibleUsers" :key="u.id">
						<MkAcct :user="u" />
						<button
							v-if="u.id !== reply?.userId"
							class="_button"
							@click="removeVisibleUser(u)"
						>
							<i class="ph-x ph-bold ph-lg"></i>
						</button>
						<button v-else class="_button">
							<i class="ph-arrow-bend-left-up ph-bold ph-lg"></i>
						</button>
					</span>
					<button
						v-if="!canCc && reply?.ccUserIdsCount"
						v-tooltip="
							`返信先のCC ${reply?.ccUserIdsCount} 名を引継ぐ`
						"
						class="_button"
						:class="{ active: inheritCc }"
						@click="inheritCc = !inheritCc"
					>
						<i class="ph-list-checks ph-bold ph-md ph-fw ph-lg"></i>
					</button>
					<button class="_button" @click="addVisibleUser">
						<i class="ph-plus ph-bold ph-md ph-fw ph-lg"></i>
					</button>
				</div>
			</div>
			<div
				v-if="
					canCc ||
					(visibility === 'specified' && visibleUsersCc?.length > 0)
				"
				class="to-specified"
			>
				<span style="margin-right: 0.5rem">{{
					i18n.ts.recipientCc
				}}</span>
				<div class="visibleUsers">
					<span v-for="u in visibleUsersCc" :key="u.id">
						<MkAcct :user="u" />
						<button class="_button" @click="removeVisibleUserCc(u)">
							<i class="ph-x ph-bold ph-lg"></i>
						</button>
					</span>
					<button
						v-if="reply?.ccUserIdsCount"
						v-tooltip="
							`返信先のCC ${reply?.ccUserIdsCount} 名を引継ぐ`
						"
						class="_button"
						:class="{ active: inheritCc }"
						@click="inheritCc = !inheritCc"
					>
						<i class="ph-list-checks ph-bold ph-md ph-fw ph-lg"></i>
					</button>
					<button
						v-if="canCc"
						class="_button"
						@click="addVisibleUserCcToList"
					>
						<i class="ph-list-plus ph-bold ph-md ph-fw ph-lg"></i>
					</button>
					<button
						v-if="canCc"
						class="_button"
						@click="addVisibleUserCc"
					>
						<i class="ph-plus ph-bold ph-md ph-fw ph-lg"></i>
					</button>
				</div>
			</div>
			<MkInfo
				v-if="hasNotSpecifiedMentions"
				warn
				class="hasNotSpecifiedMentions"
				>{{ i18n.ts.notSpecifiedMentionWarning }} -
				<button class="_textButton" @click="addMissingMention()">
					{{ i18n.ts.add }}
				</button></MkInfo
			>
			<MkInfo
				v-if="hasNotMentions && visibility !== 'specified'"
				warn
				class="hasNotSpecifiedMentions"
				>{{ "この投稿は返信として扱われていない為、投稿を確認可能な全てのユーザに表示されます。" }}</MkInfo
			>
			<MkInfo
				v-if="includesOtherServerEmoji"
				warn
				class="hasNotSpecifiedMentions"
				>{{ i18n.ts.includesOtherServerEmojiWarning }}</MkInfo
			>
			<textarea
				v-show="useCw"
				ref="cwInputEl"
				v-model="cw"
				class="cw"
				:placeholder="i18n.ts.annotation"
				@keyup="onKeyup"
				@keydown="onKeydown"
			/>
			<textarea
				ref="textareaEl"
				v-model="text"
				class="text"
				:class="{ withCw: useCw }"
				:disabled="posting"
				:placeholder="placeholder"
				data-cy-post-form-text
				@keyup="onKeyup"
				@keydown="onKeydown"
				@paste="onPaste"
				@compositionupdate="onCompositionUpdate"
				@compositionend="onCompositionEnd"
			/>
			<input
				v-show="withHashtags"
				ref="hashtagsInputEl"
				v-model="hashtags"
				class="hashtags"
				:placeholder="i18n.ts.hashtags"
				list="hashtags"
			/>
			<XPostFormAttaches
				class="attaches"
				:files="files"
				@updated="updateFiles"
				@detach="detachFile"
				@replaceFile="replaceFile"
				@changeSensitive="updateFileSensitive"
				@changeName="updateFileName"
			/>
			<XPollEditor v-if="poll" v-model="poll" @destroyed="poll = null" />
			<footer>
				<button
					v-if="!$store.state.hiddenUploadButton"
					v-tooltip="i18n.ts.attachFile"
					class="_button"
					:tabindex="footerButtonsTabindex"
					@click="chooseFileFrom"
				>
					<i class="ph-upload ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenPollButton"
					v-tooltip="i18n.ts.poll"
					class="_button"
					:class="{ active: poll }"
					:tabindex="footerButtonsTabindex"
					@click="togglePoll"
				>
					<i class="ph-microphone-stage ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenCwButton"
					v-tooltip="i18n.ts.useCw"
					class="_button"
					:class="{ active: useCw }"
					:tabindex="footerButtonsTabindex"
					@click="toggleUseCw"
				>
					<i class="ph-eye-slash ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenMentionButton"
					v-tooltip="i18n.ts.mention"
					class="_button"
					:tabindex="footerButtonsTabindex"
					@click="insertMention"
				>
					<i class="ph-at ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenHashtagButton"
					v-tooltip="i18n.ts.hashtags"
					class="_button"
					:class="{ active: withHashtags }"
					:tabindex="footerButtonsTabindex"
					@click="withHashtags = !withHashtags"
				>
					<i class="ph-hash ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenEmojiButton"
					v-tooltip="i18n.ts.emoji"
					class="_button"
					:tabindex="footerButtonsTabindex"
					@click="insertEmoji"
				>
					<i class="ph-smiley ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenMFMButton"
					v-tooltip="i18n.ts.mfm"
					class="_button"
					:class="{
						active:
							defaultStore.state.quickToggleSmartMFMInputer &&
							smartMFMInputer,
					}"
					:tabindex="footerButtonsTabindex"
					@click="insertMfm"
				>
					<i class="ph-magic-wand ph-bold ph-lg"></i>
				</button>
				<button
					v-if="showSwarmButton && !$store.state.hiddenSwarmButton"
					v-tooltip="i18n.ts.swarm"
					class="_button"
					:tabindex="footerButtonsTabindex"
					@click="() => void openSwarmCheckins()"
				>
					<span class="swarm-icon" role="img" aria-hidden="true"></span>
				</button>
				<button
					v-if="postFormActions.length > 0 && !$store.state.hiddenPluginButton"
					v-tooltip="i18n.ts.plugin"
					class="_button"
					:tabindex="footerButtonsTabindex"
					@click="showActions"
				>
					<i class="ph-plug ph-bold ph-lg"></i>
				</button>
				<button
					v-if="canShowNowPlayingButton"
					v-tooltip="i18n.ts.insertNowPlayingInfo"
					class="_button"
					:disabled="isNowPlayingButtonDisabled"
					:tabindex="footerButtonsTabindex"
					@click="insertNowPlayingInfo"
				>
					<i class="ph-music-notes ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenPostLockButton"
					v-tooltip="postLocked ? i18n.ts.postLockedTooltip : i18n.ts.postLockTooltip"
					class="_button right"
					:class="{ active: postLocked }"
					:tabindex="footerButtonsTabindex"
					data-cy-post-lock-toggle
					@click="postLocked = !postLocked"
				>
					<i
						:class="
							postLocked
								? 'ph-lock ph-bold ph-lg'
								: 'ph-lock-open ph-bold ph-lg'
						"
					></i>
				</button>
				<button
					v-if="!$store.state.hiddenPreviewButton"
					v-tooltip="i18n.ts.previewNoteText"
					class="_button"
					:class="{
						right: $store.state.hiddenPostLockButton,
						active: showPreview,
					}"
					:tabindex="footerButtonsTabindex"
					@click="showPreview = !showPreview"
				>
					<i class="ph-binoculars ph-bold ph-lg"></i>
				</button>
			</footer>
			<XNotePreview
				v-if="showPreview && !$store.state.hiddenPreviewButton"
				class="preview"
				:user="postAccount ?? $i"
				:text="text + (withHashtags ? ' ' + hashtagsPreview : '')"
				:cw="useCw ? cw ?? '' : null"
				:referenceIds="referencesFlg ? referenceIds : []"
			/>
			<datalist id="hashtags">
				<option
					v-for="hashtag in recentHashtags"
					:key="hashtag"
					:value="hashtag"
				/>
			</datalist>
		</div>
	</section>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 投稿フォームの入力、下書き、投稿送信を扱うコンポーネント。
 *
 * @remarks
 * NOTE: 同一内容の連続投稿を抑止するため、CW/本文と投稿文脈を使った一時的な署名管理を行う。
 * NOTE: ストリーミングで自身投稿を受信した場合、対象が通常投稿系キーなら下書きを同期削除する。
 * NOTE: 投稿ロック機能 (`postLocked`) — フッターのロックボタン ON 中は投稿ボタンを非表示にし、
 *       投稿ショートカット (Ctrl/Alt+Enter 系) と `post()` / `performQuickPost()` /
 *       `handleQuickPost()` の各エントリポイントで早期 return する。ロック状態は下書きに保存され、
 *       ロック ON の下書きは時間経過によるアーカイブ (`note:xxx` 化) の対象外となる。
 *       ただし `defaultStore.state.hiddenPostLockButton === true`（ボタン非表示設定）の場合は、
 *       復元時に強制的に OFF として扱う（ロック解除手段がなくなることを防ぐため）。
 *
 * @internal
 */
import {
	unref,
	inject,
	watch,
	nextTick,
	onMounted,
	onBeforeUnmount,
	onUnmounted,
	defineAsyncComponent,
	computed,
} from "vue";
import * as mfm from "mfm-js";
import * as misskey from "calckey-js";
import insertTextAtCursor from "insert-text-at-cursor";
import { length } from "stringz";
import { toASCII } from "punycode/";
import * as Acct from "calckey-js/built/acct";
import { debounce, throttle } from "throttle-debounce";
import { v4 as uuid } from "uuid";
import XNoteSimple from "@/components/MkNoteSimple.vue";
import XNotePreview from "@/components/MkNotePreview.vue";
import XPostFormAttaches from "@/components/MkPostFormAttaches.vue";
import XPollEditor from "@/components/MkPollEditor.vue";
import { host, url } from "@/config";
import { erase, unique } from "@/scripts/array";
import { extractMentions } from "@/scripts/extract-mentions";
import { formatTimeString } from "@/scripts/format-time-string";
import { Autocomplete } from "@/scripts/autocomplete";
import * as os from "@/os";
import { stream } from "@/stream";
import { selectFiles } from "@/scripts/select-file";
import { defaultStore, notePostInterruptors, postFormActions } from "@/store";
import MkInfo from "@/components/MkInfo.vue";
import { i18n } from "@/i18n";
import { instance } from "@/instance";
import { notePage } from "@/filters/note";
import {
	$i,
	getAccounts,
	openAccountMenu as openAccountMenu_,
} from "@/account";
import { uploadFile, uploads } from "@/scripts/upload";
import type { UploadFileOptions } from "@/scripts/upload";
import { deepClone } from "@/scripts/clone";
import {
	draftsReady,
	flushDrafts,
	getDraftsMap,
	setDraftsMap,
	type DraftEntry,
} from "@/scripts/drafts-store";
import XDraft from "@/components/MkDraftDialog.vue";
import XCheatSheet from "@/components/MkCheatSheetDialog.vue";
import { preprocess } from "@/scripts/preprocess";
import { triggerPizzaIfNeeded } from "@/scripts/pizza-command";
import {
	FILE_SELECT_IDLE_WAIT_MS,
	evaluateUploadWaitState,
	sleepMs,
} from "@/components/MkPostForm/uploadWaitState";

const modal = inject("modal");

const props = withDefaults(
	defineProps<{
		reply?: misskey.entities.Note;
		renote?: misskey.entities.Note;
		channel?: any; // TODO
		mention?: misskey.entities.User;
		specified?: misskey.entities.User;
		initialText?: string;
		initialVisibility?: typeof misskey.noteVisibilities;
		initialFiles?: misskey.entities.DriveFile[];
		/** マウント時にアップロードキューへ載せる未アップロードのファイル（共有ターゲット経由など） */
		initialRawFiles?: File[];
		initialLocalOnly?: boolean;
		initialVisibleUsers?: misskey.entities.User[];
		initialNote?: misskey.entities.Note;
		initialHashTags?: string;
		instant?: boolean;
		fixed?: boolean;
		autofocus?: boolean;
		key?: string;
		airReply?: misskey.entities.Note;
		forceSpecified?: boolean;
		/** false のとき親本文のメンションをコピーせず著者のみ挿入する */
		replyAllMentions?: boolean;
	}>(),
	{
		initialVisibleUsers: () => [],
		autofocus: true,
		replyAllMentions: true,
	}
);

const emit = defineEmits<{
	(ev: "posted"): void;
	(ev: "cancel"): void;
	(ev: "esc"): void;
}>();

const textareaEl = $ref<HTMLTextAreaElement | null>(null);
const cwInputEl = $ref<HTMLTextAreaElement | null>(null);
const hashtagsInputEl = $ref<HTMLInputElement | null>(null);
const visibilityButton = $ref<HTMLElement | null>(null);

const isNowPlayingSupported =
	typeof navigator !== "undefined" && "mediaSession" in navigator;

const nowPlayingMediaInfo = $computed(() => {
	if (!isNowPlayingSupported) return null;
	try {
		const mediaSession = navigator.mediaSession;
		if (!mediaSession) return null;

		const metadata = mediaSession.metadata;
		if (!metadata) return null;

		const mediaInfo = [metadata.title, metadata.artist, metadata.album]
			.filter((value): value is string =>
				typeof value === "string" && value.trim().length > 0
			)
			.join(" / ");

		return mediaInfo.length > 0 ? mediaInfo : null;
	} catch {
		return null;
	}
});

let hasShownNowPlayingButton = $ref(false);

watch(
	() => nowPlayingMediaInfo,
	(value) => {
		if (value != null) {
			hasShownNowPlayingButton = true;
		}
	},
	{ immediate: true }
);

const canShowNowPlayingButton = $computed(() =>
	isNowPlayingSupported &&
		!defaultStore.state.hiddenNowPlayingButton &&
		(nowPlayingMediaInfo != null || hasShownNowPlayingButton)
);

const isNowPlayingButtonDisabled = $computed(() => nowPlayingMediaInfo == null);

let posting = $ref(false);
let text = $ref(props.initialText ?? "");
let files = $ref(props.initialFiles ?? []);
let poll = $ref<{
	choices: string[];
	multiple: boolean;
	expiresAt: string | null;
	expiredAfter: string | null;
	hideResults: boolean;
} | null>(null);
let useCw = $ref(false);
let showPreview = $computed(defaultStore.makeGetterSetter("showPreview"));

// #region 投稿ロック
/**
 * 投稿ロック状態。
 *
 * @remarks
 * `true` の間は投稿ボタンの非表示・投稿ショートカット無効化・`post()` 系関数の早期 return を行う。
 * 状態は下書きへ保存（`saveDraft` 経由）し、復元時には `defaultStore.state.hiddenPostLockButton`
 * が `true`（=ボタン非表示設定）の場合は強制的に `false` として扱う。
 * NB: ボタンが見えない状態でロックが復元されると、投稿操作を行う手段がなくなるため。
 */
let postLocked = $ref(false);
// #endregion 投稿ロック

let cw = $computed(defaultStore.makeGetterSetter("postFormCw"));
let backupText = text;
let backupCw = cw;
let backupFiles = files;
let backupQuoteId = null;
let backupPoll = null;
let backupPostData = null;
let localOnly = $ref<boolean>(
	props.initialLocalOnly ??
		(defaultStore.state.rememberNoteVisibility
			? defaultStore.state.localAndFollower
			: defaultStore.state.defaultNoteLocalAndFollower)
);
let visibility = $ref(
	props.initialVisibility ??
		((defaultStore.state.rememberNoteVisibility
			? defaultStore.state.visibility
			: defaultStore.state
					.defaultNoteVisibility) as (typeof misskey.noteVisibilities)[number])
);
if (visibility === "specified") localOnly = false;
let visibleUsers = $ref([]);
let visibleUsersCc = $ref(
	!props.airReply?.user.host &&
		visibility === "specified" &&
		props.airReply?.ccUserIdsCount &&
		props.airReply?.userId !== $i.id
		? [props.airReply.user]
		: []
);
if (props.initialVisibleUsers) {
	props.initialVisibleUsers.forEach(pushVisibleUser);
}
let autocomplete = $ref(null);
let smartMFMInputer = $computed(
	defaultStore.makeGetterSetter("smartMFMInputer")
);
let draghover = $ref(false);
let reply = $ref(props.reply);
let renote = $ref(props.renote);
let replyId = $ref(null);
let quoteId = $ref(null);
let hasNotMentions = $ref(false);
let hasNotSpecifiedMentions = $ref(false);
let includesOtherServerEmoji = $ref(false);
let recentHashtags = $ref(JSON.parse(localStorage.getItem("hashtags") || "[]"));
let canPublic = $ref(
	(!reply || reply.visibility === "public") &&
		(!props.renote || props.renote.visibility === "public") &&
		(!props.airReply || props.initialVisibility === "public") &&
		!$i.blockPostPublic &&
		!$i.isSilenced &&
		!instance.disableLocalTimeline &&
		!props.forceSpecified

);
let canHome = $ref(
	(!reply || ["public", "home"].includes(reply.visibility)) &&
		(!props.renote ||
			["public", "home"].includes(props.renote.visibility)) &&
		(!props.airReply ||
			["public", "home"].includes(props.initialVisibility)) &&
		!$i.blockPostHome &&
		!$i.isSilenced &&
		!props.forceSpecified
);
let canFollower = $ref(
	(!reply || reply.visibility !== "specified") &&
		(!props.renote || props.renote.visibility !== "specified") &&
		(!props.airReply || props.initialVisibility !== "specified") &&
		!props.forceSpecified
);
let canNotLocal = $ref(
	(!reply || !reply.localOnly) &&
		(!props.renote || !props.renote.localOnly) &&
		(!props.airReply || !props.airReply.localOnly) &&
		!$i.blockPostNotLocal &&
		!$i.isSilenced &&
		!props.channel?.description?.includes("[localOnly]")
);
let canCc = $computed(
	() =>
		visibility === "specified" &&
		defaultStore.state.enabledSpecifiedCc &&
		$i?.canInvite &&
		!props.forceSpecified
);
let inheritCc = $ref(!reply?.user?.host);
let requiredFilename = $ref(
	props.channel?.description?.includes("[requiredFilename]")
);
let imeText = $ref("");
let shortcutKeyValue = $ref(0);
let filePromises = $ref<Promise<void>[]>([]);
let fileError = $ref(false);
let referencesFlg = $ref(true);

//#region 投稿重複抑止
/**
 * 投稿重複抑止用の署名キーに対応する pending 情報。
 *
 * @remarks
 * NOTE: 送信中の同一内容投稿を抑止するために使う短命な状態。
 * @internal
 */
type PendingPostEntry = {
	draftKey: string;
	createdAt: number;
};

/**
 * ストリーミング購読の参照を保持する。
 *
 * @remarks
 * NOTE: コンポーネント破棄時に確実に dispose するために保持する。
 * @internal
 */
let mainStreamConnection: ReturnType<typeof stream.useChannel> | null = null;

/**
 * 送信待ち投稿の署名一覧。
 *
 * @remarks
 * NOTE: キーは CW/本文と投稿文脈から生成した署名文字列。
 * @internal
 */
const pendingPostBySignature = new Map<string, PendingPostEntry>();

/**
 * 署名比較用の文字列に正規化する。
 *
 * @param value - 正規化対象の値
 * @returns null/undefined を空文字へ揃えた比較用文字列
 * @internal
 */
function normalizeSignatureValue(value: string | null | undefined): string {
	return typeof value === "string" ? value : "";
}

/**
 * 投稿 payload から重複抑止署名を構築する。
 *
 * @remarks
 * NOTE: `visibility` と `localOnly` は仕様により一致条件へ含めない。
 * @param payload - 投稿 API に送る payload
 * @param postingAccountId - 実際に投稿するアカウント ID
 * @returns 比較に使う署名文字列
 * @internal
 */
function buildPostDeduplicationSignature(
	payload: PostPayload,
	postingAccountId: string,
): string {
	return JSON.stringify({
		cw: normalizeSignatureValue(payload.cw),
		text: normalizeSignatureValue(payload.text),
		postingAccountId,
		replyId: normalizeSignatureValue(payload.replyId),
		renoteId: normalizeSignatureValue(payload.renoteId),
		channelId: normalizeSignatureValue(payload.channelId),
	});
}

/**
 * ストリーミング受信ノートから重複抑止署名を構築する。
 *
 * @param note - ストリーミングで受信したノート
 * @returns 受信ノートに対応する署名文字列
 * @internal
 */
function buildPostDeduplicationSignatureFromStreamNote(
	note: misskey.entities.Note,
): string {
	return JSON.stringify({
		cw: normalizeSignatureValue(note.cw),
		text: normalizeSignatureValue(note.text),
		postingAccountId: normalizeSignatureValue(note.userId),
		replyId: normalizeSignatureValue(note.replyId),
		renoteId: normalizeSignatureValue(
			(note as any).renoteId ?? (note as any).renote?.id,
		),
		channelId: normalizeSignatureValue((note as any).channelId),
	});
}

/**
 * ストリーミング一致時に削除してよい下書きキーかを判定する。
 *
 * @param key - 判定対象の下書きキー
 * @returns 通常投稿系キーのみ true
 * @internal
 */
function isStreamSyncDeletableDraftKey(key: string): boolean {
	return (
		key === "note" ||
		key.startsWith("note:") ||
		key.startsWith("reply:") ||
		key.startsWith("renote:") ||
		key.startsWith("air:") ||
		key.startsWith("channel:")
	);
}

/**
 * 送信待ち署名を登録する。
 *
 * @param signature - 投稿内容を識別する署名
 * @param currentDraftKey - 登録時点の下書きキー
 * @internal
 */
function registerPendingPostSignature(signature: string, currentDraftKey: string): void {
	pendingPostBySignature.set(signature, {
		draftKey: currentDraftKey,
		createdAt: Date.now(),
	});
}

/**
 * 送信待ち署名を解除する。
 *
 * @param signature - 解除対象の署名
 * @returns 解除した pending 情報
 * @internal
 */
function clearPendingPostSignature(signature: string): PendingPostEntry | undefined {
	const entry = pendingPostBySignature.get(signature);
	if (!entry) return undefined;
	pendingPostBySignature.delete(signature);
	return entry;
}

/**
 * ストリーミング受信内容と pending を照合して、必要なら解除と下書き同期を行う。
 *
 * @param note - ストリーミングで受信したノート
 * @internal
 */
function syncPendingPostByStream(note: misskey.entities.Note): void {
	if (note.userId !== $i.id) return;

	const signature = buildPostDeduplicationSignatureFromStreamNote(note);
	const matched = clearPendingPostSignature(signature);
	if (!matched) return;

	if (isStreamSyncDeletableDraftKey(matched.draftKey)) {
		deleteDraft(matched.draftKey);
	}
}
//#endregion

function enqueueUpload(
        promiseFactory: () => Promise<misskey.entities.DriveFile[] | misskey.entities.DriveFile>,
): Promise<void> {
        fileError = false;

        let basePromise: Promise<misskey.entities.DriveFile[] | misskey.entities.DriveFile>;
        try {
                basePromise = promiseFactory();
        } catch (err) {
                fileError = true;
                throw err;
        }

        const trackedPromise = basePromise
                .then((result) => (Array.isArray(result) ? result : [result]))
                .then((result) => {
                        for (const file of result) {
                                files.push(file);
                        }
                })
                .catch((err) => {
                        fileError = true;
                        throw err;
                })
                .finally(() => {
                        filePromises = filePromises.filter((p) => p !== trackedPromise);
                });

        filePromises.push(trackedPromise);
        return trackedPromise;
}

const publicIcon = $computed((): String => {
	if (!canNotLocal && (canPublic || canHome)) {
		if (canPublic) {
			return "ph-hand-heart ph-bold ph-lg";
		} else {
			if (!$i.blockPostNotLocalPublic) {
				return "ph-house-line ph-bold ph-lg";
			}
		}
	}
	if (canPublic) {
		return "ph-planet ph-bold ph-lg";
	} else if (canHome) {
		return "ph-house ph-bold ph-lg";
	} else if (canFollower) {
		return "ph-lock-simple ph-bold ph-lg";
	} else {
		return "ph-envelope-simple-open ph-bold ph-lg";
	}
});

const homeIcon = $computed((): String => {
	if (!canNotLocal && canHome && !$i.blockPostNotLocalPublic) {
		return "ph-house-line ph-bold ph-lg";
	} else if (canHome) {
		return "ph-house ph-bold ph-lg";
	} else if (canFollower) {
		return "ph-lock-simple ph-bold ph-lg";
	} else {
		return "ph-envelope-simple-open ph-bold ph-lg";
	}
});

const followerIcon = $computed((): String => {
	if (canFollower) {
		return "ph-lock-simple ph-bold ph-lg";
	} else {
		return "ph-envelope-simple-open ph-bold ph-lg";
	}
});

const localIcon = $computed((): String => {
	if (canPublic) {
		return "ph-hand-heart ph-bold ph-lg";
	} else if (canHome) {
		return "ph-house-line ph-bold ph-lg";
	} else if (canFollower) {
		return "ph-lock-simple ph-bold ph-lg";
	} else {
		return "ph-envelope-simple-open ph-bold ph-lg";
	}
});

const localHomeIcon = $computed((): String => {
	if (canHome) {
		return "ph-house-line ph-bold ph-lg";
	} else if (canFollower) {
		return "ph-lock-simple ph-bold ph-lg";
	} else {
		return "ph-envelope-simple-open ph-bold ph-lg";
	}
});

const typing = throttle(3000, () => {
	if (props.channel) {
		stream.send("typingOnChannel", { channel: props.channel.id });
	}
});

const isChannel = $computed((): boolean => {
	return !!props.channel;
});

const draftKey = $computed((): string => {
	let key = props.channel ? `channel:${props.channel.id}` : "";

	if (props.renote) {
		key += `renote:${props.renote.id}`;
	} else if (reply) {
		key += `reply:${reply.id}`;
	} else if (replyId) {
		key += `reply:${replyId}`;
	} else if (props.airReply) {
		key += `air:${props.airReply.id}`;
	} else if (props.initialNote) {
		key += `edit:${props.initialNote.id}`;
	} else {
		key += "note";
		if (props.key) key += `:${props.key}`;
	}

	return key;
});

const placeholder = $computed((): string => {
	if (props.renote) {
		return i18n.ts._postForm.quotePlaceholder;
	} else if (reply) {
		return i18n.ts._postForm.replyPlaceholder;
	} else if (props.channel) {
		return i18n.ts._postForm.channelPlaceholder;
	} else if (defaultStore.state.plusInfoPostForm) {
		return (
			(i18n.ts._visibility[visibility] &&
			(defaultStore.state.rememberNoteVisibility ||
				!defaultStore.state.firstPostButtonVisibilityForce ||
				visibility === "specified")
				? `${
						(localOnly ? "ローカル" : "") +
						i18n.ts._visibility[visibility] +
						(localOnly ? "/リモートフォロワー" : "")
				  } : `
				: "") +
			new Date()
				.toLocaleTimeString("ja-JP", {
					year: "numeric",
					month: "long",
					day: "numeric",
					weekday: "long",
					hour: "2-digit",
					minute: "2-digit",
				})
				.replace(/日(.*)\s(\d+):(\d+)/, "日($1) $2時$3分")
		);
	} else {
		const xs = [
			i18n.ts._postForm._placeholders.a,
			i18n.ts._postForm._placeholders.b,
			i18n.ts._postForm._placeholders.c,
			i18n.ts._postForm._placeholders.d,
			i18n.ts._postForm._placeholders.e,
			i18n.ts._postForm._placeholders.f,
		];
		return xs[Math.floor(Math.random() * xs.length)];
	}
});

const submitText = $computed((): string => {
	return props.renote ? i18n.ts.quote : reply ? i18n.ts.reply : i18n.ts.note;
});

const zeroWidthSpace = "\u200B";

type QuickVisibilityType = string;

type QuickPostBehavior =
        | { type: "post" }
        | { type: "quick"; quickType: QuickVisibilityType }
        | { type: "custom"; handler: () => void };

interface QuickPostButtonConfig {
        key: string;
        label: string;
        buttonClass: string;
        classObject?: Record<string, boolean>;
        disabled: boolean;
        iconClass: string;
        extraIconClass?: string;
        behavior: QuickPostBehavior;
}

interface QuickVisibilitySlot {
        quickType: QuickVisibilityType;
        order: number | null;
        isEnabled: boolean;
        visibilityValue: string;
        isWide: boolean;
}

interface QuickVisibilityPreset {
        quickType: QuickVisibilityType;
        order: number | null;
        isEnabled: boolean;
        parsed: { visibility: (typeof misskey.noteVisibilities)[number]; localOnly: boolean };
        isWide: boolean;
}

function joinClasses(...classes: (string | false | null | undefined)[]): string {
        return classes.filter(Boolean).join(" ");
}

function parseVisibilitySetting(
	value: string
): { visibility: (typeof misskey.noteVisibilities)[number]; localOnly: boolean } {
	if (value.startsWith("l-")) {
		return {
			visibility: value.slice(2) as (typeof misskey.noteVisibilities)[number],
			localOnly: true,
		};
	}
	return {
		visibility: value as (typeof misskey.noteVisibilities)[number],
		localOnly: false,
	};
}

function getVisibilityIconClass(
	targetVisibility: (typeof misskey.noteVisibilities)[number],
	isLocal: boolean
): string {
	if (targetVisibility === "public") {
		return isLocal ? localIcon : publicIcon;
	}
	if (targetVisibility === "home") {
		return isLocal ? localHomeIcon : homeIcon;
	}
	if (targetVisibility === "followers") {
		return followerIcon;
	}
	return "ph-envelope-simple-open ph-bold ph-lg";
}

function createShortcutClasses(target: number | null): Record<string, boolean> | undefined {
        if (target == null) return undefined;
        return {
                shortcutTarget: shortcutKeyValue === target,
                notShortcutTarget:
                        shortcutKeyValue !== 0 && shortcutKeyValue !== target,
        };
}

const ORDINAL_BASE: Record<string, number> = {
        first: 1,
        second: 2,
        third: 3,
        fourth: 4,
        fifth: 5,
        sixth: 6,
        seventh: 7,
        eighth: 8,
        ninth: 9,
};

const ORDINAL_TEENS: Record<string, number> = {
        tenth: 10,
        eleventh: 11,
        twelfth: 12,
        thirteenth: 13,
        fourteenth: 14,
        fifteenth: 15,
        sixteenth: 16,
        seventeenth: 17,
        eighteenth: 18,
        nineteenth: 19,
};

const ORDINAL_TENS: Record<string, number> = {
        twentieth: 20,
        thirtieth: 30,
        fortieth: 40,
        fiftieth: 50,
        sixtieth: 60,
        seventieth: 70,
        eightieth: 80,
        ninetieth: 90,
        hundredth: 100,
};

const ORDINAL_TENS_PREFIX: Record<string, number> = {
        twenty: 20,
        thirty: 30,
        forty: 40,
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90,
        hundred: 100,
};

function ordinalWordToNumber(word: string): number | null {
        const normalized = word.toLowerCase();
        const digitMatch = normalized.match(/^([0-9]+)(?:st|nd|rd|th)$/);
        if (digitMatch) {
                return Number(digitMatch[1]);
        }
        if (normalized in ORDINAL_BASE) return ORDINAL_BASE[normalized];
        if (normalized in ORDINAL_TEENS) return ORDINAL_TEENS[normalized];
        if (normalized in ORDINAL_TENS) return ORDINAL_TENS[normalized];

        for (const [prefix, tensValue] of Object.entries(ORDINAL_TENS_PREFIX)) {
                if (!normalized.startsWith(prefix)) continue;
                const suffix = normalized.slice(prefix.length);
                if (suffix.length === 0) continue;
                if (suffix in ORDINAL_BASE) {
                        return tensValue + ORDINAL_BASE[suffix];
                }
                if (suffix in ORDINAL_TEENS) {
                        return tensValue + ORDINAL_TEENS[suffix];
                }
        }

        return null;
}

function createSequentialQuickVisibilitySlots(
        storeState: typeof defaultStore.state
): QuickVisibilitySlot[] {
        const rawState = storeState as Record<string, unknown>;
        const slots: QuickVisibilitySlot[] = [];
        const visibilityPattern = /^([a-zA-Z0-9]+)PostVisibility$/;

        for (const key of Object.keys(rawState)) {
                const match = key.match(visibilityPattern);
                if (!match) continue;
                const quickType = match[1];
                if (quickType === "first") continue;

                const buttonKey = `${quickType}PostButton`;
                if (!(buttonKey in rawState)) continue;

                const visibilityValue = (rawState[key] as string | undefined) ?? "public";
                const isEnabled = Boolean(rawState[buttonKey]);
                const wideKey = `${quickType}PostWideButton`;
                const isWide = Boolean(rawState[wideKey]);

                slots.push({
                        quickType,
                        order: ordinalWordToNumber(quickType),
                        isEnabled,
                        visibilityValue,
                        isWide,
                });
        }

        return slots.sort((a, b) => {
                const orderA = a.order;
                const orderB = b.order;

                if (orderA == null && orderB == null) {
                        return a.quickType.localeCompare(b.quickType);
                }
                if (orderA == null) return 1;
                if (orderB == null) return -1;
                if (orderA !== orderB) {
                        return orderA - orderB;
                }
                return a.quickType.localeCompare(b.quickType);
        });
}

const quickVisibilityPresets = $computed<QuickVisibilityPreset[]>(() => {
        return createSequentialQuickVisibilitySlots(defaultStore.state).map((slot) => ({
                quickType: slot.quickType,
                order: slot.order,
                isEnabled: slot.isEnabled,
                parsed: parseVisibilitySetting(slot.visibilityValue),
                isWide: slot.isWide,
        }));
});

const quickVisibilitySettingMap = $computed<Record<string, QuickVisibilityPreset["parsed"]>>(() => {
        const map: Record<string, QuickVisibilityPreset["parsed"]> = {};
        for (const preset of quickVisibilityPresets) {
                map[preset.quickType] = preset.parsed;
        }
        return map;
});

const submitButtonConfigs = $computed<QuickPostButtonConfig[]>(() => {
        const storeState = defaultStore.state;
        const buttons: QuickPostButtonConfig[] = [];

	const defaultIcon = reply
		? "ph-arrow-u-up-left ph-bold ph-lg"
		: renote
		? "ph-quotes ph-bold ph-lg"
		: "ph-paper-plane-tilt ph-bold ph-lg";

	const firstSetting = {
		visibility: storeState.defaultNoteVisibility as (typeof misskey.noteVisibilities)[number],
		localOnly: storeState.defaultNoteLocalAndFollower === true,
	};

	const replyOrRenoteIcon = reply
		? "ph-arrow-u-up-left ph-bold ph-lg"
		: renote
		? "ph-quotes ph-bold ph-lg"
		: undefined;

	const addButton = (
		key: string,
		condition: boolean,
		config: Omit<QuickPostButtonConfig, "key">
	) => {
		if (condition) {
			buttons.push({ key, ...config });
		}
	};

	addButton(
		"primary-text",
		((storeState.rememberNoteVisibility || !storeState.firstPostButtonVisibilityForce) &&
				!storeState.secondPostButton) ||
			(!storeState.channelSecondPostButton && isChannel) ||
			visibility === "specified",
		{
			label: submitText,
			buttonClass: "submit _buttonGradate",
			classObject: createShortcutClasses(1),
			disabled: !canPost,
			iconClass: defaultIcon,
			behavior: { type: "post" },
		}
	);

	addButton(
		"primary-text-forced",
		!storeState.rememberNoteVisibility &&
			storeState.firstPostButtonVisibilityForce &&
			!storeState.secondPostButton &&
			!isChannel &&
			visibility !== "specified",
		{
			label: submitText,
			buttonClass: "submit _buttonGradate",
			classObject: createShortcutClasses(1),
			disabled: !canPost,
			iconClass: getVisibilityIconClass(firstSetting.visibility, firstSetting.localOnly),
			extraIconClass: replyOrRenoteIcon,
			behavior: { type: "quick", quickType: "first" },
		}
	);

        const sequentialQuickButtons: {
                key: string;
                config: Omit<QuickPostButtonConfig, "key">;
        }[] = [];
        for (const preset of quickVisibilityPresets) {
                if (preset.order != null && !preset.isEnabled) {
                        break;
                }
                if (!preset.isEnabled) {
                        continue;
                }
                sequentialQuickButtons.unshift({
                        key: `quick-${preset.quickType}`,
                        config: {
                                label: zeroWidthSpace,
                                buttonClass: "submit_h _buttonGradate",
                                classObject: createShortcutClasses(preset.order ?? null),
                                disabled:
                                        !canPost &&
                                        preset.parsed.visibility !== "specified",
                                iconClass: joinClasses(
                                        getVisibilityIconClass(
                                                preset.parsed.visibility,
                                                preset.parsed.localOnly
                                        ),
                                        preset.isWide ? "widePostButton" : undefined
                                ),
                                behavior: {
                                        type: "quick",
                                        quickType: preset.quickType,
                                },
                        },
                });
        }
        for (const entry of sequentialQuickButtons) {
                addButton(entry.key, !isChannel && visibility !== "specified", entry.config);
        }

	addButton(
		"quick-primary",
		(storeState.rememberNoteVisibility || !storeState.firstPostButtonVisibilityForce) &&
			storeState.secondPostButton &&
			!isChannel &&
			visibility !== "specified",
		{
			label: zeroWidthSpace,
			buttonClass: "submit_h _buttonGradate",
			classObject: createShortcutClasses(1),
			disabled: !canPost,
			iconClass: joinClasses(
				defaultIcon,
				storeState.firstPostWideButton ? "widePostButton" : undefined
			),
			behavior: { type: "post" },
		}
	);

	addButton(
		"quick-first",
		!storeState.rememberNoteVisibility &&
			storeState.firstPostButtonVisibilityForce &&
			storeState.secondPostButton &&
			!isChannel &&
			visibility !== "specified",
		{
			label: zeroWidthSpace,
			buttonClass: "submit_h _buttonGradate",
			classObject: createShortcutClasses(1),
			disabled: !canPost && storeState.defaultNoteVisibility !== "specified",
			iconClass: joinClasses(
				getVisibilityIconClass(firstSetting.visibility, firstSetting.localOnly),
				storeState.firstPostWideButton
					? replyOrRenoteIcon
						? "widePostButton_left"
						: "widePostButton"
					: undefined
			),
			extraIconClass: replyOrRenoteIcon
				? joinClasses(
					"subPostIcon",
					replyOrRenoteIcon,
					storeState.firstPostWideButton ? "widePostButton_right" : undefined
				)
				: undefined,
			behavior: { type: "quick", quickType: "first" },
		}
	);

	addButton(
		"channel-second",
		storeState.channelSecondPostButton && isChannel,
		{
			label: zeroWidthSpace,
			buttonClass: "submit_h _buttonGradate",
			disabled: !canPost,
			iconClass: "ph-hand-fist ph-bold ph-lg widePostButton",
			behavior: { type: "custom", handler: postSecondChannel },
		}
	);

	addButton(
		"channel-primary",
		storeState.channelSecondPostButton && isChannel && canNotLocal,
		{
			label: zeroWidthSpace,
			buttonClass: "submit_h _buttonGradate",
			disabled: !canPost,
			iconClass: joinClasses(defaultIcon, "widePostButton"),
			behavior: { type: "post" },
		}
	);

	return buttons;
});

const textLength = $computed((): number => {
	return length((preprocess(text) + imeText).trim());
});

const maxTextLength = $computed((): number => {
	return instance ? instance.maxNoteTextLength : 1000;
});

const canPost = $computed((): boolean => {
	return (
		!posting &&
		(
			1 <= textLength ||
			(withHashtags && hashtags && typeof hashtags === "string" && 1 <= hashtags.trim().length) ||
                        1 <= files.length ||
                        filePromises.length > 0 ||
			!!poll ||
			!!props.renote ||
			!!quoteId ||
			(!!referencesFlg && referenceIds?.length)) &&
		textLength <= maxTextLength &&
		(!poll || poll.choices.length >= 1)
	);
});

const withHashtags = $computed(
	defaultStore.makeGetterSetter("postFormWithHashtags")
);
const hashtags = $computed(defaultStore.makeGetterSetter("postFormHashtags"));
const referenceIds = $computed(defaultStore.makeGetterSetter("postFormReferenceIds"));

if (props.initialHashTags) {
	hashtags = [(withHashtags && hashtags ? hashtags : null), props.initialHashTags].filter(Boolean).join(" ") ?? "";
	withHashtags = true;
}

const hashtagsPreview = $computed(() => {
	if (withHashtags && hashtags && hashtags.trim() !== "") {
		const textHashtags_ = mfm
			.parse(text)
			.filter((x) => x.type === "hashtag")
			.map((x) =>
				x.props.hashtag.startsWith("#")
					? x.props.hashtag
					: `#${x.props.hashtag}`
			);
		const hashtags_ = hashtags
			.trim()
			.split(" ")
			.map((x) => (x.startsWith("#") ? x : `#${x}`));
		const hashtags__ = hashtags_
			.filter((x) => !textHashtags_.includes(x))
			.join(" ");
		return hashtags__;
	} else {
		return "";
	}
});

watch($$(text), () => {
	checkIncludesOtherServerEmoji();
	checkMissingMention();
});

watch($$(visibility), () => {
	checkIncludesOtherServerEmoji();
	checkMissingMention();
});

watch(
	$$(visibleUsers),
	() => {
		checkMissingMention();
	},
	{
		deep: true,
	}
);

if (props.mention) {
	text = props.mention.host
		? `@${props.mention.username}@${toASCII(props.mention.host)}`
		: `@${props.mention.username}`;
	text += " ";
}

if (
	reply &&
	(reply.user.username !== $i.username ||
		(reply.user.host != null && reply.user.host !== host))
) {
	text = `@${reply.user.username}${
		reply.user.host != null ? `@${toASCII(reply.user.host)}` : ""
	} `;
}

if (reply && reply.text != null && props.replyAllMentions !== false) {
	const ast = mfm.parse(reply.text);
	const otherHost = reply.user.host;

	for (const x of extractMentions(ast)) {
		const mention = x.host
			? `@${x.username}@${toASCII(x.host)}`
			: otherHost == null || otherHost === host
			? `@${x.username}`
			: `@${x.username}@${toASCII(otherHost)}`;

		// 自分は除外
		if ($i.username === x.username && (x.host == null || x.host === host))
			continue;

		// 重複は除外
		if (text.includes(`${mention} `)) continue;

		text += `${mention} `;
	}
}

if (props.channel) {
	visibility = "public";
	localOnly = defaultStore.state.channelSecondPostButton
		? false
		: defaultStore.state.rememberNoteVisibility
		? defaultStore.state.localOnly
		: defaultStore.state.defaultNoteLocalOnly;
	if (!canNotLocal) localOnly = true;
}

// 公開以外へのリプライ時は元の公開範囲を引き継ぐ
if (reply && ["home", "followers", "specified"].includes(reply.visibility)) {
	if (reply.visibility === "home" && visibility === "followers") {
		visibility = "followers";
	} else if (
		["home", "followers"].includes(reply.visibility) &&
		visibility === "specified"
	) {
		visibility = "specified";
	} else {
		visibility = reply.visibility;
	}
	if (visibility === "specified") {
		if (reply.visibleUserIds) {
			os.api("users/show", {
				userIds: reply.visibleUserIds.filter(
					(uid) => uid !== $i.id && uid !== reply.userId
				),
			}).then((users) => {
				users.forEach(pushVisibleUser);
			});
		}

		if (reply.userId !== $i.id) {
			os.api("users/show", { userId: reply.userId }).then((user) => {
				pushVisibleUser(user);
			});
		}
	}
}

if (props.specified) {
	visibility = "specified";
	pushVisibleUser(props.specified);
}

if (!canPublic && visibility === "public") visibility = "home";
if (!canHome && visibility === "home") visibility = "followers";
if (!canFollower && visibility === "followers") visibility = "specified";
if (
	!canNotLocal &&
	visibility !== "followers" &&
	visibility !== "specified" &&
	localOnly === false &&
	!$i.blockPostNotLocalPublic
)
	localOnly = true;

// keep post cw
if (
	defaultStore.state.keepPostCw &&
	cw &&
	!cw.includes("@") &&
	!(reply && !reply.cw)
) {
	useCw = true;
} else {
	cw = "";
}
// keep cw when reply
if (defaultStore.state.keepCw && reply && reply.cw && !reply.user?.isBot) {
	useCw = true;
	if (reply.userId === $i.id) {
		cw = `${reply.cw}`;
	} else {
		const replyCwText =
			reply.cw?.replaceAll(/(@[^\s]+\s)*(Re:\s?)/gi, "") ?? "";
		cw = `@${reply.user.username}${
			reply.user.host ? `@${reply.user.host}` : ""
		} Re: ${replyCwText}`;
		text = text.replace(
			`@${reply.user.username}${
				reply.user.host ? `@${reply.user.host}` : ""
			} `,
			""
		);
	}
}

// keep cw when airreply
if (defaultStore.state.keepCw && props.airReply && props.airReply.cw) {
        useCw = true;
        const replyCwText =
                props.airReply.cw?.replaceAll(/(@[^\s]+\s)*(Re:\s?)/gi, "") ?? "";
        cw = replyCwText;
}

const debouncedSaveDraft = debounce(300, () => {
        saveDraft();
});

function watchForDraft() {
        watch($$(text), debouncedSaveDraft);
        watch($$(useCw), debouncedSaveDraft);
        watch($$(cw), debouncedSaveDraft);
        watch($$(poll), debouncedSaveDraft);
        watch($$(files), debouncedSaveDraft, { deep: true });
        watch($$(visibility), debouncedSaveDraft);
        watch($$(localOnly), debouncedSaveDraft);
        watch($$(referencesFlg), debouncedSaveDraft);
        watch($$(postLocked), debouncedSaveDraft);
}

function checkIncludesOtherServerEmoji() {
	if (/:\w+(@[\w\-.]+\.[\w\-.]+):/.test(text)) {
		includesOtherServerEmoji = true;
	} else {
		includesOtherServerEmoji = false;
	}
}

function checkMissingMention() {
	if (visibility === "specified") {
		if (
			reply &&
			reply.userId !== $i.id &&
			!visibleUsers.some((u) => u.id === reply.user.id)
		) {
			hasNotSpecifiedMentions = true;
			return;
		}
		const ast = mfm.parse(text);

		for (const x of extractMentions(ast)) {
			if (
				!visibleUsers.some(
					(u) =>
						u.username === x.username &&
						(!x.host || u.host === x.host)
				)
			) {
				hasNotSpecifiedMentions = true;
				return;
			}
		}
		hasNotSpecifiedMentions = false;
	} else {
		if (!reply) {
			const ast = mfm.parse(text);
			if (extractMentions(ast)?.length) {
				hasNotMentions = true;
			} else {
				hasNotMentions = false;
			}
		}
	}
}

function addMissingMention() {
	if (
		reply &&
		reply.userId !== $i.id &&
		!visibleUsers.some((u) => u.id === reply.user.id)
	) {
		os.api("users/show", { userId: reply.userId }).then((user) => {
			pushVisibleUser(user);
		});
	}

	const ast = mfm.parse(text);

	for (const x of extractMentions(ast)) {
		if (
			!visibleUsers.some(
				(u) =>
					u.username === x.username && (!x.host || u.host === x.host)
			)
		) {
			os.api("users/show", { username: x.username, host: x.host }).then(
				(user) => {
					pushVisibleUser(user);
				}
			);
		}
	}
}

function togglePoll() {
	if (poll) {
		poll = null;
	} else {
		// 新規投票は期限なしで渡し、MkPollEditor 側で defaultStore の前回モードを復元する
		poll = {
			choices: ["", ""],
			multiple: false,
			expiresAt: null,
			expiredAfter: null,
			hideResults: defaultStore.state.postFormPollHideResults,
		};
	}
}

function toggleUseCw() {
	if (useCw) {
		// ON -> OFF
		const mention = /^(@[\w@.-]+\s?)(.*)$/.exec(cw);
		if (mention != null) {
			cw = mention?.[2];
			text = `${mention[1].trim()} ${text}`;
		}
	} else {
		// OFF -> ON
		const mention = /^(@[\w@.-]+\s?)(.*)$/.exec(text);
		if (mention != null) {
			text = mention?.[2];
			cw = `${mention[1].trim()} ${cw}`;
		}
	}
	useCw = !useCw;
}

function addTag(tag: string) {
	insertTextAtCursor(textareaEl, ` #${tag} `);
}

function focus() {
	if (textareaEl) {
		textareaEl.focus();
		textareaEl.setSelectionRange(
			textareaEl.value.length,
			textareaEl.value.length
		);
	}
}

function chooseFileFrom(ev) {
        enqueueUpload(() =>
                selectFiles(
                        ev.currentTarget ?? ev.target,
                        i18n.ts.attachFile,
                        requiredFilename,
                ),
        );
}

function detachFile(id) {
	files = files.filter((x) => x.id !== id);
}

/** 添付をクロップ済み画像で差し替える（同じ並び順を維持）。 */
function replaceFile(payload: { oldId: string; newFile: misskey.entities.DriveFile }) {
	files = files.map((f) =>
		f.id === payload.oldId ? payload.newFile : f,
	);
}

function updateFiles(_files) {
	files = _files;
}

function updateFileSensitive(file, sensitive) {
	files[files.findIndex((x) => x.id === file.id)].isSensitive = sensitive;
}

function updateFileName(file, name) {
	files[files.findIndex((x) => x.id === file.id)].name = name;
}

function upload(file: File, name?: string, options?: UploadFileOptions) {
        enqueueUpload(() =>
                uploadFile(
                        file,
                        defaultStore.state.uploadFolder,
                        name,
                        undefined,
                        undefined,
                        requiredFilename,
                        options,
                ),
        );
}

function setVisibility() {
	const isForce =
		!defaultStore.state.rememberNoteVisibility &&
		defaultStore.state.firstPostButtonVisibilityForce;

	os.popup(
		defineAsyncComponent(
			() => import("@/components/MkVisibilityPicker.vue")
		),
		{
			currentVisibility: visibility,
			currentLocalOnly: localOnly,
			src: visibilityButton,
			canLocalSwitch: props.channel,
			canVisibilitySwitch: !props.channel && !isForce,
			forceMode: !props.channel && isForce,
			canPublic,
			canHome,
			canFollower,
			canNotLocal,
			canDirect: true,
		},
		{
			changeVisibility: (v) => {
				visibility = v;
				specifiedCheck();
				if (defaultStore.state.rememberNoteVisibility) {
					defaultStore.set("visibility", visibility);
				}
			},
			changeLocalOnly: (v) => {
				localOnly = v;
				if (defaultStore.state.rememberNoteVisibility) {
					if (props.channel) {
						defaultStore.set("localOnly", localOnly);
					} else {
						defaultStore.set("localAndFollower", localOnly);
					}
				}
			},
		},
		"closed"
	);
}

function pushVisibleUser(user) {
	if (
		!visibleUsers.some(
			(u) =>
				u.username === user.username &&
				(!user.host || u.host === user.host)
		)
	) {
		visibleUsers.push(user);
		saveDraft();
	}
}

function addVisibleUser() {
	os.selectUser().then((user) => {
		pushVisibleUser(user);
	});
}

function removeVisibleUser(user) {
	visibleUsers = erase(user, visibleUsers);
}

function pushVisibleUserCc(user) {
	if (
		!user.host &&
		!visibleUsersCc.some(
			(u) =>
				u.username === user.username &&
				(!user.host || u.host === user.host)
		)
	) {
		visibleUsersCc.push(user);
	}
}

function addVisibleUserCc() {
	os.selectUser().then((user) => {
		pushVisibleUserCc(user);
	});
}

async function addVisibleUserCcToList() {
	const lists = await os.api("users/lists/list");
	const { canceled, result: list } = await os.select({
		title: i18n.ts.selectList,
		items: lists.map((x) => ({
			value: x,
			text: x.name,
		})),
	});
	if (canceled) return;
	os.api("users/show", {
		userIds: list.userIds,
	}).then((users) => {
		users.forEach((u) => pushVisibleUserCc(u));
	});
}

function removeVisibleUserCc(user) {
	visibleUsersCc = erase(user, visibleUsersCc);
}

function backupData() {
	backupPostData = {
		text,
		cw,
		files,
		poll,
		quoteId,
		referenceIds: referencesFlg ? referenceIds : undefined,
	}
}

function restoreData() {
  if (!referenceIds?.length && backupPostData?.referenceIds) referenceIds = backupPostData.referenceIds;
}

function clear() {
	text = "";
	cw = "";
	files = [];
	poll = null;
	quoteId = null;
	if (referencesFlg) referenceIds = [];
}

function onKeyup(ev: KeyboardEvent) {
	let postButtonMax = defaultStore.state.secondPostButton
		? defaultStore.state.thirdPostButton
			? defaultStore.state.fourthPostButton
				? defaultStore.state.fifthPostButton
					? 5
					: 4
				: 3
			: 2
		: 1;
	let postValue = Math.min(
		(ev.ctrlKey || ev.metaKey ? 1 : 0) +
			(ev.altKey ? 2 : 0) +
			(ev.shiftKey && (ev.ctrlKey || ev.metaKey || ev.altKey) ? 2 : 0),
		postButtonMax
	);
	if (postValue !== unref(shortcutKeyValue) && !isChannel) {
		shortcutKeyValue = postValue;
	}
}

function onKeydown(ev: KeyboardEvent) {
	let postButtonMax = defaultStore.state.secondPostButton
		? defaultStore.state.thirdPostButton
			? defaultStore.state.fourthPostButton
				? defaultStore.state.fifthPostButton
					? 5
					: 4
				: 3
			: 2
		: 1;
	let postValue = Math.min(
		(ev.ctrlKey || ev.metaKey ? 1 : 0) +
			(ev.altKey ? 2 : 0) +
			(ev.shiftKey && (ev.ctrlKey || ev.metaKey || ev.altKey) ? 2 : 0),
		postButtonMax
	);
	if (postValue !== unref(shortcutKeyValue) && !isChannel) {
		shortcutKeyValue = postValue;
	}
	// NB: 投稿ロック中はあらゆる Ctrl/Alt + Enter 系の投稿ショートカットを無効化する
	//     （Esc によるモーダル閉じや IME 入力ハンドリングは引き続き有効）
	if (
		postLocked &&
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 1
	) {
		typing();
		return;
	}
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 5 &&
		defaultStore.state.fifthPostButton &&
		(canPost || defaultStore.state.fifthPostVisibility === "specified") &&
		!isChannel &&
		visibility !== "specified"
	)
		performQuickPost("fifth");
	else if (
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 4 &&
		defaultStore.state.fourthPostButton &&
		(canPost || defaultStore.state.fourthPostVisibility === "specified") &&
		!isChannel &&
		visibility !== "specified"
	)
		performQuickPost("fourth");
	else if (
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 3 &&
		defaultStore.state.thirdPostButton &&
		(canPost || defaultStore.state.thirdPostVisibility === "specified") &&
		!isChannel &&
		visibility !== "specified"
	)
		performQuickPost("third");
	else if (
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 2 &&
		defaultStore.state.secondPostButton &&
		(canPost || defaultStore.state.secondPostVisibility === "specified") &&
		!isChannel &&
		visibility !== "specified"
	)
		performQuickPost("second");
	else if (
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 1 &&
		canPost &&
		visibility !== "specified"
	)
		performQuickPost("first");
	else if (
		(ev.which === 10 || ev.which === 13) &&
		postValue >= 1 &&
		canPost &&
		visibility === "specified"
	)
		post();
	if (ev.which === 27) emit("esc");
	typing();
}

function onCompositionUpdate(ev: CompositionEvent) {
	imeText = ev.data;
	typing();
}

function onCompositionEnd(ev: CompositionEvent) {
	imeText = "";
}

async function onPaste(ev: ClipboardEvent) {
	for (const { item, i } of Array.from(ev.clipboardData.items).map(
		(item, i) => ({ item, i })
	)) {
		if (item.kind === "file") {
			const file = item.getAsFile();
			const lio = file.name.lastIndexOf(".");
			const ext = lio >= 0 ? file.name.slice(lio) : "";
			const formatted = `${formatTimeString(
				new Date(file.lastModified),
				defaultStore.state.pastedFileName
			).replace(/{{number}}/g, `${i + 1}`)}${ext}`;
			upload(file, formatted);
		}
	}

	const paste = ev.clipboardData.getData("text");

	if (paste.startsWith(`${url}/notes/`)) {
		ev.preventDefault();

		if (!props.renote && !quoteId) {
			os.confirm({
				type: "info",
				text: i18n.ts.quoteQuestion,
				showThirdButton: true,
				okText: "引用(QT)",
				thirdText: "参照",
				cancelText: "URL貼付"
			}).then((result) => {
				if (result?.canceled) {
					insertTextAtCursor(textareaEl, paste);
					return;
				}
				if (result?.result === "third") {
					referenceIds = Array.from(new Set([...referenceIds, paste.substr(url.length).match(/^\/notes\/(.+?)\/?$/)[1]]))
				} else {
					quoteId = paste.substr(url.length).match(/^\/notes\/(.+?)\/?$/)[1];
				}
			});
		} else {
			if (referencesFlg) {
				os.yesno({
					type: "info",
					text: i18n.ts.referencesQuestion,
				}).then((result) => {
					if (result?.canceled) {
						insertTextAtCursor(textareaEl, paste);
						return;
					}
					referenceIds = Array.from(new Set([...referenceIds, paste.substr(url.length).match(/^\/notes\/(.+?)\/?$/)[1]]))
				});
			} else {
				insertTextAtCursor(textareaEl, paste);
				return;
			}
		}
	}
}

function onDragover(ev) {
	if (!ev.dataTransfer.items[0]) return;
	const isFile = ev.dataTransfer.items[0].kind === "file";
	const isDriveFile = ev.dataTransfer.types[0] === _DATA_TRANSFER_DRIVE_FILE_;
	if (isFile || isDriveFile) {
		ev.preventDefault();
		draghover = true;
		switch (ev.dataTransfer.effectAllowed) {
			case "all":
			case "uninitialized":
			case "copy":
			case "copyLink":
			case "copyMove":
				ev.dataTransfer.dropEffect = "copy";
				break;
			case "linkMove":
			case "move":
				ev.dataTransfer.dropEffect = "move";
				break;
			default:
				ev.dataTransfer.dropEffect = "none";
				break;
		}
	}
}

function onDragenter(ev) {
	draghover = true;
}

function onDragleave(ev) {
	draghover = false;
}

function onDrop(ev): void {
	draghover = false;

	// ファイルだったら
	if (ev.dataTransfer.files.length > 0) {
		ev.preventDefault();
		for (const x of Array.from(ev.dataTransfer.files)) upload(x);
		return;
	}

	//#region ドライブのファイル
	const driveFile = ev.dataTransfer.getData(_DATA_TRANSFER_DRIVE_FILE_);
	if (driveFile != null && driveFile !== "") {
		const file = JSON.parse(driveFile);
		files.push(file);
		ev.preventDefault();
	}
	//#endregion
}

function saveDraft(key?, name?) {
	try {
		// NB: ロック状態は内容そのものなので、空でもロック ON の場合は下書きを残す。
		//     これにより「空のままロックを掛けた下書き」も維持できる。
		if (
			!(
				text ||
				(useCw && cw) ||
				files?.length ||
				poll ||
				(referenceIds?.length && referencesFlg) ||
				postLocked
			)
		) {
			if (!key) {
				deleteDraft(key);
			}
			return;
		}

		const draftData = getDraftsMap();

		draftData[key ? key : draftKey] = {
			updatedAt: new Date(),
			name: name ? name : undefined,
			data: {
				text: text,
				useCw: useCw,
				cw: cw,
				visibility: visibility,
				localOnly: localOnly,
				files: files,
				poll: poll,
				visibleUserIds:
					visibility === "specified" ? visibleUsers.map((u) => u.id) : [],
				replyId: reply?.id ? reply.id : null,
				quoteId: quoteId ? quoteId : props.renote ? props.renote.id : null,
				// NOTE: referenceIds はグローバルストア(postFormReferenceIds)由来で下書き固有ではないが、
				// 「この下書きが参照を伴っていたか」を後から判定できるよう件数のみ保存する
				referenceIds: referencesFlg ? referenceIds : [],
				referencesFlg: referencesFlg,
				postLocked: postLocked,
			},
		};

		setDraftsMap(draftData);

		if (key) {
			clear();
			deleteDraft();
		}
	} catch (e) {
		console.log(e)
	}
}

let backupDraftData: any;
function backupDraft(key?) {
	try {
		const draftData = getDraftsMap();

		backupDraftData = {...draftData[key ? key : draftKey]};

		return backupDraftData;
	} catch (e) {
		console.log(e)
		return undefined;
	}
}

function restoreDraft(key?) {
	try {
		const draftData = getDraftsMap();

		const data = draftData[key ? key : draftKey]
		if (data?.data) {
			if ((data.data.text || (data.data.useCw && data.data.cw) || data.data.files?.length || data.data.poll || (data.data.referenceIds?.length && data.data.referencesFlg === true))) {
				draftData[`auto:${uuid()?.slice(0, 8)}`] = backupDraftData;
				setDraftsMap(draftData);
				return;
			}
		}
		draftData[key ? key : draftKey] = backupDraftData
		setDraftsMap(draftData);
	} catch (e) {
		console.log(e)
	}
}
function deleteDraft(key?) {
	try {
		const draftData = getDraftsMap();

		delete draftData[key ? key : draftKey];

		setDraftsMap(draftData);
	} catch (e) {
		console.log(e)
	}
}

function specifiedCheck() {
	if (visibility === "specified") {
		localOnly = false;
		addMissingMention();
	}
}

/**
 * クイック投稿（複数投稿ボタンの 1st〜5th）を実行する。
 *
 * @remarks
 * NB: 投稿ロック中は何もせず早期 return する（UI/ショートカット側ガードの取りこぼし対策のフェイルセーフ）。
 */
function performQuickPost(kind: QuickVisibilityType): void {
        if (postLocked) return;
        if (kind === "first") {
                if (defaultStore.state.firstPostButtonVisibilityForce) {
                        visibility = defaultStore.state.defaultNoteVisibility as (typeof misskey.noteVisibilities)[number];
                        localOnly = defaultStore.state.defaultNoteLocalAndFollower === true;
                }
        } else {
                const target = quickVisibilitySettingMap[kind];
                if (target) {
                        localOnly = target.localOnly;
                        visibility = target.visibility;
                }
        }
        specifiedCheck();
        if (canPost && visibility !== "specified") {
                post();
        }
}

/**
 * ヘッダー右側の投稿ボタン群クリックを各投稿関数にディスパッチする。
 */
function handleQuickPost(button: QuickPostButtonConfig) {
	if (postLocked) return;
	switch (button.behavior.type) {
		case "post":
			post();
			break;
		case "quick":
			performQuickPost(button.behavior.quickType);
			break;
		case "custom":
			button.behavior.handler();
			break;
	}
}

function postSecondChannel() {
	// NB: post() 側でもロック判定するが、副作用（localOnly 上書き）を避けるため早期 return
	if (postLocked) return;
	localOnly = true;
	post();
}

/**
 * 投稿処理本体。`post()` を直接呼ぶ経路（チャネル切替や Enter ショートカット直結）も含めて
 * フェイルセーフを掛けるため、冒頭でロック判定を行う。
 *
 * @remarks
 * NB: 投稿ロック中は早期 return（UI/ショートカット側ガードの取りこぼし対策の最終防衛）。
 * NOTE: 本文に `@ピザ` / `＠ピザ` を含む場合、ここでネタ機能としてピザ関連ページを
 *       新規タブで開く。サーバー側・他ユーザーには影響しない。
 */
async function post() {
	if (postLocked) return;
	// 「@ピザ / ＠ピザ」を含む場合はランダムでピザ関連ページを新規タブで開く（ネタ機能）。
	// NB: ポップアップブロック対策のため `await` より前の同期区間で呼ぶ。
	// NB: 判定対象は生のユーザー入力本文のみ。投稿成否は待たない。
	triggerPizzaIfNeeded(text);
	const processedText = text ? preprocess(text) : "";

	if (useCw && !cw?.trim()) cw = "CW";
	if (!useCw && cw) cw = "";

	const processedCw = cw ? preprocess(cw) : "";

	({ visibility, localOnly } = normalizeVisibility({
		visibility,
		localOnly,
		canPublic,
		canHome,
		canFollower,
		canNotLocal,
		blockPostNotLocalPublic: $i.blockPostNotLocalPublic,
	}));

	if (!props.renote && !quoteId && referencesFlg && referenceIds?.length === 1) {
		try {
			const note = await os.api("notes/show", { noteId: referenceIds[0] });
			if (note.userId === $i.id) {
				const { canceled } = await os.yesno({
					type: "info",
					text: i18n.ts.changeToQuoteConfirm,
				});
				if (!canceled) {
					quoteId = referenceIds[0];
					referenceIds = [];
				}
			}
		} catch (e) {
			console.log(e);
		}
	}

	let postData = buildPostPayload({
		processedText,
		processedCw,
		useCw,
		files,
		reply,
		renote: props.renote,
		quoteId,
		channel: props.channel,
		poll,
		localOnly,
		visibility,
		visibleUsers,
		visibleUsersCc,
		inheritCc,
		referenceIds,
		referencesFlg,
		withHashtags: Boolean(withHashtags),
		hashtags: typeof hashtags === "string" ? hashtags : null,
	});

	postData = await applyPostPlugins(postData, notePostInterruptors);

	const token = await resolvePostAccountToken(postAccount);
	const postingAccountId = postAccount?.id ?? $i.id;
	const postSignature = buildPostDeduplicationSignature(postData, postingAccountId);

	if (pendingPostBySignature.has(postSignature)) {
		os.toast("同じ内容の投稿は、前回の投稿処理が完了するまで送信できません。");
		return;
	}

	if ($i.isMiniSilenced && postData.visibility === "public") {
		const { canceled } = await os.confirm({
			type: "warning",
			text: i18n.ts.miniSilenceWarn,
			okText: "公開で投稿",
			wait: 7,
		});
		if (canceled) return;
	}

	registerPendingPostSignature(postSignature, draftKey);

	const backupDraftData = persistDraftOnSuccess(postData.text);

	await submitPostRequest({
		postData,
		token,
		backupDraftData,
		postSignature,
	});
}
type NoteVisibility = (typeof misskey.noteVisibilities)[number];

type PollValue = {
        choices: string[];
        multiple: boolean;
        expiresAt: string | null;
        expiredAfter: string | null;
		hideResults: boolean;
} | null;

interface NormalizeVisibilityOptions {
        visibility: NoteVisibility;
        localOnly: boolean;
        canPublic: boolean;
        canHome: boolean;
        canFollower: boolean;
        canNotLocal: boolean;
        blockPostNotLocalPublic: boolean;
}

function normalizeVisibility(options: NormalizeVisibilityOptions): {
 visibility: NoteVisibility;
 localOnly: boolean;
} {
	let { visibility, localOnly } = options;

	if (!options.canPublic && visibility === "public") visibility = "home";
	if (!options.canHome && visibility === "home") visibility = "followers";
	if (!options.canFollower && visibility === "followers") visibility = "specified";
	if (
		!options.canNotLocal &&
		visibility !== "followers" &&
		visibility !== "specified" &&
		localOnly === false &&
		!options.blockPostNotLocalPublic
	) {
		localOnly = true;
	}

	return { visibility, localOnly };
}

interface BuildPostPayloadOptions {
        processedText: string;
        processedCw: string;
        useCw: boolean;
        files: Array<{ id: string }>;
        reply?: misskey.entities.Note | null;
        renote?: misskey.entities.Note;
        quoteId: string | null;
        channel?: { id: string } | null;
        poll: PollValue;
        localOnly: boolean;
        visibility: NoteVisibility;
        visibleUsers: Array<{ id: string }>;
        visibleUsersCc: Array<{ id: string }>;
        inheritCc: boolean;
        referenceIds?: string[] | null;
        referencesFlg: boolean;
        withHashtags: boolean;
        hashtags: string | null;
}

interface PostPayload {
        text?: string;
        fileIds?: string[];
        replyId?: string;
        renoteId?: string;
        channelId?: string;
        poll?: PollValue;
        cw?: string;
        localOnly: boolean;
        visibility: NoteVisibility;
        visibleUserIds?: string[];
        ccUserIds?: string[];
        inheritCc?: boolean;
        referenceIds?: string[];
		idempotencyKey?: string;
}

function buildPostPayload(options: BuildPostPayloadOptions): PostPayload {
 const payload: PostPayload = {
  text: options.processedText === "" ? undefined : options.processedText,
  fileIds: options.files.length > 0 ? options.files.map((f) => f.id) : undefined,
  replyId: options.reply ? options.reply.id : undefined,
  renoteId: options.renote
   ? options.renote.id
   : options.quoteId
   ? options.quoteId
   : undefined,
  channelId: options.channel ? options.channel.id : undefined,
  poll: options.poll,
  cw: options.useCw ? options.processedCw || "" : undefined,
  localOnly: options.localOnly,
  visibility: options.visibility,
  visibleUserIds:
   options.visibility === "specified"
    ? options.visibleUsers.map((u) => u.id)
    : undefined,
  ccUserIds:
   options.visibility === "specified"
    ? options.visibleUsersCc.map((u) => u.id)
    : undefined,
  inheritCc: options.inheritCc,
  referenceIds:
   options.referenceIds?.length && options.referencesFlg
    ? options.referenceIds
    : undefined,
	};

	if (options.withHashtags && options.hashtags && options.hashtags.trim() !== "") {
		const textHashtags_ = mfm
			.parse(payload.text ?? "")
			.filter((x) => x.type === "hashtag")
			.map((x) =>
				x.props.hashtag.startsWith("#")
					? x.props.hashtag
					: `#${x.props.hashtag}`
			);
		const hashtags_ = options.hashtags
			.trim()
			.split(" ")
			.map((x) => (x.startsWith("#") ? x : `#${x}`));
		const hashtags__ = hashtags_
			.filter((x) => !textHashtags_.includes(x))
			.join(" ");
		payload.text = payload.text
			? `${payload.text} ${hashtags__}`
			: hashtags__;
	}

	return payload;
}

async function applyPostPlugins(
 payload: PostPayload,
 interruptors: typeof notePostInterruptors,
): Promise<PostPayload> {
 if (interruptors.length === 0) {
  return payload;
	}

	let result = payload;
	for (const interruptor of interruptors) {
		result = await interruptor.handler(deepClone(result));
	}

	return result;
}

function persistDraftOnSuccess(postText: string | undefined): DraftEntry | undefined {
 backupData();
 const backupDraftData = backupDraft();
 clear();
 nextTick(() => {
  deleteDraft();
  emit("posted");
  if (postText && postText !== "") {
   const hashtags_ = mfm
    .parse(postText)
    .filter((x) => x.type === "hashtag")
    .map((x) => x.props.hashtag);
   const history = JSON.parse(
    localStorage.getItem("hashtags") || "[]"
   ) as string[];
   localStorage.setItem(
    "hashtags",
    JSON.stringify(unique(hashtags_.concat(history)))
   );
		}
	});
	return backupDraftData;
}

interface SubmitPostRequestOptions {
        postData: PostPayload;
        token?: string;
        backupDraftData: DraftEntry | undefined;
		postSignature: string;
}


async function submitPostRequest({
	postData,
	token,
	backupDraftData,
	postSignature,
}: SubmitPostRequestOptions): Promise<void> {
	posting = true;
	try {
		// NOTE: 投稿ボタン押下ごとに intentKey を新規発行し、その押下に紐づく再送では同じキーを使い続ける。
		const postIntentKey = uuid();
		postData = os.ensureNotesCreateIdempotencyKey(postData, postIntentKey) as PostPayload;
		await waitForFileSelectingToBeFalse(backupDraftData);
		postData.fileIds =
			((postData?.fileIds?.length ?? 0) + files.length > 0)
				? [
					...(postData.fileIds?.length ? postData.fileIds : []),
					...files.map((f) => f.id),
				]
				: undefined;
		clear();
		await os.queueApi("notes/create", postData, token, true, "投稿データをサーバに送信中…", {
			key: draftKey,
			...backupDraftData,
		});
		clearPendingPostSignature(postSignature);
		posting = false;
		postAccount = null;
	} catch (err) {
		if ((err as any)?.code === "DUPLICATE_REQUEST") {
			// NOTE: 同一投稿の再送がサーバ側で吸収されたケースは成功扱いに寄せる。
			clearPendingPostSignature(postSignature);
			posting = false;
			postAccount = null;
			os.toast("同じ投稿の再送信は自動的に抑止されました。");
			return;
		}
		clearPendingPostSignature(postSignature);
		posting = false;
		restoreData();
		restoreDraft();
		const errId = (err as any).id;
		os.toast([err.message, errId].filter(Boolean).join(" : "));
		loadDraft();
	}
}

async function resolvePostAccountToken(
	account: misskey.entities.UserDetailed | null,
): Promise<string | undefined> {
	if (!account) return undefined;

	const storedAccounts = await getAccounts();
	return storedAccounts.find((x) => x.id === account.id)?.token;
}

async function waitForFileSelectingToBeFalse(backupDraftData) {
	if (filePromises.length === 0) return;

	const staleUploadWaitMs = 1000;
	const overallTimeoutMs = 60 * 1000;
	const startedAt = Date.now();
	let noActiveUploadsSince: number | null = null;

	const addData = os.addQueue({
		endpoint: "notes/create",
		data: {},
		comment: "ファイルのアップロードを待機中…",
		draftData: { key: draftKey, ...backupDraftData },
	});

	try {
		while (filePromises.length > 0) {
			// NOTE: filePromises にぶら下がっている全てのアップロード処理が settle するまで待機する。
			// どれか 1 つでも resolve/reject されない場合は、ここでブロックされ続けるため、
			// 呼び出し元での overallTimeoutMs によるガードと組み合わせてハングを防ぐ。
			await Promise.allSettled([...filePromises]);

			if (Date.now() - startedAt >= overallTimeoutMs) {
				// NOTE: アップロード待機が一定時間を超えた場合は「安全側」に倒して投稿自体を中止する。
				// ここで明示的にエラーを投げることで、添付が完了していない状態で投稿されてしまうことを防ぐ。
				throw new Error("ファイルのアップロード待機がタイムアウトしました。");
			}

			const waitState = evaluateUploadWaitState({
				pendingPromiseCount: filePromises.length,
				activeUploadCount: uploads.value.length,
				now: Date.now(),
				noActiveUploadsSince,
				staleUploadWaitMs,
			});

			noActiveUploadsSince = waitState.nextNoActiveUploadsSince;

			if (waitState.shouldForceResetPromises) {
				// uploads には進行中タスクが存在しないのに filePromises が残り続けるケースを
				// 異常状態とみなし、「安全側」に倒して投稿を中止する。
				console.debug(
					"[MkPostForm] Detected stale upload wait promises; aborting post to avoid inconsistent attachment state",
					{
						pendingPromiseCount: filePromises.length,
						activeUploadCount: uploads.value.length,
						staleUploadWaitMs,
					},
				);
				filePromises = [];
				throw new Error("ファイルのアップロード状態が不明なため、投稿を中止しました。");
			}

			if (waitState.shouldWaitBeforeRetry) {
				await sleepMs(FILE_SELECT_IDLE_WAIT_MS);
			}
		}
	} catch (err) {
		throw new Error("アップロードに失敗しました。");
	} finally {
		if (addData) {
			os.removeQueue(addData.id);
		}
	}

	if (fileError) {
		throw new Error("アップロードに失敗しました。");
	}
}


const showSwarmButton = $computed((): boolean => {
	const integrations = ($i as any)?.integrations;
	return Boolean(integrations?.swarm?.accessToken && integrations?.swarm?.showPostFormButton);
});
const headerButtonsTabindex = $computed(() =>
	defaultStore.state.postFormHeaderButtonsTabindexMinusOne ? -1 : null,
);
const footerButtonsTabindex = $computed(() =>
	defaultStore.state.postFormFooterButtonsTabindexMinusOne ? -1 : null,
);

function buildSwarmText(checkin: {
	comment: string;
	venueName: string;
	location: string;
	url: string;
}): string {
	const place = [checkin.venueName, checkin.location].filter(Boolean).join(" in ");
	const integrations = ($i as any)?.integrations;
	const insertShareUrl = integrations?.swarm?.insertShareUrl ?? true;
	const urlText = insertShareUrl && checkin.url ? `\n\n${checkin.url}` : "";
	if (checkin.comment) {
		return `${checkin.comment}（@ ${place}）${urlText}`;
	}
	return `I'm at ${place}${urlText}`;
}


/**
 * Swarm チェックインに紐づく写真を URL からドライブにアップロードする。
 * デフォルトのアップロード先（設定の「アップロード先」）に保存する。
 *
 * @param photoUrl - アップロードする画像の URL。無い場合は何も添付しない
 * @internal
 */
async function uploadSwarmPhoto(photoUrl: string | null): Promise<void> {
	try {
		await enqueueUpload(() => {
			if (!photoUrl) {
				// NOTE: Swarm 側に写真が存在しないチェックインの場合は、そのまま何も添付せず完了とみなす。
				return Promise.resolve([]);
			}

			const marker = Math.random().toString();
			const connection = stream.useChannel("main");

			const uploadPromise = new Promise<misskey.entities.DriveFile>((resolve, reject) => {
				let settled = false;
				const timeoutId = setTimeout(() => {
					if (settled) return;
					settled = true;
					connection.dispose();
					reject(new Error("Swarmの写真アップロードがタイムアウトしました。"));
				}, 30_000);

				connection.on("urlUploadFinished", (urlResponse) => {
					if (urlResponse.marker !== marker || settled) return;

					clearTimeout(timeoutId);
					settled = true;

					if (!urlResponse.file) {
						connection.dispose();
						reject(new Error("アップロード結果が不正です。"));
						return;
					}

					connection.dispose();
					resolve(urlResponse.file);
				});

				// デフォルトのアップロード先フォルダを指定（未設定の場合はルート）
				os.api("drive/files/upload-from-url", {
					url: photoUrl,
					folderId: defaultStore.state.uploadFolder ?? undefined,
					marker,
				}).catch((err) => {
					if (settled) return;
					settled = true;
					clearTimeout(timeoutId);
					connection.dispose();
					reject(err);
				});
			});

			return uploadPromise;
		});
	} catch {
		// NOTE: Swarm 写真アップロードに失敗した場合は投稿フォーム自体は継続しつつ、ユーザにはトーストで通知する。
		os.toast(i18n.ts.somethingHappened);
	}
}

async function openSwarmCheckins(offset = 0): Promise<void> {
	const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
	let result: {
		items: Array<{
			id: string;
			comment: string;
			venueName: string;
			location: string;
			url: string;
			photoUrl: string | null;
		}>;
		hasMore: boolean;
	};

	try {
		result = (await os.api("i/swarm/recent-checkins", {
			limit: 10,
			offset: safeOffset,
		})) as {
			items: Array<{
				id: string;
				comment: string;
				venueName: string;
				location: string;
				url: string;
				photoUrl: string | null;
			}>;
			hasMore: boolean;
		};
	} catch {
		os.toast(i18n.ts.somethingHappened);
		return;
	}

	if (!Array.isArray(result.items)) {
		os.toast(i18n.ts.somethingHappened);
		return;
	}

	const menuItems = result.items.map((item) => ({
		text: item.venueName,
		action: async () => {
			const insertText = buildSwarmText(item);
			text = text.trim().length === 0 ? insertText : `${text}\n\n${insertText}`;
			await uploadSwarmPhoto(item.photoUrl);
		},
	}));

	if (result.hasMore) {
		menuItems.push({
			text: i18n.ts.loadMore,
			action: () => {
				void openSwarmCheckins(safeOffset + 10);
			},
		});
	}

	if (menuItems.length === 0) {
		os.alert({ type: "info", text: i18n.ts.nothing });
		return;
	}

	os.popupMenu(menuItems, (textareaEl ?? document.body) as HTMLElement);
}

function cancel() {
	if (!defaultStore.state.CloseAllClearButton) {
		emit("cancel");
	} else {
		let _cw = cw;
		let _text = text;
		let _quoteId = quoteId;
		let _files = files;
		let _poll = poll;
		if (
			!cw?.trim() &&
			!text?.trim() &&
			!files?.length &&
			!quoteId?.trim() &&
			!poll
		) {
			cw = backupCw;
			text = backupText;
			files = backupFiles;
			quoteId = backupQuoteId;
			poll = backupPoll;
		} else {
			cw = "";
			if (useCw && reply) {
				cw = `@${reply.user.username}${
					reply.user.host ? `@${reply.user.host}` : ""
				} `;
			}

			if (!useCw && reply) {
				text = `@${reply.user.username}${
					reply.user.host ? `@${reply.user.host}` : ""
				} `;
			} else {
				text = "";
			}

			files = [];
			quoteId = null;
			poll = null;

			if (
				(backupCw ||
					backupText ||
					backupFiles?.length ||
					backupQuoteId ||
					backupPoll) &&
				_cw === cw &&
				_text === text &&
				quoteId === _quoteId &&
				JSON.stringify(files) === JSON.stringify(_files) &&
				JSON.stringify(poll) === JSON.stringify(_poll)
			) {
				cw = backupCw;
				text = backupText;
				files = backupFiles;
				quoteId = backupQuoteId;
				poll = backupPoll;
			} else {
				backupCw = _cw;
				backupText = _text;
				backupFiles = _files;
				backupPoll = _poll;
				backupQuoteId = _quoteId;
			}
		}
	}
}

function insertMention() {
	if (defaultStore.state.openMentionWindow) {
		os.selectUser().then((user) => {
			insertTextAtCursor(textareaEl, `@${Acct.toString(user)} `);
		});
	} else {
		insertTextAtCursor(textareaEl, "@");
	}
}

async function insertEmoji(ev: MouseEvent) {
	if (defaultStore.state.openEmojiPicker) {
		os.openEmojiPicker(ev.currentTarget ?? ev.target, {}, textareaEl);
	} else {
		insertTextAtCursor(textareaEl, ":");
	}
}

function insertMfm() {
	if (defaultStore.state.quickToggleSmartMFMInputer) {
		smartMFMInputer = !smartMFMInputer;
	} else {
		insertTextAtCursor(textareaEl, "$");
	}
}

function insertNowPlayingInfo() {
	if (!isNowPlayingSupported) return;
	const mediaInfo = nowPlayingMediaInfo;
	if (!mediaInfo) {
		os.toast(i18n.ts.noNowPlayingMediaInfo);
		return;
	}

	insertTextAtCursor(textareaEl, `🎵 ${mediaInfo} #NowPlaying`);
}

async function openCheatSheet(ev: MouseEvent) {
	os.popup(XCheatSheet, {}, {}, "closed");
}

async function openDraft(ev: MouseEvent) {
	os.popup(
		XDraft,
		{},
		{
			done: (result) => {
				if (!result || result.canceled) return;
			},
			load: (result) => {
				if (!result || result.canceled) return;
				if (result.key === draftKey) return;
				saveDraft(`auto:${uuid()?.slice(0, 8)}`, result.name);
				loadDraft(result.key);
				deleteDraft(result.key);
			},
			save: (result) => {
				if (!result || result.canceled) return;
				saveDraft(result.key, result.name);
			},
			delete: (result) => {
				if (!result || result.canceled) return;
				deleteDraft(result.key);
			},
			closeAll: () => {
				emit("cancel");
			},
		},
		"closed"
	);
}

function loadDraft(key?) {
	const draft = getDraftsMap()[key ? key : draftKey];
	if (draft) {
		// NB: 内容が空でも `postLocked` が true なら復元対象とする
		//     （空のままロック ON で保存したケース）
		if (
			draft.data.text ||
			(draft.data.useCw && draft.data.cw) ||
			draft.data.files?.length ||
			draft.data.poll ||
			(draft.data.referenceIds?.length && draft.data.referencesFlg === true) ||
			draft.data.postLocked
		) {
			text = draft.data.text;
			useCw = draft.data.useCw;
			if (useCw) cw = draft.data.cw;
			visibility = draft.data.visibility;
			localOnly = draft.data.localOnly;
			files = (draft.data.files || []).filter((draftFile) => draftFile);
			draft.data.visibleUserIds?.forEach((x) =>
				os.api("users/show", { userId: x }).then((user) => {
					pushVisibleUser(user);
				})
			);
			if (draft.data.poll) {
				poll = {
					...draft.data.poll,
					hideResults: draft.data.poll.hideResults ?? false,
				};
			}
			if (
				draft.data.quoteId &&
				(!props.reply || props.reply.id !== draft.data.quoteId) &&
				(!props.renote || props.renote.id !== draft.data.quoteId)
			) {
				quoteId = draft.data.quoteId;
			}
			referencesFlg = draft.data.referencesFlg ?? true
			postLocked = defaultStore.state.hiddenPostLockButton
				? false
				: !!draft.data.postLocked;
			if (
				!key &&
				draftKey === "note" &&
				Date.now() > Date.parse(draft.updatedAt) + 300 * 1000 &&
				!postLocked
			) {
				saveDraft(`note:${uuid()?.slice(0, 8)}`);
				return;
			}
		} else {
			deleteDraft(key);
		}
	}
}

function showActions(ev) {
	os.popupMenu(
		postFormActions.map((action) => ({
			text: action.title,
			action: () => {
				action.handler(
					{
						text: text,
					},
					(key, value) => {
						if (key === "text") {
							text = value;
						}
					}
				);
			},
		})),
		ev.currentTarget ?? ev.target
	);
}

let postAccount = $ref<misskey.entities.UserDetailed | null>(null);

function openAccountMenu(ev: MouseEvent) {
	openAccountMenu_(
		{
			withExtraOperation: false,
			includeCurrentAccount: true,
			active: postAccount != null ? postAccount.id : $i.id,
			onChoose: (account) => {
				if (account.id === $i.id) {
					postAccount = null;
				} else {
					postAccount = account;
				}
			},
		},
		ev
	);
}

const autocompleteInstances: Autocomplete[] = [];

onMounted(() => {
	mainStreamConnection = stream.useChannel("main");
	mainStreamConnection.on("note", syncPendingPostByStream);

	if (props.initialRawFiles) {
		// 共有ターゲット等から渡された未アップロードのファイルをキューに載せる。
		// filePromises で追跡されるため、本文入力を妨げずに投稿時は完了を待てる。
		for (const rawFile of props.initialRawFiles) {
			upload(rawFile, rawFile.name, { force: true });
		}
	}

        if (props.autofocus) {
                focus();

                nextTick(() => {
                        focus();
                });
        }

        if (textareaEl) {
                autocompleteInstances.push(new Autocomplete(textareaEl, $$(text)));
        }

        if (cwInputEl) {
                autocompleteInstances.push(new Autocomplete(cwInputEl, $$(cw)));
        }

        if (hashtagsInputEl) {
                autocompleteInstances.push(new Autocomplete(hashtagsInputEl, $$(hashtags)));
        }

	nextTick(async () => {
		// IndexedDB からの下書き読み込み完了を待ってから復元・保存を行う
		await draftsReady();

		// 書きかけの投稿を復元
		if (!props.instant && !props.mention && !props.specified) {
			loadDraft();
		}

		// 削除して編集
		if (props.initialNote) {
			const init = props.initialNote;
			text = init.text ? init.text : "";
			files = init.files;
			cw = init.cw;
			useCw = init.cw != null;
			if (init.poll) {
				poll = {
					choices: init.poll.choices.map((x) => x.text),
					multiple: init.poll.multiple,
					expiresAt: init.poll.expiresAt,
					expiredAfter: init.poll.expiredAfter,
					hideResults: init.poll.hideResults ?? false,
				};
			}
			visibility = init.visibility;
			init.visibleUserIds?.forEach((x) =>
				os.api("users/show", { userId: x }).then((user) => {
					pushVisibleUser(user);
				})
			);
			localOnly = init.localOnly;
			quoteId = init.renote ? init.renote.id : null;
			saveDraft();
		}

		nextTick(() => watchForDraft());
	});
});

onBeforeUnmount(() => {
	// NOTE: デバウンス待ちの保存を即時実行し、IndexedDB への書き戻し完了を待つ
	debouncedSaveDraft.flush();
	void flushDrafts();
});

onUnmounted(() => {
	if (mainStreamConnection) {
		mainStreamConnection.dispose();
		mainStreamConnection = null;
	}

        for (const instance of autocompleteInstances) {
                instance.detach();
        }
});
</script>

<style lang="scss" scoped>
.right {
	float: right;
	margin-left: auto !important;
}
.gafaadew {
	position: relative;

	&.modal {
		width: 100%;
		max-width: 32.5rem;
	}

	> header {
		z-index: 1000;
		height: 4.125rem;

		> .cancel {
			padding: 0;
			font-size: 1.25rem;
			width: 4rem;
			line-height: 4.125rem;
		}

		> .account {
			height: 100%;
			aspect-ratio: 1/1;
			display: inline-flex;
			vertical-align: bottom;

			> .avatar {
				width: 1.75rem;
				height: 1.75rem;
				margin: auto;
			}
		}

		> .right {
			position: absolute;
			top: 0;
			right: 0;
			display: flex;
			align-items: center;
			justify-content: flex-end;
			max-width: 100%;

			> .text-count {
				opacity: 0.7;
				line-height: 4.125rem;
				margin: 0 0.5rem 0 0;
			}

			> .visibility {
				height: 2.125rem;
				width: 2.125rem;
				margin: 0 0 0 0;

				& + .localOnly {
					margin-left: 0 !important;
				}
			}

			> .local-only {
				margin: 0 0.5rem 0 0.25rem;
				opacity: 0.7;
			}

			> .preview {
				display: inline-block;
				padding: 0;
				margin: 0 0.5rem 0 0;
				line-height: 1.4;
				font-size: var(--fontSize);
				width: 2.125rem;
				height: 2.125rem;
				border-radius: 0.375rem;

				&:hover {
					background: var(--X5);
				}

				&.active {
					color: var(--accent);
				}
			}

			> .addblank {
				margin: 0 0.5rem 0 0 !important;
			}

			> .submit {
				display: inline-flex;
				align-items: center;
				margin: 1rem 1rem 1rem 0;
				padding: 0 0.75rem;
				line-height: 2.125rem;
				font-weight: bold;
				vertical-align: bottom;
				border-radius: 0.25rem;
				font-size: 0.9em;

				&:disabled {
					opacity: 0.7;
				}

				> i {
					margin-left: 0.375rem;
				}
			}

			> .submit_h {
				display: inline-flex;
				align-items: center;
				margin: 1rem 1rem 1rem 0;
				padding: 0 0.75rem;
				line-height: 2.125rem;
				font-weight: bold;
				vertical-align: bottom;
				border-radius: 0.25rem;
				font-size: 0.9em;

				&:disabled {
					opacity: 0.7;
				}

				> .subPostIcon {
					margin-left: 0.375rem;
				}

				> .widePostButton {
					margin-left: 0.75rem;
					margin-right: 0.75rem;
				}

				> .widePostButton_left {
					margin-left: calc(0.5625rem - 0.45em);
				}

				> .widePostButton_right {
					margin-right: calc(0.5625rem - 0.45em);
				}
			}

			> .shortcutTarget::before {
				content: "⏎";
			}

			> .notShortcutTarget {
				opacity: 0.7;
			}
		}
	}

	> .form {
		> .preview {
			padding: 1rem;
		}

		> .with-quote {
			display: flex;
			align-items: center;
			gap: 0.4em;
			margin-inline: 1.5rem;
			margin-bottom: 0.75rem;
			color: var(--renote);

			> button {
				display: flex;
				padding: 0;
				color: var(--accentAlpha04);

				&:hover {
					color: var(--accentAlpha06);
				}

				&:active {
					color: var(--accentDarken30);
				}
			}
		}

		> .with-references {
			display: flex;
			align-items: center;
			gap: 0.4em;
			margin-inline: 1.5rem;
			margin-bottom: 0.75rem;

			&.refOn{
				color: var(--accent);
			}

			> button {
				display: flex;
				padding: 0;
				color: var(--accentAlpha04);

				&:hover {
					color: var(--accentAlpha06);
				}

				&:active {
					color: var(--accentDarken30);
				}
			}
		}

		> .nomargin {
			margin-bottom: 0 !important;
		}

		> .to-specified {
			padding: 0.375rem 1.5rem;
			margin-bottom: 0.5rem;
			overflow: auto;
			line-height: 2rem;

			> .visibleUsers {
				display: inline;
				top: -0.0625rem;
				font-size: 0.875rem;

				> button {
					padding: 0.125rem;
					border-radius: 0.5rem;

					> i {
						transform: translateX(0.125rem);
					}

					&.active {
						color: var(--accent);
					}
				}

				> span {
					margin: 0.3rem;
					padding: 0.25rem 0 0.25rem 0.25rem;
					border-radius: 999px;
					background: var(--X3);

					> button {
						padding: 0.25rem 0.5rem;
					}
				}
			}
		}

		> .hasNotSpecifiedMentions {
			margin: 0 1.25rem 1rem 1.25rem;
		}

		> .cw,
		> .hashtags,
		> .text {
			display: block;
			box-sizing: border-box;
			padding: 0 1.5rem;
			margin: 0;
			width: 100%;
			font-size: var(--fontSize);
			border: none;
			border-radius: 0;
			background: transparent;
			color: var(--fg);
			font-family: inherit;

			&:focus {
				outline: none;
			}

			&:disabled {
				opacity: 0.5;
			}
		}

		> .cw {
			z-index: 1;
			padding-bottom: 0.5rem;
			border-bottom: solid 0.03125rem var(--divider);
		}

		> .hashtags {
			z-index: 1;
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
			border-top: solid 0.03125rem var(--divider);
		}

		> .text {
			max-width: 100%;
			min-width: 100%;
			min-height: 5.625rem;

			&.withCw {
				padding-top: 0.5rem;
			}
		}

		> footer {
			display: flex;
			flex-wrap: nowrap;
			padding: 0 1rem 0 1rem;

			> button {
				display: inline-block;
				padding: 0;
				margin: 0;
				font-size: 1rem;
				width: 3rem;
				height: 3rem;
				border-radius: 0.375rem;

				&:hover {
					background: var(--X5);
				}

				&.active {
					color: var(--accent);
				}
			}
		}
	}

	&.max-width_500px {
		> header {
			height: 3.125rem;

			> .cancel {
				width: 3.125rem;
				line-height: 3.125rem;
			}

			> .right {
				> .text-count {
					line-height: 3.125rem;
				}

				> .submit {
					margin: 0.5rem 0.5rem 0.5rem 0;
				}

				> .submit_h {
					margin: 0.5rem 0.5rem 0.5rem 0;
				}
			}
		}

		> .form {
			> .to-specified {
				padding: 0.375rem 1rem;
			}

			> .cw,
			> .hashtags,
			> .text {
				padding: 0 1rem;
			}

			> .text {
				min-height: 5rem;
			}

			> footer {
				padding: 0 0.5rem 0.5rem 0.5rem;
			}
		}
	}

	&.max-width_310px {
		> .form {
			> footer {
				> button {
					font-size: 0.875rem;
					width: 2.75rem;
					height: 2.75rem;
				}
			}
		}
	}
}
</style>
