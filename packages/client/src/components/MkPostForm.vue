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
			<button v-if="(!fixed || $store.state.CloseAllClearButton) && !$store.state.hiddenCloseButton" class="cancel _button" @click="cancel">
				<i class="ph-x ph-bold ph-lg"></i>
			</button>
			<button
				v-if="!$store.state.hiddenAccountButton"
				v-click-anime
				v-tooltip="i18n.ts.switchAccount"
				class="account _button"
				@click="openAccountMenu"
			>
				<MkAvatar :user="postAccount ?? $i" class="avatar" />
			</button>
			<div class="right">
				<span
					class="text-count"
					:class="{ over: textLength > maxTextLength }"
					>{{ (maxTextLength - textLength) > 999 ? textLength : i18n.t('remainingLength', { n: maxTextLength - textLength }) }}</span
				>
				<span v-if="localOnly && isChannel" class="local-only"
					><i class="ph-hand-fist ph-bold ph-lg"></i
				></span>
				<span v-if="localOnly && !isChannel && (($store.state.rememberNoteVisibility || !$store.state.firstPostButtonVisibilityForce) || visibility === 'specified')" class="local-only"
					><i class="ph-hand-heart ph-bold ph-lg"></i
				></span>
				<button
					v-if="($store.state.rememberNoteVisibility || !$store.state.firstPostButtonVisibilityForce) || isChannel || visibility === 'specified'"
					ref="visibilityButton"
					v-tooltip="i18n.ts.visibility"
					class="_button visibility"
					:class="{ addblank: $store.state.hiddenMFMHelp }"
					:disabled="!canFollower"
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
					v-if="!$store.state.hiddenMFMHelp"
					v-tooltip="i18n.ts._mfm.cheatSheet"
					class="_button preview"
					@click="openCheatSheet"
				>
					<i class="ph-question ph-bold ph-lg"></i>
				</button>
				<button
					v-if="(($store.state.rememberNoteVisibility || !$store.state.firstPostButtonVisibilityForce) && !$store.state.secondPostButton) || (!$store.state.channelSecondPostButton && isChannel) || visibility === 'specified'"
					class="submit _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 1 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 1 }"
					:disabled="!canPost"
					data-cy-open-post-form-submit
					@click="post"
				>
					{{ submitText
					}}<i
						:class="
							reply
								? 'ph-arrow-u-up-left ph-bold ph-lg'
								: renote
									? 'ph-quotes ph-bold ph-lg'
									: 'ph-paper-plane-tilt ph-bold ph-lg'
						"
					></i>
				</button>
				<button
					v-if="(!$store.state.rememberNoteVisibility && $store.state.firstPostButtonVisibilityForce) && !$store.state.secondPostButton && !isChannel && visibility !== 'specified'"
					class="submit _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 1 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 1 }"
					:disabled="!canPost"
					data-cy-open-post-form-submit
					@click="postFirst"
				>
					{{ submitText
					}}<i
						:class="
							$store.state.defaultNoteVisibility === 'public'
								? publicIcon
								: $store.state.defaultNoteLocalAndFollower === true && $store.state.defaultNoteVisibility === 'public'
									? localIcon
									: $store.state.defaultNoteVisibility === 'home'
										? homeIcon
										: $store.state.defaultNoteLocalAndFollower === true && $store.state.defaultNoteVisibility === 'home'
											? localHomeIcon
											: $store.state.defaultNoteVisibility === 'followers'
												? followerIcon
												: 'ph-envelope-simple-open ph-bold ph-lg'
						"
					></i>
					<i
						v-if="reply || renote"
						:class="
							reply
								? 'ph-arrow-u-up-left ph-bold ph-lg'
								: renote
									? 'ph-quotes ph-bold ph-lg'
									: ''
						"
					></i>
				</button>
				<button
					v-if="$store.state.secondPostButton && $store.state.thirdPostButton && $store.state.fourthPostButton && $store.state.fifthPostButton && !isChannel && visibility !== 'specified'"
					class="submit_h _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 5 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 5 }"
					:disabled="!canPost && $store.state.fifthPostVisibility !== 'specified'"
					data-cy-open-post-form-submit
					@click="postFifth"
				>
					&ZeroWidthSpace;
					<i
						:class="[
							$store.state.fifthPostVisibility === 'public'
								? publicIcon
								: $store.state.fifthPostVisibility === 'l-public'
									? localIcon
									: $store.state.fifthPostVisibility === 'home'
										? homeIcon
										: $store.state.fifthPostVisibility === 'l-home'
											? localHomeIcon
											: $store.state.fifthPostVisibility === 'followers'
												? followerIcon
												: 'ph-envelope-simple-open ph-bold ph-lg'
						, $store.state.fifthPostWideButton ? 'widePostButton' : '']"
					></i>
				</button>
				<button
					v-if="$store.state.secondPostButton && $store.state.thirdPostButton && $store.state.fourthPostButton && !isChannel && visibility !== 'specified'"
					class="submit_h _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 4 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 4 }"
					:disabled="!canPost && $store.state.fourthPostVisibility !== 'specified'"
					data-cy-open-post-form-submit
					@click="postFourth"
				>
					&ZeroWidthSpace;
					<i
						:class="[
							$store.state.fourthPostVisibility === 'public'
								? publicIcon
								: $store.state.fourthPostVisibility === 'l-public'
									? localIcon
									: $store.state.fourthPostVisibility === 'home'
										? homeIcon
										: $store.state.fourthPostVisibility === 'l-home'
											? localHomeIcon
											: $store.state.fourthPostVisibility === 'followers'
												? followerIcon
												: 'ph-envelope-simple-open ph-bold ph-lg'
						, $store.state.fourthhPostWideButton ? 'widePostButton' : '']"
					></i>
				</button>
				<button
					v-if="$store.state.secondPostButton && $store.state.thirdPostButton && !isChannel && visibility !== 'specified'"
					class="submit_h _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 3 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 3 }"
					:disabled="!canPost && $store.state.thirdPostVisibility !== 'specified'"
					data-cy-open-post-form-submit
					@click="postThird"
				>
					&ZeroWidthSpace;
					<i
						:class="[
							$store.state.thirdPostVisibility === 'public'
								? publicIcon
								: $store.state.thirdPostVisibility === 'l-public'
									? localIcon
									: $store.state.thirdPostVisibility === 'home'
										? homeIcon
										: $store.state.thirdPostVisibility === 'l-home'
											? localHomeIcon
											: $store.state.thirdPostVisibility === 'followers'
												? followerIcon
												: 'ph-envelope-simple-open ph-bold ph-lg'
						, $store.state.thirdPostWideButton ? 'widePostButton' : '']"
					></i>
				</button>
				<button
					v-if="$store.state.secondPostButton && !isChannel && visibility !== 'specified'"
					class="submit_h _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 2 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 2 }"
					:disabled="!canPost && $store.state.secondPostVisibility !== 'specified'"
					data-cy-open-post-form-submit
					@click="postSecond"
				>
					&ZeroWidthSpace;
					<i
						:class="[
							$store.state.secondPostVisibility === 'public'
								? publicIcon
								: $store.state.secondPostVisibility === 'l-public'
									? localIcon
									: $store.state.secondPostVisibility === 'home'
										? homeIcon
										: $store.state.secondPostVisibility === 'l-home'
											? localHomeIcon
											: $store.state.secondPostVisibility === 'followers'
												? followerIcon
												: 'ph-envelope-simple-open ph-bold ph-lg'
						, $store.state.secondPostWideButton ? 'widePostButton' : '']"
					></i>
				</button>
				<button
					v-if="($store.state.rememberNoteVisibility || !$store.state.firstPostButtonVisibilityForce) && $store.state.secondPostButton && !isChannel && visibility !== 'specified'"
					class="submit_h _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 1 , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 1  }"
					:disabled="!canPost"
					data-cy-open-post-form-submit
					@click="post"
				>
					&ZeroWidthSpace;
					<i
						:class="[
							reply
								? 'ph-arrow-u-up-left ph-bold ph-lg'
								: renote
								? 'ph-quotes ph-bold ph-lg'
								: 'ph-paper-plane-tilt ph-bold ph-lg'
						, $store.state.firstPostWideButton ? 'widePostButton' : '']"
					></i>
				</button>
				<button
					v-if="(!$store.state.rememberNoteVisibility && $store.state.firstPostButtonVisibilityForce) && $store.state.secondPostButton && !isChannel && visibility !== 'specified'"
					class="submit_h _buttonGradate"
					:class="{ shortcutTarget: shortcutKeyValue === 1  , notShortcutTarget: shortcutKeyValue !== 0 && shortcutKeyValue !== 1 }"
					:disabled="!canPost && $store.state.defaultNoteVisibility !== 'specified'"
					data-cy-open-post-form-submit
					@click="postFirst"
				>
					&ZeroWidthSpace;
					<i
						:class="[
							$store.state.defaultNoteVisibility === 'public'
								? publicIcon
								: $store.state.defaultNoteLocalAndFollower === true && $store.state.defaultNoteVisibility === 'public'
									? localIcon
									: $store.state.defaultNoteVisibility === 'home'
										? homeIcon
										: $store.state.defaultNoteLocalAndFollower === true && $store.state.defaultNoteVisibility === 'home'
											? localHomeIcon
											: $store.state.defaultNoteVisibility === 'followers'
												? followerIcon
												: 'ph-envelope-simple-open ph-bold ph-lg'
						, $store.state.firstPostWideButton ? !(reply || renote) ? 'widePostButton' : 'widePostButton_left' : '']"
					></i>
					<i
						v-if="reply || renote"
						class="subPostIcon"
						:class="[
							reply
								? 'ph-arrow-u-up-left ph-bold ph-lg'
								: renote
									? 'ph-quotes ph-bold ph-lg'
									: ''
						, $store.state.firstPostWideButton ? 'widePostButton_right' : '']"
					></i>
				</button>
				<button
					v-if="$store.state.channelSecondPostButton && isChannel"
					class="submit_h _buttonGradate"
					:disabled="!canPost"
					data-cy-open-post-form-submit
					@click="postSecondChannel"
				>
					&ZeroWidthSpace;
					<i
						class="ph-hand-fist ph-bold ph-lg widePostButton"
					></i>
				</button>
				<button
					v-if="$store.state.channelSecondPostButton && isChannel && canNotLocal"
					class="submit_h _buttonGradate"
					:disabled="!canPost"
					data-cy-open-post-form-submit
					@click="post"
				>
					&ZeroWidthSpace;
					<i
						:class="
							reply
								? 'ph-arrow-u-up-left ph-bold ph-lg widePostButton'
								: renote
								? 'ph-quotes ph-bold ph-lg widePostButton'
								: 'ph-paper-plane-tilt ph-bold ph-lg widePostButton'
						"
					></i>
				</button>
			</div>
		</header>
		<div class="form" :class="{ fixed }">
			<XNoteSimple v-if="reply" class="preview" :note="reply" />
			<XNoteSimple v-if="renote" class="preview" :note="renote" />
			<div v-if="quoteId" class="with-quote">
				<i class="ph-quotes ph-bold ph-lg"></i>
				{{ i18n.ts.quoteAttached
				}}<button class="_button" @click="quoteId = null">
					<i class="ph-x ph-bold ph-lg"></i>
				</button>
			</div>
			<div v-if="visibility === 'specified'" class="to-specified">
				<span style="margin-right: 8px">{{ i18n.ts.recipient }}</span>
				<div class="visibleUsers">
					<span v-for="u in visibleUsers" :key="u.id">
						<MkAcct :user="u" />
						<button class="_button" @click="removeVisibleUser(u)">
							<i class="ph-x ph-bold ph-lg"></i>
						</button>
					</span>
					<button class="_button" @click="addVisibleUser">
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
				v-if="includesOtherServerEmoji"
				warn
				class="hasNotSpecifiedMentions"
				>{{ i18n.ts.includesOtherServerEmojiWarning }}</MkInfo
			>
			<input
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
				@changeSensitive="updateFileSensitive"
				@changeName="updateFileName"
			/>
			<XPollEditor v-if="poll" v-model="poll" @destroyed="poll = null" />
			<footer>
				<button
					v-tooltip="i18n.ts.attachFile"
					class="_button"
					@click="chooseFileFrom"
				>
					<i class="ph-upload ph-bold ph-lg"></i>
				</button>
				<button
					v-tooltip="i18n.ts.poll"
					class="_button"
					:class="{ active: poll }"
					@click="togglePoll"
				>
					<i class="ph-microphone-stage ph-bold ph-lg"></i>
				</button>
				<button
					v-tooltip="i18n.ts.useCw"
					class="_button"
					:class="{ active: useCw }"
					@click="toggleUseCw"
				>
					<i class="ph-eye-slash ph-bold ph-lg"></i>
				</button>
				<button
					v-if="!$store.state.hiddenMentionButton"
					v-tooltip="i18n.ts.mention"
					class="_button"
					@click="insertMention"
				>
					<i class="ph-at ph-bold ph-lg"></i>
				</button>
				<button
					v-tooltip="i18n.ts.hashtags"
					class="_button"
					:class="{ active: withHashtags }"
					@click="withHashtags = !withHashtags"
				>
					<i class="ph-hash ph-bold ph-lg"></i>
				</button>
				<button
					v-tooltip="i18n.ts.emoji"
					class="_button"
					@click="insertEmoji"
				>
				    <i class="ph-smiley ph-bold ph-lg"></i>
				</button>
				<button
					v-tooltip="i18n.ts.mfm"
					class="_button"
					:class="{ active: defaultStore.state.quickToggleSmartMFMInputer && smartMFMInputer }"
					@click="insertMfm"
				>
					<i class="ph-magic-wand ph-bold ph-lg"></i>
				</button>
				<button
					v-if="postFormActions.length > 0"
					v-tooltip="i18n.ts.plugin"
					class="_button"
					@click="showActions"
				>
					<i class="ph-plug ph-bold ph-lg"></i>
				</button>
				<button
					v-tooltip="i18n.ts.previewNoteText"
					class="_button right"
					:class="{ active: showPreview }"
					@click="showPreview = !showPreview"
				>
					<i class="ph-binoculars ph-bold ph-lg"></i>
				</button>
			</footer>
			<XNotePreview v-if="showPreview" class="preview" :text="text + (withHashtags ? ' ' + hashtagsPreview : '')" :cw="useCw ? (cw ?? '') : null" />
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
import { unref, inject, watch, nextTick, onMounted, onUnmounted, defineAsyncComponent } from "vue";
import * as mfm from "mfm-js";
import * as misskey from "calckey-js";
import insertTextAtCursor from "insert-text-at-cursor";
import { length } from "stringz";
import { toASCII } from "punycode/";
import * as Acct from "calckey-js/built/acct";
import { throttle } from "throttle-debounce";
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
import {
	$i,
	getAccounts,
	openAccountMenu as openAccountMenu_,
} from "@/account";
import { uploadFile } from "@/scripts/upload";
import { deepClone } from "@/scripts/clone";
import XCheatSheet from "@/components/MkCheatSheetDialog.vue";
import { preprocess } from "@/scripts/preprocess";

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
		initialLocalOnly?: boolean;
		initialVisibleUsers?: misskey.entities.User[];
		initialNote?: misskey.entities.Note;
		instant?: boolean;
		fixed?: boolean;
		autofocus?: boolean;
		key?: string;
		airReply?: misskey.entities.Note;
	}>(),
	{
		initialVisibleUsers: () => [],
		autofocus: true,
	}
);

