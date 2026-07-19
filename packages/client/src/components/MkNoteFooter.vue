<template>
	<footer ref="footerRootEl" class="footer" @click.stop tabindex="-1">
		<XReactionsViewer
			v-if="enableEmojiReactions || isDetailedView"
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
			:class="{ reacted: referenceIds?.includes(appearNote.id) }"
			@click="toggleReference()"
		>
			<i class="ph-stack ph-bold ph-lg"></i>
		</button>
		<button
			v-if="showToolbarAirReplyForNote(appearNote)"
			v-tooltip.bottom="i18n.ts.airReply"
			class="button _button"
			@click="airReply()"
		>
			<i class="ph-paper-plane-tilt ph-bold ph-lg"></i>
			<template
				v-if="
					hideToolbarNormalReply(appearNote) &&
					appearNote.repliesCount > 0
				"
			>
				<p class="count">{{ appearNote.repliesCount }}</p>
			</template>
		</button>
		<button
			v-if="!hideToolbarNormalReply(appearNote)"
			v-tooltip.noDelay.bottom="i18n.ts.reply"
			class="button _button"
			@click="reply(false, $event)"
		>
			<i class="ph-arrow-u-up-left ph-bold ph-lg"></i>
			<template v-if="appearNote.repliesCount > 0">
				<p class="count">{{ appearNote.repliesCount }}</p>
			</template>
		</button>
		<XRenoteButton
			ref="renoteButtonRef"
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
			<!-- multiReaction のときだけ上限到達アイコンを表示する -->
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
			ref="menuButtonRef"
			v-tooltip.noDelay.bottom="i18n.ts.more"
			class="button _button"
			@click="menu()"
		>
			<i class="ph-dots-three-outline ph-bold ph-lg"></i>
		</button>
	</footer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ノートフッター（リアクション表示・返信・RT・★・リアクション追加/取消・引用・メニュー）。
 *
 * @remarks
 * - MkNote.vue（タイムライン等）と MkNoteSub.vue（会話ツリー）の両方から使われる共通実装。
 * - 以前は両コンポーネントにほぼ同一のロジック・テンプレートが重複しており、
 *   一方だけに機能が追加/修正される「ドリフト」が繰り返し発生していた。
 *   本コンポーネントへ統合することで、footer に関する挙動を単一の実装に保つ。
 * - ★ボタン、リアクション追加ボタン、取り消しボタンの表示条件をここで統合する。
 * - multi / 非 multi の違いにより、同じ isMaxReacted でも UI の意味が変わるため条件を分けて扱う。
 * - `hideToolbarNormalReply` で返信を隠す（誤爆防止対象、または常にメニュー返信）。空リプをツールバーに出しているときは返信数を空リプボタン直後へ出し、返信ボタン非表示でも件数が見えるようにする。
 * - `noteMenuRefs` は親がスクリプト側で組み立てた Ref バッグ。テンプレート経由だと
 *   Vue がアンラップし `getNoteMenu` の `.value` 代入が壊れるため、必ずオブジェクトで受け取る。
 *
 * @internal
 */
import { inject, ref } from "vue";
import type { Ref } from "vue";
import type * as misskey from "calckey-js";
import XRenoteButton from "@/components/MkRenoteButton.vue";
import XReactionsViewer from "@/components/MkReactionsViewer.vue";
import XUsersTooltip from "@/components/MkUsersTooltip.vue";
import XStarButtonNoEmoji from "@/components/MkStarButtonNoEmoji.vue";
import XQuoteButton from "@/components/MkQuoteButton.vue";
import { pleaseLogin } from "@/scripts/please-login";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { instance } from "@/instance";
import { reactionPicker } from "@/scripts/reaction-picker";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { getNoteMenu } from "@/scripts/get-note-menu";
import { useTooltip } from "@/scripts/use-tooltip";
import { useReactionCountViewModel } from "@/scripts/use-reaction-count-view-model";
import * as sound from "@/scripts/sound.js";
import { normalizeReactionName } from "@/scripts/reaction-utils";
import {
	hideToolbarNormalReply,
	showToolbarAirReplyForNote,
} from "@/scripts/stranger-air-reply-toolbar";
import { openReplyWithChoice } from "@/scripts/reply-note";

/**
 * getNoteMenu が直接更新する親ノート側の Ref 群。
 *
 * @remarks
 * NOTE: 個別 prop で Ref を渡すとテンプレート自動アンラップで値が届いてしまう。
 *
 * @internal
 */
type NoteMenuRefs = {
	info: Ref<any>;
	translation: Ref<any>;
	translating: Ref<boolean>;
	isDeleted: Ref<boolean>;
};

const props = defineProps<{
	/** 生のノート（developerRenote/developerQuote トグル表示用） */
	note: misskey.entities.Note;
	/** リノート展開済みの実体 */
	appearNote: misskey.entities.Note;
	pinned?: boolean;
	detailedView?: boolean;
	/** CW等が開いている（内容が見えている）状態か */
	showContent: boolean;
	/**
	 * getNoteMenu 用の Ref バッグ（親スクリプトで組み立てたもの）。
	 *
	 * @remarks
	 * NOTE: テンプレートで Ref を個別に渡さないこと（自動アンラップで壊れる）。
	 */
	noteMenuRefs: NoteMenuRefs;
	/** 返信/RT等の操作後にノート本体へフォーカスを戻すためのコールバック */
	focusNote: () => void;
	/** リアクションピッカー展開前に呼ぶブラーコールバック */
	blurNote: () => void;
}>();

