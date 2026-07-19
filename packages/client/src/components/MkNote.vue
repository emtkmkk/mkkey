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
						@focusfooter="footerRef?.focus()"
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
				<MkNoteFooter
					ref="footerRef"
					:note="note"
					:appearNote="appearNote"
					:pinned="pinned"
					:detailedView="detailedView"
					:showContent="showContent"
					:note-menu-refs="noteMenuRefs"
					:focusNote="focus"
					:blurNote="blur"
				/>
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
/**
 * @packageDocumentation
 *
 * ノート本体の表示を管理するコンポーネント。
 *
 * @remarks
 * - フッター（返信・RT・★・リアクション追加/取消・引用・メニュー）は `MkNoteFooter.vue` に
 *   実装が集約されている。本コンポーネントは `footerRef` 経由で操作を委譲するだけ。
 * - キーボードショートカット・右クリックメニューも同様に `footerRef` へ委譲する。
 * - `getNoteMenu` が Ref を直接更新するため、`noteMenuRefs` はテンプレート経由の
 *   自動アンラップを避け、スクリプト側で組み立てたプレーンオブジェクトとして渡す。
 *
 * @internal
 */
import {
	unref,
	inject,
	onMounted,
	ref,
} from "vue";
import type * as misskey from "calckey-js";
import MkNoteSub from "@/components/MkNoteSub.vue";
import MkSubNoteContent from "./MkSubNoteContent.vue";
import XNoteHeader from "@/components/MkNoteHeader.vue";
import XNoteSimple from "@/components/MkNoteSimple.vue";
import XMediaList from "@/components/MkMediaList.vue";
import XCwButton from "@/components/MkCwButton.vue";
import XPoll from "@/components/MkPoll.vue";
import MkNoteFooter from "@/components/MkNoteFooter.vue";
import MkUrlPreview from "@/components/MkUrlPreview.vue";
import MkVisibility from "@/components/MkVisibility.vue";
import { focusPrev, focusNext } from "@/scripts/focus";
import { getWordSoftMute } from "@/scripts/check-word-mute";
import { useRouter } from "@/router";
import { userPage } from "@/filters/user";
import * as os from "@/os";
import { defaultStore, noteViewInterruptors } from "@/store";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { useNoteCapture } from "@/scripts/use-note-capture";
import { notePage } from "@/filters/note";
import { deepClone } from "@/scripts/clone";
import { getNoteSummary } from "@/scripts/get-note-summary";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import { hideToolbarNormalReply } from "@/scripts/stranger-air-reply-toolbar";

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
const footerRef = ref<InstanceType<typeof MkNoteFooter>>();
const renoteTime = ref<HTMLElement>();
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
const showContent = ref(false);
const isDeleted = ref(false);
const muted = ref(
	getWordSoftMute(note, $i, defaultStore.state.mutedWords, props.endpoint)
);
const translation = ref(null);
const translating = ref(false);
const info = ref(null);
/**
 * getNoteMenu が参照する Ref 群。
 *
 * @remarks
 * NOTE: テンプレートで `:info="info"` のように渡すと Vue が自動アンラップし、
 * Footer 側では `null` が届いて `props.info.value = ...` が TypeError になる。
 * プレーンオブジェクトに載せて渡すことで Ref 実体を維持する。
 *
 * @internal
 */
const noteMenuRefs = {
	info,
	translation,
	translating,
	isDeleted,
};
const hiddenSoftMutes = defaultStore.state.hiddenSoftMutes;
const muteExcludeReplyQuote = defaultStore.state.muteExcludeReplyQuote;
const muteExcludeNotification = defaultStore.state.muteExcludeNotification;
const isExcludeReplyQuote =
	muteExcludeReplyQuote &&
	(unref(muted)?.what === "reply" || unref(muted)?.what === "renote");
const isExcludeNotification = muteExcludeNotification && props.notification;
const excludeMute = isExcludeReplyQuote || isExcludeNotification;
const recentRenoteId = $computed(
	defaultStore.makeGetterSetter("recentRenoteId")
);