const emit = defineEmits<{
	(ev: "posted"): void;
	(ev: "cancel"): void;
	(ev: "esc"): void;
}>();

const textareaEl = $ref<HTMLTextAreaElement | null>(null);
const cwInputEl = $ref<HTMLInputElement | null>(null);
const hashtagsInputEl = $ref<HTMLInputElement | null>(null);
const visibilityButton = $ref<HTMLElement | null>(null);

let posting = $ref(false);
let text = $ref(props.initialText ?? "");
let files = $ref(props.initialFiles ?? []);
let poll = $ref<{
	choices: string[];
	multiple: boolean;
	expiresAt: string | null;
	expiredAfter: string | null;
} | null>(null);
let useCw = $ref(false);
let showPreview = $computed(defaultStore.makeGetterSetter("showPreview"));
let cw = $computed(defaultStore.makeGetterSetter("postFormCw"));
let backupText = "";
let backupCw = "";
let localOnly = $ref<boolean>(
	props.initialLocalOnly ?? (defaultStore.state.rememberNoteVisibility
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
let visibleUsers = $ref([]);
if (props.initialVisibleUsers) {
	props.initialVisibleUsers.forEach(pushVisibleUser);
}
let autocomplete = $ref(null);
let smartMFMInputer = $computed(defaultStore.makeGetterSetter("smartMFMInputer"));
let draghover = $ref(false);
let quoteId = $ref(null);
let hasNotSpecifiedMentions = $ref(false);
let includesOtherServerEmoji = $ref(false);
let recentHashtags = $ref(JSON.parse(localStorage.getItem("hashtags") || "[]"));
let canPublic = $ref((!props.reply || props.reply.visibility === "public") && (!props.renote || props.renote.visibility === "public") && (!props.airReply || props.initialVisibility === "public") && !$i.blockPostPublic && !$i.isSilenced);
let canHome = $ref((!props.reply || (props.reply.visibility === "public" || props.reply.visibility === "home")) && (!props.renote || (props.renote.visibility === "public" || props.renote.visibility === "home"))  && (!props.airReply || (props.initialVisibility === "public" || props.initialVisibility === "home")) && !$i.blockPostHome && !$i.isSilenced);
let canFollower = $ref((!props.reply || props.reply.visibility !== "specified") && (!props.renote || props.renote.visibility !== "specified") && (!props.airReply || props.initialVisibility !== "specified") );
let canNotLocal = $ref((!props.reply || !props.reply.localOnly) && (!props.renote || !props.renote.localOnly) && (!props.airReply || !props.initialLocalOnly) && !$i.blockPostNotLocal && !props.channel?.description?.includes("[localOnly]") && !$i.isSilenced);
let requiredFilename = $ref(props.channel?.description?.includes("[requiredFilename]"))
let imeText = $ref("");
let shortcutKeyValue = $ref(0);
let fileselecting = $ref(false);

const publicIcon = $computed((): String => {
	if (!canNotLocal && (canPublic || canHome)) {
		if (canPublic) {
			return 'ph-hand-heart ph-bold ph-lg'
		} else {
			if (!$i.blockPostNotLocalPublic) {
				return 'ph-house-line ph-bold ph-lg'
			}
		}
	}
	if (canPublic) {
		return 'ph-planet ph-bold ph-lg'
	} else if (canHome) {
		return 'ph-house ph-bold ph-lg'
	} else if (canFollower) {
		return 'ph-lock-simple ph-bold ph-lg'
	} else {
		return 'ph-envelope-simple-open ph-bold ph-lg'
	}
});

const homeIcon = $computed((): String => {
	if (!canNotLocal && canHome && !$i.blockPostNotLocalPublic) {
		return 'ph-house-line ph-bold ph-lg'
	} else if (canHome) {
		return 'ph-house ph-bold ph-lg'
	} else if (canFollower) {
		return 'ph-lock-simple ph-bold ph-lg'
	} else {
		return 'ph-envelope-simple-open ph-bold ph-lg'
	}
});

const followerIcon = $computed((): String => {
	if (canFollower) {
		return 'ph-lock-simple ph-bold ph-lg'
	} else {
		return 'ph-envelope-simple-open ph-bold ph-lg'
	}
});

const localIcon = $computed((): String => {
	if (canPublic) {
		return 'ph-hand-heart ph-bold ph-lg'
	} else if (canHome) {
		return 'ph-house-line ph-bold ph-lg'
	} else if (canFollower) {
		return 'ph-lock-simple ph-bold ph-lg'
	} else {
		return 'ph-envelope-simple-open ph-bold ph-lg'
	}
});

const localHomeIcon = $computed((): String => {
	if (canHome) {
		return 'ph-house-line ph-bold ph-lg'
	} else if (canFollower) {
		return 'ph-lock-simple ph-bold ph-lg'
	} else {
		return 'ph-envelope-simple-open ph-bold ph-lg'
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
	} else if (props.reply) {
		key += `reply:${props.reply.id}`;
	} else if (props.airReply) {
		key += `note:${props.airReply.id}`;
	} else {
		key += "note";
		if (props.key) key += `:${props.key}`;
	}

	return key;
});

const placeholder = $computed((): string => {
	if (props.renote) {
		return i18n.ts._postForm.quotePlaceholder;
	} else if (props.reply) {
		return i18n.ts._postForm.replyPlaceholder;
	} else if (props.channel) {
		return i18n.ts._postForm.channelPlaceholder;
	} else if (defaultStore.state.plusInfoPostForm) {
		return (i18n.ts._visibility[visibility] && ((defaultStore.state.rememberNoteVisibility || !defaultStore.state.firstPostButtonVisibilityForce) || visibility === 'specified')
			? `${(localOnly ? "もこワー" : "") + i18n.ts._visibility[visibility]} : ` : "") +
			 new Date()
			 .toLocaleTimeString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })
			 .replace(/日(.*)\s(\d+):(\d+)/,"日($1) $2時$3分");
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
	return props.renote
		? i18n.ts.quote
		: props.reply
		? i18n.ts.reply
		: i18n.ts.note;
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
		(1 <= textLength || 1 <= files.length || !!poll || !!props.renote || !!quoteId) &&
		textLength <= maxTextLength &&
		(!poll || poll.choices.length >= 2) &&
		!fileselecting
	);
});

