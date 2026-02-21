<template>
	<div
		v-if="(!muted.muted && !summaryRenote) || detailedView"
		v-show="!isDeleted"
		ref="el"
		v-hotkey="keymap"
		v-size="{ max: [500, 450, 350, 300] }"
		class="tkcbzcuz"
		:tabindex="!isDeleted ? '-1' : null"
		:class="[
			{ renote: isRenote },
			{ colored: defaultStore.state.showVisibilityColor },
			`v-${
				appearNote.visibility === 'specified' &&
				appearNote.ccUserIdsCount
					? 'circle'
					: appearNote.visibility
			}`,
			{ localOnly: appearNote.localOnly },
		]"
	>
		<MkNoteSub
			v-if="appearNote.reply && !detailedView"
			:note="appearNote.reply"
			class="reply-to"
		/>
		<div
			v-if="!detailedView"
			class="note-context"
			@click="noteContextClick"
		>
			<div class="line"></div>
			<div v-if="appearNote._prId_" class="info">
				<i class="ph-megaphone-simple-bold ph-lg"></i>
				{{ i18n.ts.promotion
				}}<button class="_textButton hide" @click.stop="readPromo()">
					{{ i18n.ts.hideThisNote }}
					<i class="ph-x ph-bold ph-lg"></i>
				</button>
			</div>
			<div v-if="appearNote._featuredId_" class="info">
				<i class="ph-lightning ph-bold ph-lg"></i>
				{{ i18n.ts.featured }}
			</div>
			<div v-if="pinned" class="info">
				<i class="ph-push-pin ph-bold ph-lg"></i
				>{{ i18n.ts.pinnedNote }}
			</div>
			<div
				v-if="isRenote"
				class="renote"
				:class="[
					{ colored: defaultStore.state.showVisibilityColor },
					appearNote.visibility !== note.visibility ||
					note.ccUserIdsCount
						? `v-${
								note.visibility === 'specified' &&
								note.ccUserIdsCount
									? 'circle'
									: note.visibility
						  }`
						: '',
					{
						localOnly:
							appearNote.localOnly !== note.localOnly &&
							note.localOnly,
					},
				]"
			>
				<i v-if="!pinned" class="ph-repeat ph-bold ph-lg"></i>
				<I18n v-if="!pinned" :src="i18n.ts.renotedBy" tag="span">
					<template #user>
						<MkA
							v-user-preview="note.userId"
							class="name"
							:to="userPage(note.user)"
							@click.stop
						>
							<MkUserName
								:user="note.user"
								:hostIcon="
									note.user.instance?.faviconUrl ||
									note.user.instance?.iconUrl ||
									note.user.host
								"
								:altIcon="note.user.instance?.iconUrl"
							/>
						</MkA>
					</template>
				</I18n>
				<div class="info">
					<i v-if="pinned" class="ph-repeat ph-bold ph-lg"></i>
					<button
						ref="renoteTime"
						class="_button time"
						@click.stop="showRenoteMenu()"
					>
						<i
							v-if="isMyRenote"
							class="ph-dots-three-outline ph-bold ph-lg dropdownIcon"
						></i>
						<MkTime :time="note.createdAt" />
					</button>
					<MkVisibility :note="note" />
				</div>
			</div>
		</div>
		<article
			class="article"
			@contextmenu.stop="onContextmenu"
			@click="noteClick"
		>
			<div class="main">
				<div class="header-container">
					<MkAvatar class="avatar" :user="appearNote.user" />
					<XNoteHeader
						class="header"
						:note="appearNote"
						:mini="true"
					/>
				</div>
				<div class="body">
					<MkSubNoteContent
						class="text"
						:note="appearNote"
						:detailed="true"
						:detailedView="detailedView"
						:parentId="appearNote.parentId"
						:option="option"
						@push="(e) => router.push(notePage(e))"
						@focusfooter="footerEl.focus()"
						@changeShowContent="(v) => (showContent = v)"
					></MkSubNoteContent>
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
					<MkA
						v-if="appearNote.channel && !inChannel"
						class="channel"
						:to="`/channels/${appearNote.channel.id}`"
						@click.stop
						><i class="ph-television ph-bold ph-lg"></i>
						{{ appearNote.channel.name }}</MkA
					>
				</div>
				<div v-if="detailedView" class="info">
					<MkA class="created-at" :to="notePage(appearNote)">
						<MkTime :time="appearNote.createdAt" mode="absolute" />
					</MkA>
				</div>
				<footer ref="footerEl" class="footer" @click.stop tabindex="-1">
					<XReactionsViewer
						v-if="enableEmojiReactions || detailedView"
						v-show="showContent"
						ref="reactionsViewer"
						:note="appearNote"
						:multi="multiReaction"
						:allow-default-reaction="!isStarButtonHandlesDefault"
					/>
					<button
						v-if="referenceIds && referenceIds.length"
						v-tooltip.bottom="i18n.ts.referencesAttached"
						class="button _button"
						:class= "{reacted: referenceIds?.includes(appearNote.id)}"
						@click="toggleReference()"
					>
						<i class="ph-stack ph-bold ph-lg"></i>
                                        </button>
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
						v-tooltip.bottom="i18n.ts.reply"
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
						:note="developerRenote ? note : appearNote"
						:count="appearNote.renoteCount"
					/>
                                       <XStarButtonNoEmoji
                                               v-if="showStarButtonNoEmoji"
                                               ref="starButtonNoEmojiRef"
                                               class="button"
                                               :note="appearNote"
                                               :count="reactionCountViewModel.showStarCount ? reactionCountViewModel.countForStarButton : 0"
                                               :reacted="isDefaultReactionReacted"
                                               :hasPickerButton="showReactionPickerButton"
                                               :isReactionListVisible="isReactionListVisible"
                                       />
					<XStarButton
						v-if="false"
						ref="starButton"
						class="button"
						:note="appearNote"
					/>
                                       <button
                                               v-if="showReactionPickerButton"
                                               :title="
                                                       multiReaction
                                                               ? (appearNote.myReactions?.length ?? 0) +
                                                                 ' / ' +
                                                                 maxReactions
								: ''
						"
						ref="reactionPickerButtonRef"
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
                                                       v-if="isMaxReacted"
                                                       class="ph-prohibit ph-bold ph-lg"
                                               ></i>
                                               <i
                                                       v-else-if="multiReaction"
                                                       class="ph-smiley-wink ph-bold ph-lg"
                                               ></i>
                                               <i v-else class="ph-smiley ph-bold ph-lg"></i>
						<template v-if="reactionCountViewModel.showReactionPickerCount">
							<p class="count">{{ reactionCountViewModel.countForReactionPickerButton }}</p>
						</template>
                                       </button>
                                       <button
                                               v-if="showUndoReactionButton"
                                               ref="undoReactionButtonRef"
                                               class="button _button"
                                               @click="undoReact(appearNote)"
                                       >
                                               <i class="ph-minus ph-bold ph-lg" style="color: var(--accent);"></i>
						<template v-if="reactionCountViewModel.showUndoReactionCount && showUndoReactionButton">
							<p class="count">{{ reactionCountViewModel.countForUndoReactionButton }}</p>
						</template>
                                       </button>
					<XQuoteButton
						class="button"
						:note="developerQuote ? note : appearNote"
					/>
					<button
						ref="menuButton"
						v-tooltip.bottom="i18n.ts.more"
						class="button _button"
						@click="menu()"
					>
						<i class="ph-dots-three-outline ph-bold ph-lg"></i>
					</button>
				</footer>
			</div>
		</article>
	</div>
	<button
		v-else-if="summaryRenote"
		class="muted _button"
		@click="summaryRenote = false"
	>
		<div
			tag="small"
			style="
				padding: 0 3%;
				font-size: 0.8em;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			"
		>
			{{ isRecentRenote ? "最近表示したRT : " : "既に反応済のRT : " }}
			<MkA
				v-user-preview="note.userId"
				class="name"
				:to="userPage(note.user)"
			>
				<MkUserName :user="note.user" maxlength="8" />
			</MkA>
			{{ " がRT " }}
			<MkA
				v-user-preview="appearNote.userId"
				class="name"
				:to="userPage(appearNote.user)"
			>
				<MkUserName :user="appearNote.user" maxlength="8" />
			</MkA>
			{{ " の投稿" }}
		</div>
		<div
			tag="small"
			style="
				padding: 0 3%;
				font-size: 0.8em;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			"
		>
			{{ getNoteSummary(appearNote) }}
		</div>
	</button>
	<button
		v-else-if="
			(!hiddenSoftMutes && muted.matched.join('').length !== 0) ||
			excludeMute
		"
		class="muted _button"
		@click="muted.muted = false"
	>
		<I18n :src="softMuteReasonI18nSrc(muted.what)" tag="small">
			<template #name>
				<MkA
					v-user-preview="note.userId"
					class="name"
					:to="userPage(note.user)"
				>
					<MkUserName :user="note.user" maxlength="8" />
				</MkA>
			</template>
			<template #reason>
				{{
					muted.matched.length === 0
						? isExcludeNotification
							? "通知"
							: ""
						: muted.matched.join(", ") +
						  (isExcludeNotification ? " (通知)" : "")
				}}
			</template>
		</I18n>
	</button>
	<button
		v-else
		class="muted _button"
		@click="muted.muted = false"
		style="display: none"
	>
		<I18n :src="softMuteReasonI18nSrc(muted.what)" tag="small">
			<template #name>
				<MkA
					v-user-preview="note.userId"
					class="name"
					:to="userPage(note.user)"
				>
					<MkUserName :user="note.user" maxlength="8" />
				</MkA>
			</template>
			<template #reason>
				{{
					muted.matched.length === 0
						? isExcludeNotification
							? "通知"
							: ""
						: muted.matched.join(", ") +
						  (isExcludeNotification ? " (通知)" : "")
				}}
			</template>
		</I18n>
	</button>