const appearNote = $computed(() => props.appearNote);
const note = $computed(() => props.note);

const isDetailedView = $computed(() => props.detailedView ?? false);
const enableEmojiReactions = defaultStore.state.enableEmojiReactions;
const showEmojiButton = defaultStore.state.showEmojiButton;
const showContent = $computed(() => props.showContent);
const isReactionListVisible = $computed(
	() => (enableEmojiReactions || isDetailedView) && showContent
);

const isStarButtonHandlesDefault = $computed(() => {
	return defaultStore.state.favButtonReaction === "";
});
const favButtonReactionIsFavorite =
	defaultStore.state.favButtonReaction === "favorite";

const multiReaction = $computed(
	() =>
		$i &&
		$i.patron &&
		(!appearNote.user.host ||
			appearNote.user.instance?.maxReactionsPerAccount > 1)
);
const maxReactions = $computed(() =>
	multiReaction
		? Math.min(appearNote.user.instance?.maxReactionsPerAccount ?? 3, 3)
		: 1
);
const isCanAction = $computed(
	() => $i && (!$i.isSilenced || appearNote.user.isFollowed)
);
/** 警告ユーザは canWarnedViewerReact が明示 true のときのみリアクション可（自分のノートは常に可） */
const isCanReact = $computed(() => {
	if (!isCanAction) return false;
	if (!$i?.isModerationWarning) return true;
	if (appearNote.userId === $i.id) return true;
	return appearNote.canWarnedViewerReact === true;
});

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
	if (
		appearNote.myReaction &&
		normalizeReactionName(appearNote.myReaction) === instance.defaultReaction
	) {
		return true;
	}
	// multiユーザーは myReaction が先頭反応のみを示すため、myReactions側も必ず確認する
	if (appearNote.myReactions) {
		return appearNote.myReactions.some(
			(r) => normalizeReactionName(r) === instance.defaultReaction
		);
	}
	return false;
});

/**
 * ★ボタン（絵文字なし）の表示可否を返す。
 *
 * @remarks
 * - 通常はリアクション未到達かつ操作可能な場合に表示する。
 * - デフォルトリアクションを★ボタンで扱う設定時は、既に既定リアクション済みでも表示を維持する。
 *
 * @internal
 */
const showStarButtonNoEmoji = $computed(() => {
	const canShow =
		((!isMaxReacted && !isfavButtonReacted && isCanReact) ||
			favButtonReactionIsFavorite ||
			(isStarButtonHandlesDefault && isDefaultReactionReacted));
	return canShow && defaultStore.state.favButtonReaction !== "hidden";
});

/**
 * リアクションピッカーボタンの表示可否を返す。
 *
 * @remarks
 * - 非 multi の場合、既にリアクション済みなら取り消しボタンを優先するため非表示にする。
 * - multi の場合は上限到達時でもボタンを表示し、上限状態のアイコン表示に任せる。
 *
 * @internal
 */
const showReactionPickerButton = $computed(
	() =>
		(enableEmojiReactions || isDetailedView || showEmojiButton) &&
		isCanReact &&
		(multiReaction || !isMaxReacted)
);

/**
 * リアクション取り消しボタンの表示可否を返す。
 *
 * @remarks
 * 非 multi ユーザで既存リアクションがある場合のみ表示する。
 *
 * @internal
 */