const isReactedRenote = $computed(
	() =>
		!unref(muted)?.muted &&
		defaultStore.state.reactedRenoteHidden &&
		isRenote &&
		appearNote.myReaction
);

/**
 * 「最近表示したRT」として畳むかどうかを判定し、必要なら recentRenoteId へ登録する。
 *
 * @remarks
 * 以前は `$computed`（reactiveなgetter）として実装されており、依存先の
 * `recentRenoteId` 自身への書き込みが再評価を誘発しうる構造だった。結果として
 * ノートが再描画されるたびに recentRenoteId（pizzaxストア）への書き込み＝
 * idb書き込み＋BroadcastChannel送信が発生していた。
 * この判定・記録はノート表示時に一度行えば十分（`summaryRenote` も一度きりの
 * seedとして使われるだけで、以降はリアクティブに追従しない）ため、
 * 通常の関数として一度だけ実行する形に変更する。
 *
 * @internal
 */
function computeIsRecentRenote(): boolean {
	// 設定がオンでリノート時に判定
	if (unref(muted)?.muted || isReactedRenote || !isRenote) return false;

	//一時間以上前に確認したリノートを除外（無意味な書き込みを避けるため変化があるときだけ書く）
	const now = Date.now();
	if (recentRenoteId.some((x) => now - x.date >= 60 * 60 * 1000)) {
		recentRenoteId = recentRenoteId.filter(
			(x) => now - x.date < 60 * 60 * 1000
		);
	}

	//設定がオフならここで処理終了
	if (!defaultStore.state.recentRenoteHidden) return false;

	//最近見たリノートリストに登録されているか
	const targetRecentRenoteId = recentRenoteId.filter(
		(x) => x.id === appearNote.id
	);
	if (targetRecentRenoteId.length !== 0) {
		if (targetRecentRenoteId.some((x) => x.fid === note.id)) {
			//登録時のノートと同じ場合は畳まない
			return false;
		}
		//リノート先が同じでノートが異なる場合は畳む
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
		}
		return true;
	}

	//されていない場合はリノートを除外したリスト+現在の双方のノートidを保存した後、falseを返す
	recentRenoteId = [
		...recentRenoteId,
		{ id: appearNote.id, fid: note.id, date: now },
	];
	return false;
}

const isRecentRenote = computeIsRecentRenote();

const summaryRenote = ref(isReactedRenote || isRecentRenote);

const keymap = {
	r: () => {
		// 誤爆防止で返信ボタンを隠している間は R キーでも返信を開かない（メニューから意図的に操作する）
		if (hideToolbarNormalReply(appearNote)) return;
		footerRef.value?.reply(true);
	},
	"e|a|plus": () => footerRef.value?.react(true),
	q: () => footerRef.value?.renote(true),
	"up|k": focusBefore,
	"down|j": focusAfter,
	esc: blur,
	"m|o": () => footerRef.value?.menu(true),
	s: () => (showContent.value = !showContent.value),
};

useNoteCapture({
	rootEl: el,
	note: $$(appearNote),
	isDeletedRef: isDeleted,
});

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
		footerRef.value?.react();
	} else if (defaultStore.state.doContextMenu === "contextMenu") {
		footerRef.value?.openContextMenu(ev);
	}
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

// NOTE: MkNoteDetailed が詳細ページのホットキー・右クリックメニューを委譲するために利用する
defineExpose({
	reply: (viaKeyboard = false) => footerRef.value?.reply(viaKeyboard),
	react: (viaKeyboard = false) => footerRef.value?.react(viaKeyboard),
	menu: (viaKeyboard = false) => footerRef.value?.menu(viaKeyboard),
	renote: (viaKeyboard = false) => footerRef.value?.renote(viaKeyboard),
	toggleShowContent: () => {
		showContent.value = !showContent.value;
	},
});
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
			// NOTE: footer 自体のスタイルは MkNoteFooter.vue（子コンポーネント）が持つ。
			// メインタイムライン用の上余白のみ、ここから :deep() で上乗せする。
			:deep(.footer) {
				margin-top: 0.4em;
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