</template>

<script lang="ts" setup>
import {
	unref,
	computed,
	inject,
	onMounted,
	onUnmounted,
	reactive,
	ref,
} from "vue";
import * as mfm from "mfm-js";
import type { Ref } from "vue";
import type * as misskey from "calckey-js";
import MkNoteSub from "@/components/MkNoteSub.vue";
import MkSubNoteContent from "./MkSubNoteContent.vue";
import XNoteHeader from "@/components/MkNoteHeader.vue";
import XNoteSimple from "@/components/MkNoteSimple.vue";
import XMediaList from "@/components/MkMediaList.vue";
import XCwButton from "@/components/MkCwButton.vue";
import XPoll from "@/components/MkPoll.vue";
import XRenoteButton from "@/components/MkRenoteButton.vue";
import XReactionsViewer from "@/components/MkReactionsViewer.vue";
import XUsersTooltip from "@/components/MkUsersTooltip.vue";
import XStarButton from "@/components/MkStarButton.vue";
import XStarButtonNoEmoji from "@/components/MkStarButtonNoEmoji.vue";
import XQuoteButton from "@/components/MkQuoteButton.vue";
import MkUrlPreview from "@/components/MkUrlPreview.vue";
import MkVisibility from "@/components/MkVisibility.vue";
import { pleaseLogin } from "@/scripts/please-login";
import { focusPrev, focusNext } from "@/scripts/focus";
import { getWordSoftMute } from "@/scripts/check-word-mute";
import { useRouter } from "@/router";
import { userPage } from "@/filters/user";
import * as os from "@/os";
import { defaultStore, noteViewInterruptors } from "@/store";
import { instance } from "@/instance";
import { reactionPicker } from "@/scripts/reaction-picker";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { getNoteMenu } from "@/scripts/get-note-menu";
import { useNoteCapture } from "@/scripts/use-note-capture";
import { useTooltip } from "@/scripts/use-tooltip";
import { useReactionCountViewModel } from "@/scripts/use-reaction-count-view-model";
import { notePage } from "@/filters/note";
import { deepClone } from "@/scripts/clone";
import { getNoteSummary } from "@/scripts/get-note-summary";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import * as sound from "@/scripts/sound.js";
import { normalizeReactionName } from "@/scripts/reaction-utils";

