/**
 * @packageDocumentation
 *
 * 通常返信時のメンション自動挿入範囲（著者のみ／全員）の判定と、
 * 返信ボタン・ノートメニューから投稿フォームを開く処理を集約する。
 *
 * @public
 */
import type * as misskey from "calckey-js";
import { $i } from "@/account";
import { host } from "@/config";
import { i18n } from "@/i18n";
import * as os from "@/os";
import type { MenuItem } from "@/types/menu";
import { pleaseLogin } from "@/scripts/please-login";
import {
	noteWouldCopyExtraReplyMentions,
	type ReplyMentionNote,
} from "@/scripts/reply-note-mentions";

export type { ReplyMentionNote, ReplyMentionViewer } from "@/scripts/reply-note-mentions";

/**
 * 返信時に「返信／全員に返信」の選択 UI を出すべきか。
 *
 * @param note - 返信先ノート
 * @returns 選択 UI を出すなら true
 *
 * @public
 */
export function noteHasReplyAllMentions(note: ReplyMentionNote): boolean {
	if (!$i) return false;
	return noteWouldCopyExtraReplyMentions(
		note,
		{ username: $i.username, host: $i.host },
		host,
	);
}

/**
 * 返信投稿フォームを開く。
 *
 * @param note - 返信先ノート
 * @param options - メンション範囲とアニメーション
 * @returns フォームが閉じたときに解決する Promise
 *
 * @public
 */
export function openReplyPost(
	note: misskey.entities.Note,
	options: {
		replyAllMentions: boolean;
		animation?: boolean;
	},
): Promise<void> {
	pleaseLogin();
	return os.post({
		reply: note,
		replyAllMentions: options.replyAllMentions,
		animation: options.animation,
	}) as Promise<void>;
}

/**
 * 「返信」「全員に返信」のポップアップメニュー項目を返す。
 *
 * @param note - 返信先ノート
 * @param options - コールバック等
 * @returns メニュー項目配列
 *
 * @public
 */
export function getReplyChoiceMenuItems(
	note: misskey.entities.Note,
	options?: {
		animation?: boolean;
		onOpened?: () => void;
	},
): MenuItem[] {
	return [
		{
			icon: "ph-arrow-u-up-left ph-bold ph-lg",
			text: i18n.ts.reply,
			action: () => {
				void openReplyPost(note, {
					replyAllMentions: false,
					animation: options?.animation,
				}).then(() => options?.onOpened?.());
			},
		},
		{
			icon: "ph-users ph-bold ph-lg",
			text: i18n.ts.replyAll,
			action: () => {
				void openReplyPost(note, {
					replyAllMentions: true,
					animation: options?.animation,
				}).then(() => options?.onOpened?.());
			},
		},
	];
}

/**
 * ノートコンテキストメニュー用の返信項目（単一またはサブメニュー）を返す。
 *
 * @param note - 返信先ノート
 * @param options - コールバック等
 * @returns メニュー項目
 *
 * @public
 */
export function getNoteMenuReplyItem(
	note: misskey.entities.Note,
	options?: {
		onOpened?: () => void;
	},
): MenuItem {
	if (!noteHasReplyAllMentions(note)) {
		return {
			icon: "ph-arrow-u-up-left ph-bold ph-lg",
			text: i18n.ts.reply,
			action: () => {
				void openReplyPost(note, { replyAllMentions: true }).then(() =>
					options?.onOpened?.(),
				);
			},
		};
	}

	return {
		type: "parent" as const,
		icon: "ph-arrow-u-up-left ph-bold ph-lg",
		text: i18n.ts.reply,
		children: getReplyChoiceMenuItems(note, { onOpened: options?.onOpened }),
	};
}

/**
 * 返信ボタン押下時の共通処理。追加メンションがなければ即開き、あれば選択メニューを表示する。
 *
 * @param note - 返信先ノート
 * @param options - イベントソース・キーボード操作等
 *
 * @public
 */
export function openReplyWithChoice(
	note: misskey.entities.Note,
	options: {
		viaKeyboard?: boolean;
		animation?: boolean;
		src?: HTMLElement | EventTarget | null;
		onOpened?: () => void;
	} = {},
): void {
	if (!noteHasReplyAllMentions(note)) {
		void openReplyPost(note, {
			replyAllMentions: true,
			animation: options.animation,
		}).then(() => options.onOpened?.());
		return;
	}

	const src =
		options.src instanceof HTMLElement
			? options.src
			: (options.src as MouseEvent | undefined)?.currentTarget instanceof
					HTMLElement
				? ((options.src as MouseEvent).currentTarget as HTMLElement)
				: undefined;

	os.popupMenu(
		getReplyChoiceMenuItems(note, {
			animation: options.animation,
			onOpened: options.onOpened,
		}),
		src,
		{ viaKeyboard: options.viaKeyboard },
	);
}