const withHashtags = $computed(
	defaultStore.makeGetterSetter("postFormWithHashtags")
);
const hashtags = $computed(defaultStore.makeGetterSetter("postFormHashtags"));

const hashtagsPreview = $computed(() => {
	if (withHashtags && hashtags && hashtags.trim() !== "") {
		const textHashtags_ = mfm
			.parse(text)
			.filter((x) => x.type === "hashtag")
			.map((x) => x.props.hashtag.startsWith("#") ? x.props.hashtag : `#${x.props.hashtag}`);
		const hashtags_ = hashtags
			.trim()
			.split(" ")
			.map((x) => (x.startsWith("#") ? x : `#${x}`));
		const hashtags__ = hashtags_
			.filter(x => !textHashtags_.includes(x))
			.join(" ");
		return hashtags__;
	} else {
		return "";
	}
})

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
	props.reply &&
	(props.reply.user.username !== $i.username ||
		(props.reply.user.host != null && props.reply.user.host !== host))
) {
	text = `@${props.reply.user.username}${
		props.reply.user.host != null
			? `@${toASCII(props.reply.user.host)}`
			: ""
	} `;
}

if (props.reply && props.reply.text != null) {
	const ast = mfm.parse(props.reply.text);
	const otherHost = props.reply.user.host;

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
	localOnly = defaultStore.state.channelSecondPostButton ? false : defaultStore.state.rememberNoteVisibility ? defaultStore.state.localOnly : defaultStore.state.defaultNoteLocalOnly;
	if (!canNotLocal) localOnly = true;
}