const router = useRouter();

const props = defineProps<{
	note: misskey.entities.Note;
	pinned?: boolean;
	detailedView?: boolean;
	notification?: boolean;
	endpoint?: string;
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
	note.renoteId != null &&
	note.text == null &&
	note.fileIds.length === 0 &&
	note.poll == null &&
	!note.invisible;

const isQuote = note.renoteId != null && !isRenote;

const el = ref<HTMLElement>();
const footerEl = ref<HTMLElement>();
const menuButton = ref<HTMLElement>();
const starButton = ref<InstanceType<typeof XStarButton>>();
const renoteButton = ref<InstanceType<typeof XRenoteButton>>();
const renoteTime = ref<HTMLElement>();
const reactButton = ref<HTMLElement>();
let appearNote = $computed(() =>
	isRenote ? (note.renote as misskey.entities.Note) : note
);
let quoteNote = $computed(() =>
	isQuote ? (note.renote as misskey.entities.Note) : note
);
let replyNote = $computed(() =>
	note.reply != null ? (note.reply as misskey.entities.Note) : note
);
const isMyRenote = $i && $i.id === note.userId;
const multiReaction =
	$i &&
	$i.patron &&
	(!appearNote.user.host ||
		appearNote.user.instance?.maxReactionsPerAccount > 1);
const maxReactions = multiReaction
	? Math.min(appearNote.user.instance?.maxReactionsPerAccount ?? 3, 3)
	: 1;
const showContent = ref(false);
const isDeleted = ref(false);
const muted = ref(
	getWordSoftMute(note, $i, defaultStore.state.mutedWords, props.endpoint)
);
const translation = ref(null);
const translating = ref(false);
const info = ref(null);
const enableEmojiReactions = defaultStore.state.enableEmojiReactions;
const showEmojiButton = defaultStore.state.showEmojiButton;
const isDetailedView = $computed(() => props.detailedView ?? false);
const isReactionListVisible = $computed(() =>
	(enableEmojiReactions || isDetailedView) && showContent.value
);

const isStarButtonHandlesDefault = $computed(() => {
	return defaultStore.state.favButtonReaction === "";
});
const favButtonReactionIsFavorite =
        defaultStore.state.favButtonReaction === "favorite";
const hiddenSoftMutes = defaultStore.state.hiddenSoftMutes;
const muteExcludeReplyQuote = defaultStore.state.muteExcludeReplyQuote;
const muteExcludeNotification = defaultStore.state.muteExcludeNotification;
const isExcludeReplyQuote =
	muteExcludeReplyQuote &&
	(unref(muted)?.what === "reply" || unref(muted)?.what === "renote");
const isExcludeNotification = muteExcludeNotification && props.notification;
const isCanAction = $i && (!$i.isSilenced || appearNote.user.isFollowed);
const excludeMute = isExcludeReplyQuote || isExcludeNotification;
const developerRenote = defaultStore.state.developerRenote;
const developerQuote = defaultStore.state.developerQuote;
const developerNoteMenu = defaultStore.state.developerNoteMenu;
const referenceIds = $computed(
	defaultStore.makeGetterSetter("postFormReferenceIds")
);
const recentRenoteId = $computed(
	defaultStore.makeGetterSetter("recentRenoteId")
);

const isMaxReacted = $computed(() =>
	multiReaction
		? appearNote.myReactions?.length >= maxReactions
		: appearNote.myReaction != null
);
const isfavButtonReacted = $computed(() => {
	const favButtonReaction = multiReaction
		? defaultStore.state.woozyMode === true
			? "🥴"
			: defaultStore.state.favButtonReaction === "custom"
			? defaultStore.state.favButtonReactionCustom
			: defaultStore.state.favButtonReaction === ""
			? ":iine_fav:"
			: defaultStore.state.favButtonReaction
		: undefined;
	return multiReaction
		? appearNote.myReactions
				?.map((x) => x.replace(/@[^:\s]?(:?)$/, "$1"))
				.includes(favButtonReaction)
		: false;
});


const isDefaultReactionReacted = $computed(() => {
	if (appearNote.myReaction) {
		return (
			normalizeReactionName(appearNote.myReaction) ===
			instance.defaultReaction
		);
	}
	if (appearNote.myReactions) {
		return appearNote.myReactions.some(
			(r) => normalizeReactionName(r) === instance.defaultReaction
		);
	}
	return false;
});

const showStarButtonNoEmoji = $computed(() => {
	const canShow =
		((!isMaxReacted && !isfavButtonReacted && isCanAction) ||
			favButtonReactionIsFavorite ||
			(isStarButtonHandlesDefault && isDefaultReactionReacted));
	return canShow && defaultStore.state.favButtonReaction !== "hidden";
});

const showReactionPickerButton = $computed(
	() =>
		(enableEmojiReactions || isDetailedView || showEmojiButton) &&
		isCanAction
);

const showUndoReactionButton = $computed(
	() =>
		(enableEmojiReactions || isDetailedView || showEmojiButton) &&
		appearNote.myReaction != null &&
		!multiReaction
);

const {
	reactionCountViewModel,
} = useReactionCountViewModel({
	note: $$(appearNote),
	isReactionListVisible: $$(isReactionListVisible),
	showStarButtonNoEmoji: $$(showStarButtonNoEmoji),
	showReactionPickerButton: $$(showReactionPickerButton),
	showUndoReactionButton: $$(showUndoReactionButton),
	isStarButtonHandlesDefault: $$(isStarButtonHandlesDefault),
});

const isReactedRenote = $computed(
	() =>
		!unref(muted)?.muted &&
		defaultStore.state.reactedRenoteHidden &&
		isRenote &&
		appearNote.myReaction
);

const isRecentRenote = $computed(() => {
	// 設定がオンでリノート時に判定
	if (!unref(muted)?.muted && !isReactedRenote && isRenote) {
		//一時間以上前に確認したリノートを除外
		const now = Date.now();
		//無意味に書き込むことを回避
		if (recentRenoteId.some((x) => now - x.date >= 60 * 60 * 1000))
			recentRenoteId = recentRenoteId.filter(
				(x) => now - x.date < 60 * 60 * 1000
			);
		const targetRecentRenoteId = recentRenoteId.filter(
			(x) => x.id === appearNote.id
		);
		//設定がオフならここで処理終了
		if (!defaultStore.state.recentRenoteHidden) return false;
		//最近見たリノートリストに登録されているか
		if (targetRecentRenoteId?.length !== 0) {
			if (targetRecentRenoteId.some((x) => x.fid === note.id)) {
				//登録時のノートと同じ場合は畳まない。falseを返す
				return false;
			} else {
				//リノート先が同じでノートが異なる場合は畳む。trueを返す
				//ただし自分のノートの場合は表示する
				if (isMyRenote) {
					//タイムスタンプはそのままで自分のノートを登録
					recentRenoteId = recentRenoteId.filter(
						(x) => x.id !== appearNote.id
					);
					recentRenoteId = [
						...recentRenoteId,
						{
							id: appearNote.id,
							fid: note.id,
							date: targetRecentRenoteId[0]?.date,
						},
					];
					return false;
				} else {
					return true;
				}
			}
		} else {
			//されていない場合はリノートを除外したリスト+現在の双方のノートidを保存した後、falseを返す
			recentRenoteId = [
				...recentRenoteId,
				{ id: appearNote.id, fid: note.id, date: now },
			];
			return false;
		}
	} else {
		return false;
	}
});

const summaryRenote = ref(isReactedRenote || isRecentRenote);

const keymap = {
	r: () => reply(true),
	"e|a|plus": () => react(true),
	q: () => renoteButton.value.renote(true),
	"up|k": focusBefore,
	"down|j": focusAfter,
	esc: blur,
	"m|o": () => menu(true),
	s: () => showContent.value !== showContent.value,
};

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
	if (isMaxReacted) return;
	pleaseLogin();
	if (
		defaultStore.state.mastodonOnetapFavorite &&
		appearNote.user.instance?.maxReactionsPerAccount === 0
	) {
		os.api("notes/reactions/create", {
			noteId: note.id,
			reaction: "",
		}).then(() => {
			sound.play("reaction");
		});
	} else {
		blur();
		reactionPicker.show(
			reactionPickerButtonRef.value,
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
}

async function undoReact(note): void {
	const oldReaction = note.myReaction;
	if (!oldReaction) return;

	const confirm = await os.confirm({
		type: "warning",
		text: i18n.ts.cancelReactionConfirm,
	});
	if (confirm.canceled) return;

	os.api("notes/reactions/delete", {
		noteId: note.id,
		reaction: oldReaction,
	});
}

const starButtonNoEmojiRef = ref<HTMLElement>();
const reactionPickerButtonRef = ref<HTMLElement>();
const undoReactionButtonRef = ref<HTMLElement>();

// ピッカーボタン用のtooltip
useTooltip(
	reactionPickerButtonRef,
	async (showing) => {
		if (reactionCountViewModel.tooltipQuery.shouldSkip) {
			return;
		}

		const reactions = await os.api("notes/reactions", {
			noteId: appearNote.id,
			type: reactionCountViewModel.tooltipQuery.type,
			excludeType: reactionCountViewModel.tooltipQuery.excludeType,
			limit: 11,
		});

		const users = reactions.map((x) => x.user);
		if (users.length < 1) return;

		const count = reactionCountViewModel.tooltipQuery.count;

		os.popup(
			XUsersTooltip,
			{
				showing,
				users,
				count,
				targetElement: reactionPickerButtonRef.value,
			},
			{},
			"closed"
		);
	},
	500
);

// 取り消しボタン用のtooltip
useTooltip(
	undoReactionButtonRef,
	async (showing) => {
		if (reactionCountViewModel.tooltipQuery.shouldSkip) {
			return;
		}

		const reactions = await os.api("notes/reactions", {
			noteId: appearNote.id,
			type: reactionCountViewModel.tooltipQuery.type,
			excludeType: reactionCountViewModel.tooltipQuery.excludeType,
			limit: 11,
		});

		const users = reactions.map((x) => x.user);
		if (users.length < 1) return;

		const count = reactionCountViewModel.tooltipQuery.count;

		os.popup(
			XUsersTooltip,
			{
				showing,
				users,
				count,
				targetElement: undoReactionButtonRef.value,
			},
			{},
			"closed"
		);
	},
	500
);

const currentClipPage = inject<Ref<misskey.entities.Clip> | null>(
	"currentClipPage",
	null
);

function onContextmenu(ev: MouseEvent): void {
	const isLink = (el: HTMLElement) => {
		if (el.tagName === "A") return true;
		if (el.parentElement) {
			return isLink(el.parentElement);
		}
	};
	if (isLink(ev.target)) return;
	if (window.getSelection().toString() !== "") return;

	if (defaultStore.state.doContextMenu === "reactionPicker") {
		ev.preventDefault();
		react();
	} else if (defaultStore.state.doContextMenu === "contextMenu") {
		os.contextMenu(
			getNoteMenu({
				note: note,
				translating,
				translation,
				menuButton,
				isDeleted,
				currentClipPage,
				info,
				pinned: props.pinned,
			}),
			ev
		).then(focus);
	}
}

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
			pinned: props.pinned,
		}),
		menuButton.value,
		{
			viaKeyboard,
		}
	).then(focus);
}