const showUndoReactionButton = $computed(
	() =>
		(enableEmojiReactions || isDetailedView || showEmojiButton) &&
		appearNote.myReaction != null &&
		!multiReaction &&
		isCanReact
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

const developerRenote = defaultStore.state.developerRenote;
const developerQuote = defaultStore.state.developerQuote;
const referenceIds = $computed(
	defaultStore.makeGetterSetter("postFormReferenceIds")
);

const footerRootEl = ref<HTMLElement>();
const renoteButtonRef = ref<InstanceType<typeof XRenoteButton>>();
const starButtonNoEmojiRef = ref<HTMLElement>();
const reactionPickerButtonRef = ref<HTMLElement>();
const undoReactionButtonRef = ref<HTMLElement>();
const menuButtonRef = ref<HTMLElement>();

const currentClipPage = inject<Ref<misskey.entities.Clip> | null>(
	"currentClipPage",
	null
);

// ピッカーボタン用のtooltip
useTooltip(
	reactionPickerButtonRef,
	async (showing) => {
		const tooltipQuery = reactionCountViewModel.value.tooltipQuery;
		if (tooltipQuery.shouldSkip) {
			return;
		}

		const reactions = await os.api("notes/reactions", {
			noteId: appearNote.id,
			...(tooltipQuery.type ? { type: tooltipQuery.type } : {}),
			...(tooltipQuery.excludeType
				? { excludeType: tooltipQuery.excludeType }
				: {}),
			limit: 11,
		});

		const users = reactions.map((x) => x.user);
		if (users.length < 1) return;

		const count = tooltipQuery.count;

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
		const tooltipQuery = reactionCountViewModel.value.tooltipQuery;
		if (tooltipQuery.shouldSkip) {
			return;
		}

		const reactions = await os.api("notes/reactions", {
			noteId: appearNote.id,
			...(tooltipQuery.type ? { type: tooltipQuery.type } : {}),
			...(tooltipQuery.excludeType
				? { excludeType: tooltipQuery.excludeType }
				: {}),
			limit: 11,
		});

		const users = reactions.map((x) => x.user);
		if (users.length < 1) return;

		const count = tooltipQuery.count;

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

function reply(viaKeyboard = false, ev?: MouseEvent): void {
	pleaseLogin();
	openReplyWithChoice(appearNote, {
		viaKeyboard,
		animation: !viaKeyboard,
		src: ev?.currentTarget ?? (viaKeyboard ? footerRootEl.value : undefined),
		onOpened: props.focusNote,
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
		// 空リプのローカル限定は、元ノートがローカル限定のときだけ ON（ローカル相手の公開ノートでは既定に合わせる）
		initialLocalOnly: appearNote.localOnly === true,
		key: appearNote.id,
		animation: !viaKeyboard,
	}).then(() => {
		props.focusNote();
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
			noteId: appearNote.id,
			reaction: "",
		}).then(() => {
			sound.play("reaction");
		});
	} else {
		props.blurNote();
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
				props.focusNote();
			}
		);
	}
}

async function undoReact(targetNote): void {
	const oldReaction = targetNote.myReaction;
	if (!oldReaction) return;

	const confirm = await os.confirm({
		type: "warning",
		text: i18n.ts.cancelReactionConfirm,
	});
	if (confirm.canceled) return;

	os.api("notes/reactions/delete", {
		noteId: targetNote.id,
		reaction: oldReaction,
	});
}

/**
 * ノートメニュー（⋯）を開く。
 *
 * @param viaKeyboard - キーボード操作由来のとき true（フォーカス移動用）
 * @returns void
 * @remarks
 * NOTE: `noteMenuRefs` の各 Ref をそのまま getNoteMenu に渡す。
 * アンラップ済みの値を渡すとソース表示等で TypeError になる。
 */
function menu(viaKeyboard = false): void {
	// NOTE: 分割代入せずプロパティ参照のまま渡す（Reactive 経由のアンラップを避ける）
	const refs = props.noteMenuRefs;
	os.popupMenu(
		getNoteMenu({
			note: note,
			translating: refs.translating,
			translation: refs.translation,
			menuButton: menuButtonRef,
			isDeleted: refs.isDeleted,
			currentClipPage,
			info: refs.info,
			pinned: props.pinned,
		}),
		menuButtonRef.value,
		{
			viaKeyboard,
		}
	).then(props.focusNote);
}

/**
 * 右クリックメニュー（本体側の @contextmenu ハンドラから呼ばれる）。
 *
 * @param ev - コンテキストメニューイベント
 * @returns void
 */
function openContextMenu(ev: MouseEvent): void {
	const refs = props.noteMenuRefs;
	os.contextMenu(
		getNoteMenu({
			note: note,
			translating: refs.translating,
			translation: refs.translation,
			menuButton: menuButtonRef,
			isDeleted: refs.isDeleted,
			currentClipPage,
			info: refs.info,
			pinned: props.pinned,
		}),
		ev
	).then(props.focusNote);
}

function toggleReference() {
	if (referenceIds?.includes(appearNote.id)) {
		referenceIds = referenceIds.filter((x) => x !== appearNote.id);
	} else {
		referenceIds = Array.from(new Set([...referenceIds, appearNote.id]));
	}
}

defineExpose({
	reply,
	react,
	renote: (viaKeyboard = false) => renoteButtonRef.value?.renote(viaKeyboard),
	menu,
	openContextMenu,
	focus: () => footerRootEl.value?.focus(),
});
</script>

<style lang="scss" scoped>
// NOTE: margin-top（メインタイムライン用の余白）は呼び出し元（MkNote.vue）が
// :deep(.footer) で個別に上乗せする。会話ツリー（MkNoteSub.vue）はこの余白を持たない、
// という元々の見た目の違いをそのまま維持するため、ここでは持たせない。
.footer {
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

		&.referenced {
			color: var(--accent);
		}

		// NOTE: 元々 MkNote.vue では `.footer > .unsupported`（.buttonの兄弟要素）、
		// MkNoteSub.vue では `.footer > .button > .unsupported`（.buttonの子要素）として
		// 定義されていたが、実際には :class="{ unsupported }" は .button と同じ要素に
		// 合成されるため、どちらの元セレクタも一致せず opacity 低下が効いていなかった。
		// 単一化に伴い、実際に一致する &.unsupported に修正する。
		&.unsupported {
			opacity: 0.15 !important;
		}
	}
}
</style>