// 公開以外へのリプライ時は元の公開範囲を引き継ぐ
if (
	props.reply &&
	["home", "followers", "specified"].includes(props.reply.visibility)
) {
	if (props.reply.visibility === "home" && visibility === "followers") {
		visibility = "followers";
	} else if (
		["home", "followers"].includes(props.reply.visibility) &&
		visibility === "specified"
	) {
		visibility = "specified";
	} else {
		visibility = props.reply.visibility;
	}
	if (visibility === "specified") {
		if (props.reply.visibleUserIds) {
			os.api("users/show", {
				userIds: props.reply.visibleUserIds.filter(
					(uid) => uid !== $i.id && uid !== props.reply.userId
				),
			}).then((users) => {
				users.forEach(pushVisibleUser);
			});
		}

		if (props.reply.userId !== $i.id) {
			os.api("users/show", { userId: props.reply.userId }).then(
				(user) => {
					pushVisibleUser(user);
				}
			);
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
if (!canNotLocal && visibility !== "followers" && visibility !== "specified" && localOnly === false && !$i.blockPostNotLocalPublic) localOnly = true;

// keep post cw
if (defaultStore.state.keepPostCw && cw && !cw.includes("@") && !(props.reply && !props.reply.cw)) {
	useCw = true;
} else {
	cw = "";
}
// keep cw when reply
if (defaultStore.state.keepCw && props.reply && props.reply.cw) {
	useCw = true;
	const replyCwText = props.reply.cw?.replaceAll(/(@[^\s]+\s)*(Re:\s?)/ig,"") ?? "";
	cw = `@${props.reply.user.username}${props.reply.user.host ? `@${props.reply.user.host}` : ""} Re: ${replyCwText}`;
	text = text.replace(`@${props.reply.user.username}${props.reply.user.host ? `@${props.reply.user.host}` : ""} `,"");
}

// keep cw when airreply
if (defaultStore.state.keepCw && props.airReply && props.airReply.cw) {
	useCw = true;
	const replyCwText = props.airReply.cw?.replaceAll(/(@[^\s]+\s)*(Re:\s?)/ig,"") ?? "";
	cw = replyCwText;
}

function watchForDraft() {
	watch($$(text), () => saveDraft());
	watch($$(useCw), () => saveDraft());
	watch($$(cw), () => saveDraft());
	watch($$(poll), () => saveDraft());
	watch($$(files), () => saveDraft(), { deep: true });
	watch($$(visibility), () => saveDraft());
	watch($$(localOnly), () => saveDraft());
}

function checkIncludesOtherServerEmoji() {
	if(text?.includes(":") && /:[a-z0-9_+-]+(@[a-z0-9_+-.]+):/.test(text)) {
		includesOtherServerEmoji = true
	} else {
		includesOtherServerEmoji = false
	}
}

function checkMissingMention() {
	if (visibility === "specified") {
		if (props.reply && props.reply.userId !== $i.id && !visibleUsers.some((u) => u.id === props.reply.user.id)) {
			hasNotSpecifiedMentions = true;
			return;
		}
		const ast = mfm.parse(text);

		for (const x of extractMentions(ast)) {
			if (
				!visibleUsers.some(
					(u) => u.username === x.username && (!x.host || u.host === x.host)
				)
			) {
				hasNotSpecifiedMentions = true;
				return;
			}
		}
		hasNotSpecifiedMentions = false;
	}
}

function addMissingMention() {
	if (props.reply && props.reply.userId !== $i.id && !visibleUsers.some((u) => u.id === props.reply.user.id)) {
		os.api("users/show", { userId: props.reply.userId }).then(
			(user) => {
				visibleUsers.push(user);
				saveDraft();
			}
		);
	}

	const ast = mfm.parse(text);

	for (const x of extractMentions(ast)) {
		if (
			!visibleUsers.some(
				(u) => u.username === x.username && (!x.host || u.host === x.host)
			)
		) {
			os.api("users/show", { username: x.username, host: x.host }).then(
				(user) => {
					visibleUsers.push(user);
					saveDraft();
				}
			);
		}
	}
}

function togglePoll() {
	if (poll) {
		poll = null;
	} else {
		poll = {
			choices: ["", ""],
			multiple: false,
			expiresAt: null,
			expiredAfter: null,
		};
	}
}

function toggleUseCw() {
	if(useCw) {
		// ON -> OFF
		const mention = /^(@[\w@.-]+\s?)(.*)$/.exec(cw)
		if(mention != null){
			cw = mention?.[2]
			text = `${mention[1].trim()} ${text}`;
		}
	} else {
		// OFF -> ON
		const mention = /^(@[\w@.-]+\s?)(.*)$/.exec(text)
		if(mention != null){
			text = mention?.[2]
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
	fileselecting = true;
	selectFiles(ev.currentTarget ?? ev.target, i18n.ts.attachFile, requiredFilename).then(
		(files_) => {
			fileselecting = false;
			for (const file of files_) {
				files.push(file);
			}
		}
	).finally(() => {
		fileselecting = false;
	});
}

function detachFile(id) {
	files = files.filter((x) => x.id !== id);
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

function upload(file: File, name?: string) {
	uploadFile(file, defaultStore.state.uploadFolder, name, undefined, undefined, requiredFilename).then((res) => {
		files.push(res);
	});
}

function setVisibility() {

	const isForce = (!defaultStore.state.rememberNoteVisibility && defaultStore.state.firstPostButtonVisibilityForce);

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
		},
		{
			changeVisibility: (v) => {
				visibility = v;
				if (v === "specified"){
					localOnly = false;
					addMissingMention();
				}
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
			(u) => u.username === user.username && (!user.host || u.host === user.host)
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

function clear() {
	text = "";
	files = [];
	poll = null;
	quoteId = null;
}

function onKeyup(ev: KeyboardEvent) {
	let postButtonMax = (
		defaultStore.state.secondPostButton
		? defaultStore.state.thirdPostButton
			? defaultStore.state.fourthPostButton
				? defaultStore.state.fifthPostButton
					? 5
					: 4
				: 3
			: 2
		: 1);
	let postValue = Math.min(((ev.ctrlKey || ev.metaKey) ? 1 : 0) + ((ev.altKey) ? 2 : 0) + ((ev.shiftKey) && (ev.ctrlKey || ev.metaKey || ev.altKey) ? 2 : 0),postButtonMax);
	if (postValue !== unref(shortcutKeyValue) && !isChannel){
		shortcutKeyValue = postValue;
	}
}

function onKeydown(ev: KeyboardEvent) {
	let postButtonMax = (
		defaultStore.state.secondPostButton
		? defaultStore.state.thirdPostButton
			? defaultStore.state.fourthPostButton
				? defaultStore.state.fifthPostButton
					? 5
					: 4
				: 3
			: 2
		: 1);
	let postValue = Math.min(((ev.ctrlKey || ev.metaKey) ? 1 : 0) + ((ev.altKey) ? 2 : 0) + ((ev.shiftKey) && (ev.ctrlKey || ev.metaKey || ev.altKey) ? 2 : 0),postButtonMax);
	if (postValue !== unref(shortcutKeyValue) && !isChannel){
		shortcutKeyValue = postValue;
	}
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue === 1 &&
		canPost &&
		visibility !== 'specified'
	)
		postFirst();
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue === 1 &&
		canPost &&
		visibility === 'specified'
	)
		post();
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue === 2 &&
		defaultStore.state.secondPostButton &&
		(canPost || defaultStore.state.secondPostVisibility === 'specified') &&
		!isChannel &&
		visibility !== 'specified'
	)
		postSecond();
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue === 3 &&
		defaultStore.state.thirdPostButton &&
		(canPost || defaultStore.state.thirdPostVisibility === 'specified') &&
		!isChannel &&
		visibility !== 'specified'
	)
		postThird();
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue === 4 &&
		defaultStore.state.fourthPostButton &&
		(canPost || defaultStore.state.fourthPostVisibility === 'specified') &&
		!isChannel &&
		visibility !== 'specified'
	)
		postFourth();
	if (
		(ev.which === 10 || ev.which === 13) &&
		postValue === 5 &&
		defaultStore.state.fifthPostButton &&
		(canPost || defaultStore.state.fifthPostVisibility === 'specified') &&
		!isChannel &&
		visibility !== 'specified'
	)
		postFifth();
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

	if (!props.renote && !quoteId && paste.startsWith(`${url}/notes/`)) {
		ev.preventDefault();

		os.confirm({
			type: "info",
			text: i18n.ts.quoteQuestion,
		}).then(({ canceled }) => {
			if (canceled) {
				insertTextAtCursor(textareaEl, paste);
				return;
			}

			quoteId = paste.substr(url.length).match(/^\/notes\/(.+?)\/?$/)[1];
		});
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

function saveDraft() {
	const draftData = JSON.parse(localStorage.getItem("drafts") || "{}");

	draftData[draftKey] = {
		updatedAt: new Date(),
		data: {
			text: text,
			useCw: useCw,
			cw: cw,
			visibility: visibility,
			localOnly: localOnly,
			files: files,
			poll: poll,
			visibleUserIds: visibility === "specified" ? visibleUsers.map((u) => u.id) : [],
		},
	};

	localStorage.setItem("drafts", JSON.stringify(draftData));
}

function deleteDraft() {
	const draftData = JSON.parse(localStorage.getItem("drafts") || "{}");

	delete draftData[draftKey];

	localStorage.setItem("drafts", JSON.stringify(draftData));
}

function specifiedCheck() {
	if (visibility === "specified"){
		localOnly = false;
		addMissingMention();
	}
}

async function postFirst() {
	if (defaultStore.state.firstPostButtonVisibilityForce) {
		visibility = defaultStore.state.defaultNoteVisibility;
		localOnly = defaultStore.state.defaultNoteLocalAndFollower;
	}
	specifiedCheck();
	if (canPost && visibility !== 'specified') {
		post();
	}
}

async function postSecond() {
	if (defaultStore.state.secondPostVisibility.startsWith("l-")){
		localOnly = true;
		visibility = defaultStore.state.secondPostVisibility.replace("l-","");
	} else {
		localOnly = false;
		visibility = defaultStore.state.secondPostVisibility;
	}
	specifiedCheck();
	if (canPost && visibility !== 'specified') {
		post();
	}
}

async function postSecondChannel() {
	localOnly = true;
	post();
}
async function postThird() {
	if (defaultStore.state.thirdPostVisibility.startsWith("l-")){
		localOnly = true;
		visibility = defaultStore.state.thirdPostVisibility.replace("l-","");
	} else {
		localOnly = false;
		visibility = defaultStore.state.thirdPostVisibility;
	}
	specifiedCheck();
	if (canPost && visibility !== 'specified') {
		post();
	}
}

async function postFourth() {
	if (defaultStore.state.fourthPostVisibility.startsWith("l-")){
		localOnly = true;
		visibility = defaultStore.state.fourthPostVisibility.replace("l-","");
	} else {
		localOnly = false;
		visibility = defaultStore.state.fourthPostVisibility;
	}
	specifiedCheck();
	if (canPost && visibility !== 'specified') {
		post();
	}
}

async function postFifth() {
	if (defaultStore.state.fifthPostVisibility.startsWith("l-")){
		localOnly = true;
		visibility = defaultStore.state.fifthPostVisibility.replace("l-","");
	} else {
		localOnly = false;
		visibility = defaultStore.state.fifthPostVisibility;
	}
	specifiedCheck();
	if (canPost && visibility !== 'specified') {
		post();
	}
}

async function post() {
	const processedText = preprocess(text);

	if (useCw && !cw?.trim()) cw = "CW";
	if (!useCw && cw) cw = "";

	if (!canPublic && visibility === "public") visibility = "home";
	if (!canHome && visibility === "home") visibility = "followers";
	if (!canFollower && visibility === "followers") visibility = "specified";
	if (!canNotLocal && visibility !== "followers" && visibility !== "specified" && localOnly === false && !$i.blockPostNotLocalPublic) localOnly = true;

	let postData = {
		text: processedText === "" ? undefined : processedText,
		fileIds: files.length > 0 ? files.map((f) => f.id) : undefined,
		replyId: props.reply ? props.reply.id : undefined,
		renoteId: props.renote
			? props.renote.id
			: quoteId
			? quoteId
			: undefined,
		channelId: props.channel ? props.channel.id : undefined,
		poll: poll,
		cw: useCw ? cw || "" : undefined,
		localOnly: localOnly,
		visibility: visibility,
		visibleUserIds:
			visibility === "specified"
				? visibleUsers.map((u) => u.id)
				: undefined,
	};

	if (withHashtags && hashtags && hashtags.trim() !== "") {
		const textHashtags_ = mfm
			.parse(postData.text)
			.filter((x) => x.type === "hashtag")
			.map((x) => x.props.hashtag.startsWith("#") ? x.props.hashtag : `#${x.props.hashtag}`);
		const hashtags_ = hashtags
			.trim()
			.split(" ")
			.map((x) => (x.startsWith("#") ? x : `#${x}`));
		const hashtags__ = hashtags_
			.filter(x => !textHashtags_.includes(x))
			.join(" ");
		postData.text = postData.text
			? `${postData.text} ${hashtags__}`
			: hashtags__;
	}

	// plugin
	if (notePostInterruptors.length > 0) {
		for (const interruptor of notePostInterruptors) {
			postData = await interruptor.handler(deepClone(postData));
		}
	}

	let token = undefined;

	if (postAccount) {
		const storedAccounts = await getAccounts();
		token = storedAccounts.find((x) => x.id === postAccount.id)?.token;
	}

	posting = true;
	os.api("notes/create", postData, token)
		.then(() => {
			clear();
			nextTick(() => {
				deleteDraft();
				emit("posted");
				if (postData.text && postData.text !== "") {
					const hashtags_ = mfm
						.parse(postData.text)
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
				posting = false;
				postAccount = null;
			});
		})
		.catch((err) => {
			posting = false;
			os.alert({
				type: "error",
				text: `${err.message}\n${(err as any).id}`,
			});
		});
}

function cancel() {
	if (!defaultStore.state.CloseAllClearButton){
		emit("cancel");
	} else {
		let _cw = cw;
		let _text = text;
		if (!cw?.trim() && !text?.trim()) {
				cw = backupCw;
				text = backupText;
		} else {
		cw = "";
		if (useCw && props.reply){
			cw = `@${props.reply.user.username}${props.reply.user.host ? `@${props.reply.user.host}` : ""} `;
		}

		if (!useCw && props.reply){
			text = `@${props.reply.user.username}${props.reply.user.host ? `@${props.reply.user.host}` : ""} `;
		} else {
			text = "";
		}
		if ((backupCw || backupText) && _cw === cw && _text === text) {
				cw = backupCw;
				text = backupText;
		} else {
				backupCw = _cw;
				backupText = _text;
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
		insertTextAtCursor(textareaEl, '@');
	}
}

async function insertEmoji(ev: MouseEvent) {
	if (defaultStore.state.openEmojiPicker) {
		os.openEmojiPicker(ev.currentTarget ?? ev.target, {}, textareaEl);
	} else {
		insertTextAtCursor(textareaEl, ':');
	}
}

function insertMfm() {
	if (defaultStore.state.quickToggleSmartMFMInputer) {
		smartMFMInputer = !smartMFMInputer;
	} else {
		insertTextAtCursor(textareaEl, '$');
	}

}

async function openCheatSheet(ev: MouseEvent) {
	os.popup(XCheatSheet, {}, {}, "closed");
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

onMounted(() => {
	if (props.autofocus) {
		focus();

		nextTick(() => {
			focus();
		});
	}

	// TODO: detach when unmount
	new Autocomplete(textareaEl, $$(text));
	new Autocomplete(cwInputEl, $$(cw));
	new Autocomplete(hashtagsInputEl, $$(hashtags));

	nextTick(() => {
		// 書きかけの投稿を復元
		if (!props.instant && !props.mention && !props.specified) {
			const draft = JSON.parse(localStorage.getItem("drafts") || "{}")[
				draftKey
			];
			if (draft && (draft.data.text || (draft.data.useCw && draft.data.cw) || draft.data.files?.length || draft.data.poll)) {
				text = draft.data.text;
				useCw = draft.data.useCw;
				if (useCw) cw = draft.data.cw;
				visibility = draft.data.visibility;
				localOnly = draft.data.localOnly;
				files = (draft.data.files || []).filter(
					(draftFile) => draftFile
				);
				draft.data.visibleUserIds?.forEach((x) => os.api("users/show", { userId: x }).then(
					(user) => {
						pushVisibleUser(user);
					}
				));
				if (draft.data.poll) {
					poll = draft.data.poll;
				}
			}
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
				};
			}
			visibility = init.visibility;
			init.visibleUserIds?.forEach((x) => os.api("users/show", { userId: x }).then(
				(user) => {
					pushVisibleUser(user);
				}
			));
			localOnly = init.localOnly;
			quoteId = init.renote ? init.renote.id : null;
		}

		nextTick(() => watchForDraft());
	});
});

</script>

<style lang="scss" scoped>
.right {
	float: right;
}
.gafaadew {
	position: relative;

	&.modal {
		width: 100%;
		max-width: 520px;
	}

	> header {
		z-index: 1000;
		height: 66px;

		> .cancel {
			padding: 0;
			font-size: 20px;
			width: 64px;
			line-height: 66px;
		}

		> .account {
			height: 100%;
			aspect-ratio: 1/1;
			display: inline-flex;
			vertical-align: bottom;

			> .avatar {
				width: 28px;
				height: 28px;
				margin: auto;
			}
		}

		> .right {
			position: absolute;
			top: 0;
			right: 0;

			> .text-count {
				opacity: 0.7;
				line-height: 66px;
				margin: 0 8px 0 0;
			}

			> .visibility {
				height: 34px;
				width: 34px;
				margin: 0 0 0 0;

				& + .localOnly {
					margin-left: 0 !important;
				}
			}

			> .local-only {
				margin: 0 8px 0 4px;
				opacity: 0.7;
			}

			> .preview {
				display: inline-block;
				padding: 0;
				margin: 0 8px 0 0;
				line-height: 1.4;
				font-size: var(--fontSize);
				width: 34px;
				height: 34px;
				border-radius: 6px;

				&:hover {
					background: var(--X5);
				}

				&.active {
					color: var(--accent);
				}
			}

			> .addblank {
				margin: 0 8px 0 0 !important;
			}

			> .submit {
				display: inline-flex;
				align-items: center;
				margin: 16px 16px 16px 0;
				padding: 0 12px;
				line-height: 34px;
				font-weight: bold;
				vertical-align: bottom;
				border-radius: 4px;
				font-size: 0.9em;

				&:disabled {
					opacity: 0.7;
				}

				> i {
					margin-left: 6px;
				}
			}

			> .submit_h {
				display: inline-flex;
				align-items: center;
				margin: 16px 16px 16px 0;
				padding: 0 12px;
				line-height: 34px;
				font-weight: bold;
				vertical-align: bottom;
				border-radius: 4px;
				font-size: 0.9em;

				&:disabled {
					opacity: 0.7;
				}

				> .subPostIcon {
					margin-left: 6px;
				}

				> .widePostButton {
					margin-left: 12px;
					margin-right: 12px;
				}

				> .widePostButton_left {
					margin-left: calc(9px - 0.45em);
				}

				> .widePostButton_right {
					margin-right: calc(9px - 0.45em);
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
			padding: 16px;
		}

		> .with-quote {
			display: flex;
			align-items: center;
			gap: 0.4em;
			margin-inline: 24px;
			margin-bottom: 12px;
			color: var(--accent);

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

		> .to-specified {
			padding: 6px 24px;
			margin-bottom: 8px;
			overflow: auto;
			line-height: 2rem;

			> .visibleUsers {
				display: inline;
				top: -1px;
				font-size: 14px;

				> button {
					padding: 2px;
					border-radius: 8px;

					> i {
						transform: translateX(2px);
					}
				}

				> span {
					margin: 0.3rem;
					padding: 4px 0 4px 4px;
					border-radius: 999px;
					background: var(--X3);

					> button {
						padding: 4px 8px;
					}
				}
			}
		}

		> .hasNotSpecifiedMentions {
			margin: 0 20px 16px 20px;
		}

		> .cw,
		> .hashtags,
		> .text {
			display: block;
			box-sizing: border-box;
			padding: 0 24px;
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
			padding-bottom: 8px;
			border-bottom: solid 0.5px var(--divider);
		}

		> .hashtags {
			z-index: 1;
			padding-top: 8px;
			padding-bottom: 8px;
			border-top: solid 0.5px var(--divider);
		}

		> .text {
			max-width: 100%;
			min-width: 100%;
			min-height: 90px;

			&.withCw {
				padding-top: 8px;
			}
		}

		> footer {
			padding: 0 16px 0 16px;

			> button {
				display: inline-block;
				padding: 0;
				margin: 0;
				font-size: 16px;
				width: 48px;
				height: 48px;
				border-radius: 6px;

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
			height: 50px;

			> .cancel {
				width: 50px;
				line-height: 50px;
			}

			> .right {
				> .text-count {
					line-height: 50px;
				}

				> .submit {
					margin: 8px 8px 8px 0;
				}

				> .submit_h {
					margin: 8px 8px 8px 0;
				}
			}
		}

		> .form {
			> .to-specified {
				padding: 6px 16px;
			}

			> .cw,
			> .hashtags,
			> .text {
				padding: 0 16px;
			}

			> .text {
				min-height: 80px;
			}

			> footer {
				padding: 0 8px 8px 8px;
			}
		}
	}

	&.max-width_310px {
		> .form {
			> footer {
				> button {
					font-size: 14px;
					width: 44px;
					height: 44px;
				}
			}
		}
	}
}
</style>