function showRenoteMenu(viaKeyboard = false): void {
	if (!isMyRenote) return;
	os.popupMenu(
		[
			{
				text: i18n.ts.unrenote,
				icon: "ph-trash ph-bold ph-lg",
				danger: true,
				action: () => {
					os.api("notes/delete", {
						noteId: note.id,
					});
					isDeleted.value = true;
				},
			},
		],
		renoteTime.value,
		{
			viaKeyboard: viaKeyboard,
		}
	);
}

function focus() {
	el.value.focus();
}

function blur() {
	el.value.blur();
}

function focusBefore() {
	focusPrev(el.value);
}

function focusAfter() {
	focusNext(el.value);
}

function noteClick(e) {
	if (
		!defaultStore.state.showDetailNoteClick ||
		document.getSelection().type === "Range" ||
		props.detailedView
	) {
		e.stopPropagation();
	} else {
		router.push(notePage(appearNote));
	}
}

function noteContextClick(e) {
	if (document.getSelection().type === "Range" || props.detailedView) {
		e.stopPropagation();
	} else {
		router.push(notePage(appearNote));
	}
}

function readPromo() {
	os.api("promo/read", {
		noteId: appearNote.id,
	});
	isDeleted.value = true;
}

function toggleReference() {
	if (referenceIds?.includes(appearNote.id)) {
		referenceIds = referenceIds.filter((x) => x !== appearNote.id)
	} else {
		referenceIds = Array.from(new Set([...referenceIds, appearNote.id]))
	}
}
</script>

<style lang="scss" scoped>
.tkcbzcuz {
	position: relative;
	transition: box-shadow 0.1s ease;
	font-size: 1.05em;
	overflow: clip;
	contain: content;

	// これらの指定はパフォーマンス向上には有効だが、ノートの高さは一定でないため、
	// 下の方までスクロールすると上のノートの高さがここで決め打ちされたものに変化し、表示しているノートの位置が変わってしまう
	// ノートがマウントされたときに自身の高さを取得し contain-intrinsic-size を設定しなおせばほぼ解決できそうだが、
	// 今度はその処理自体がパフォーマンス低下の原因にならないか懸念される。また、被リアクションでも高さは変化するため、やはり多少のズレは生じる
	// 一度レンダリングされた要素はブラウザがよしなにサイズを覚えておいてくれるような実装になるまで待った方が良さそう(なるのか？)
	//content-visibility: auto;
	//contain-intrinsic-size: 0 8rem;

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

	& > .article > .main {
		&:hover,
		&:focus-within {
			:deep(.footer .button) {
				opacity: 1;
			}
		}
	}

	> .reply-to {
		& + .note-context {
			.line::before {
				content: "";
				display: block;
				margin-bottom: -0.625rem;
				margin-top: 1rem;
				border-left: 0.125rem solid var(--X13);
				margin-left: calc((var(--avatarSize) / 2) - 0.0625rem);
			}
		}
	}

	.note-context {
		padding: 0 2rem 0 2rem;
		display: flex;
		&:first-child {
			margin-top: 1.25rem;
		}
		> :not(.line) {
			width: 0;
			flex-grow: 1;
			position: relative;
			line-height: 1.75rem;
		}
		> .line {
			width: var(--avatarSize);
			display: flex;
			margin-right: 0.875rem;
			margin-top: 0;
			flex-grow: 0;
		}

		> div > i {
			margin-left: -0.03125rem;
		}
		> .info {
			display: flex;
			align-items: center;
			font-size: 90%;
			white-space: pre;
			color: #f6c177;

			> i {
				margin-right: 0.25rem;
			}

			> .hide {
				margin-left: auto;
				color: inherit;
			}
		}

		> .renote {
			display: flex;
			align-items: center;
			white-space: pre;
			color: var(--renote);
			cursor: pointer;

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
				display: flex;

				> .time {
					flex-shrink: 0;
					color: inherit;
					display: inline-flex;
					align-items: center;
					> .dropdownIcon {
						margin-right: 0.25rem;
					}
				}
			}
		}
	}

	> .article {
		padding: 0.25rem 2rem 0.625rem;
		cursor: pointer;

		@media (pointer: coarse) {
			cursor: default;
		}

		.header-container {
			display: flex;
			> .avatar {
				flex-shrink: 0;
				display: block;
				margin: 0 0.875rem 0 0;
				width: var(--avatarSize);
				height: var(--avatarSize);
				position: relative;
				top: 0;
				left: 0;
			}
			> .header {
				width: 0;
				flex-grow: 1;
			}
		}
		> .main {
			flex: 1;
			min-width: 0;

			> .body {
				margin-top: 0.7em;
				> .translation {
					border: solid 0.03125rem var(--divider);
					border-radius: var(--radius);
					padding: 0.75rem;
					margin-top: 0.5rem;
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
							background: var(--panelHighlight);
						}
					}
				}

				> .channel {
					opacity: 0.7;
					font-size: 80%;
				}
			}
			> .info {
				margin-block: 1rem;
				opacity: 0.7;
				font-size: 0.9em;
			}
			> .footer {
				position: relative;
				z-index: 2;
				display: flex;
				flex-wrap: wrap;
				pointer-events: none; // Allow clicking anything w/out pointer-events: all; to open post
				margin-top: 0.4em;
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

					&.referenced {
						color: var(--accent);
					}
				}
				> .unsupported {
					opacity: 0.15 !important;
				}
			}
		}
	}

	> .reply {
		border-top: solid 0.03125rem var(--divider);
	}

	&.max-width_500px {
		font-size: 0.9em;
	}

	&.max-width_450px {
		padding-top: 0.375rem;
		> .note-context {
			padding-inline: 1rem;
			margin-top: 0.5rem;
			> :not(.line) {
				margin-top: 0;
			}
			> .line {
				margin-right: 0.625rem;
				&::before {
					margin-top: 0.5rem;
				}
			}
		}
		> .article {
			padding: 0.25rem 1rem 0.5rem;
			> .main > .header-container > .avatar {
				margin-right: 0.625rem;
				// top: calc(0.875rem + var(--stickyTop, 0));
			}
		}
	}

	&.max-width_300px {
	}
}

.muted {
	padding: 0.5rem;
	text-align: center;
	opacity: 0.7;
	width: 100%;
}
</style>
