/**
 * @packageDocumentation
 *
 * ノート等のリアクション（絵文字）を右クリックしたときのポップアップメニューを組み立てる。
 * コピー・ピン留め・カスタム絵文字詳細、およびソフト絵文字ミュート（canonical 行の追加／完全一致削除）を扱う。
 *
 * @remarks
 * NOTE: ソフトミュートの解除は {@link getMenuReactionMuteLine} が返す文字列と `===` 一致する行だけを削除する（手動の別行は触らない）。
 * NOTE: 「絵文字ミュート解除」はその canonical が `reactionMutedWords` に存在するときのみ表示する。
 * NOTE: 末尾の区切り線とミュート項目は `showQuickEmojiMuteInReactionMenu` が ON のときのみ表示する（既定 OFF）。
 *
 * @public
 */

import { defaultStore } from "@/store";
import { host } from "@/config";
import * as os from "@/os";
import { i18n } from "@/i18n";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import MkRippleEffect from "@/components/MkRipple.vue";
import { instance } from "@/instance";
import { $i } from "@/account";
import MkCustomEmojiDetailedDialog from "@/components/MkCustomEmojiDetailedDialog.vue";
import * as sound from "@/scripts/sound.js";
import { requestEmojiImportFlow } from "@/scripts/request-emoji-import";

/**
 * リアクションメニューからソフト絵文字ミュートに追加／削除するときの 1 行（`reactionMutedWords` の要素）。
 * ミュート登録と解除で同一の戻り値を使い、解除時はこの文字列と完全一致する行のみを削除する。
 *
 * @param reaction API 上のリアクションキー（Unicode または `:name@host:`）
 * @param emojiName 先頭のコロン・ホストを除いた名前部分（Unicode では実質リアクション文字列）
 * @param isCustom カスタム絵文字（`:…:` 形式）なら true
 * @returns 設定の「絵文字ミュート（ソフト）」にそのまま載せる 1 行
 *
 * @remarks
 * NOTE: カスタムで名前が `\\w+` のときは `:name:`（設定画面の完全一致寄りの説明に合わせる）。それ以外のカスタム名は部分一致用に名前のみ。Unicode は `reaction` をそのまま使う。
 *
 * @internal
 */
function getMenuReactionMuteLine(
	reaction: string,
	emojiName: string,
	isCustom: boolean,
): string {
	if (isCustom) {
		if (/^\w+$/.test(emojiName)) {
			return `:${emojiName}:`;
		}
		return emojiName;
	}
	return reaction;
}

const createReaction = ({
	noteId,
	reaction,
}: { noteId: string; reaction: string }): Promise<null> => {
	return os.api("notes/reactions/create", { noteId, reaction });
};

const deleteReaction = ({
	noteId,
	reaction,
}: { noteId: string; reaction: string }): Promise<null> => {
	return os.api("notes/reactions/delete", { noteId, reaction });
};

const rippleEffect = (el: HTMLElement | null | undefined): void => {
	if (!el) return;
	const rect = el.getBoundingClientRect();
	const x = rect.left + el.offsetWidth / 2;
	const y = rect.top + el.offsetHeight / 2;
	os.popup(MkRippleEffect, { x, y }, {}, "end");
};

/**
 * リアクション（絵文字）のコンテキストメニューを開く。
 *
 * @param reaction 対象のリアクションキー
 * @param note 添付ノート（無い場合はリアクション操作のみ省略）
 * @param canToggle リアクションの付け外しを許可するか
 * @param multi 複数リアクション対応ノートか
 * @param reactButton メニューのアンカーとなるボタン要素
 *
 * @public
 */
export async function openReactionMenu_(
	reaction,
	note,
	canToggle,
	multi,
	reactButton,
) {
	const emojiName = reaction.split("@")?.[0]?.replaceAll(":", "");
	let emojiHost = reaction.split("@")?.[1]?.replaceAll(":", "");
	const isCustom = reaction.startsWith(":");
	const menu: any[] = [];

	if (emojiName) {
		menu.push({
			text: emojiName,
			type: "label",
		});
	}
	if (emojiHost && host !== emojiHost && emojiHost !== ".") {
		menu.push({
			text: `@${emojiHost}`,
			type: "label",
		});
	} else {
		emojiHost = undefined;
	}

	if (note) {
		const noteId = note.id;

		const reacted = multi
			? note.myReactions?.some(
					(x) =>
						x?.replace(/@[\w:\.\-]+:$/, "@") ===
						(isCustom
							? `:${emojiName}@${emojiHost || "."}:`
							: reaction
						)?.replace(/@[\w:\.\-]+:$/, "@"),
			  )
			: note.myReaction &&
			  note.myReaction?.replace(/@[\w:\.\-]+:$/, "@") ===
					(isCustom ? `:${emojiName}@${emojiHost || "."}:` : reaction)?.replace(
						/@[\w:\.\-]+:$/,
						"@",
					);

		if (canToggle) {
			if (multi) {
				if (reacted) {
					menu.push({
						text: i18n.ts.doUnreact,
						icon: "ph-minus ph-bold ph-lg",
						action: (): void => {
							rippleEffect(reactButton);

							deleteReaction({ noteId, reaction });
						},
					});
				} else {
					menu.push({
						text: i18n.ts.doReact,
						icon: "ph-plus ph-bold ph-lg",
						action: (): void => {
							rippleEffect(reactButton);

							createReaction({ noteId, reaction }).then(() => {
								sound.play("reaction");
							});
						},
					});
				}
			} else {
				if (note.myReaction && reacted) {
					menu.push({
						text: i18n.ts.doUnreact,
						icon: "ph-minus ph-bold ph-lg",
						action: (): void => {
							rippleEffect(reactButton);

							deleteReaction({ noteId, reaction });
						},
					});
				} else if (!note.myReaction) {
					menu.push({
						text: i18n.ts.doReact,
						icon: "ph-plus ph-bold ph-lg",
						action: (): void => {
							rippleEffect(reactButton);

							createReaction({ noteId, reaction }).then(() => {
								sound.play("reaction");
							});
						},
					});
				}
			}
		}
	}
	menu.push({
		text: i18n.ts.copy,
		icon: "ph-copy ph-bold ph-lg",
		action: (): void => {
			copyToClipboard(reaction);
			os.success();
		},
	});

	if ($i != null && ($i.isAdmin || $i.isModerator) && emojiName && emojiHost) {
		const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
		if (!instanceEmoji?.includes(emojiName)) {
			menu.push({
				text: i18n.ts.import,
				icon: "ph-plus ph-bold ph-lg",
				action: (): void => {
					os.apiWithDialog("admin/emoji/copy", {
						emojiName,
						emojiHost,
					});
				},
			});
		}
	}

	// 一般ユーザー向け: リモート絵文字のインポート申請
	if (
		$i != null &&
		!$i.isAdmin &&
		!$i.isModerator &&
		emojiName &&
		emojiHost
	) {
		menu.push({
			text: i18n.ts.requestEmojiImport ?? "インポート申請",
			icon: "ph-smiley-sticker ph-bold ph-lg",
			action: (): Promise<void> =>
				requestEmojiImportFlow(emojiName, emojiHost),
		});
	}

	if ($i != null && !defaultStore.state.hiddenReactionDeckAndRecent) {
		if (
			(defaultStore.state.reactions2?.length ?? 0) +
				(defaultStore.state.reactions3?.length ?? 0) +
				(defaultStore.state.reactions4?.length ?? 0) +
				(defaultStore.state.reactions5?.length ?? 0) ===
			0
		) {
			if (
				!defaultStore.state.reactions.includes(reaction) &&
				!defaultStore.state.reactions.includes(`:${emojiName}:`)
			) {
				menu.push({
					text: i18n.ts.plusPinnedEmoji,
					icon: "ph-list-plus ph-bold ph-lg",
					action: () => {
						const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
						if (emojiHost && instanceEmoji?.includes(emojiName)) {
							defaultStore.set("reactions", [
								...defaultStore.state.reactions,
								`:${emojiName}:`,
							]);
							os.success();
						} else {
							defaultStore.set("reactions", [
								...defaultStore.state.reactions,
								reaction,
							]);
							os.success();
						}
					},
				});
			}
		} else {
			const childMenu: any[] = [];
			if (
				!defaultStore.state.reactions.includes(reaction) &&
				!defaultStore.state.reactions.includes(`:${emojiName}:`)
			) {
				childMenu.push({
					text: `${
						defaultStore.state.reactionsFolderName || "1ページ目"
					}に追加`,
					action: () => {
						const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
						if (emojiHost && instanceEmoji?.includes(emojiName)) {
							defaultStore.set("reactions", [
								...defaultStore.state.reactions,
								`:${emojiName}:`,
							]);
							os.success();
						} else {
							defaultStore.set("reactions", [
								...defaultStore.state.reactions,
								reaction,
							]);
							os.success();
						}
					},
				});
			}
			if (
				!defaultStore.state.reactions2.includes(reaction) &&
				!defaultStore.state.reactions2.includes(`:${emojiName}:`)
			) {
				childMenu.push({
					text: `${
						defaultStore.state.reactionsFolderName2 || "2ページ目"
					}に追加`,
					action: () => {
						const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
						if (emojiHost && instanceEmoji?.includes(emojiName)) {
							defaultStore.set("reactions2", [
								...defaultStore.state.reactions2,
								`:${emojiName}:`,
							]);
							os.success();
						} else {
							defaultStore.set("reactions2", [
								...defaultStore.state.reactions2,
								reaction,
							]);
							os.success();
						}
					},
				});
			}
			if (
				!defaultStore.state.reactions3.includes(reaction) &&
				!defaultStore.state.reactions3.includes(`:${emojiName}:`)
			) {
				childMenu.push({
					text: `${
						defaultStore.state.reactionsFolderName3 || "3ページ目"
					}に追加`,
					action: () => {
						const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
						if (emojiHost && instanceEmoji?.includes(emojiName)) {
							defaultStore.set("reactions3", [
								...defaultStore.state.reactions3,
								`:${emojiName}:`,
							]);
							os.success();
						} else {
							defaultStore.set("reactions3", [
								...defaultStore.state.reactions3,
								reaction,
							]);
							os.success();
						}
					},
				});
			}
			if (
				!defaultStore.state.reactions4.includes(reaction) &&
				!defaultStore.state.reactions4.includes(`:${emojiName}:`)
			) {
				childMenu.push({
					text: `${
						defaultStore.state.reactionsFolderName4 || "4ページ目"
					}に追加`,
					action: () => {
						const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
						if (emojiHost && instanceEmoji?.includes(emojiName)) {
							defaultStore.set("reactions4", [
								...defaultStore.state.reactions4,
								`:${emojiName}:`,
							]);
							os.success();
						} else {
							defaultStore.set("reactions4", [
								...defaultStore.state.reactions4,
								reaction,
							]);
							os.success();
						}
					},
				});
			}
			if (
				!defaultStore.state.reactions5.includes(reaction) &&
				!defaultStore.state.reactions5.includes(`:${emojiName}:`)
			) {
				childMenu.push({
					text: `${
						defaultStore.state.reactionsFolderName5 || "5ページ目"
					}に追加`,
					action: () => {
						const instanceEmoji = instance.emojis.map((x) => `${x.name}`);
						if (emojiHost && instanceEmoji?.includes(emojiName)) {
							defaultStore.set("reactions5", [
								...defaultStore.state.reactions5,
								`:${emojiName}:`,
							]);
							os.success();
						} else {
							defaultStore.set("reactions5", [
								...defaultStore.state.reactions5,
								reaction,
							]);
							os.success();
						}
					},
				});
			}

			if (childMenu.length > 0) {
				menu.push({
					type: "parent",
					text: i18n.ts.plusPinnedEmoji,
					icon: "ph-list-plus ph-bold ph-lg",
					children: childMenu,
				});
			}
		}
	}

	if (isCustom) {
		menu.push({
			text: i18n.ts.info,
			icon: "ph-info ph-bold ph-lg",
			action: () => {
				os.apiGet("emoji", {
					name: emojiName,
					...(emojiHost ? { host: emojiHost } : {}),
				}).then((res) => {
					os.popup(
						MkCustomEmojiDetailedDialog,
						{
							emoji: res,
						},
						{
							anchor: reactButton,
						},
						"closed",
					);
				});
			},
		});
	}

	// #region リアクションメニュー末尾のソフト絵文字ミュート
	// 設定 ON 時のみ区切り線と「絵文字ミュート / 解除」を表示する。
	if (
		$i != null &&
		emojiName &&
		defaultStore.state.showQuickEmojiMuteInReactionMenu
	) {
		const canonical = getMenuReactionMuteLine(reaction, emojiName, isCustom);
		const hasCanonical = defaultStore.state.reactionMutedWords.some(
			(w) => w === canonical,
		);

		menu.push(null);

		if (hasCanonical) {
			menu.push({
				text: i18n.ts.unmuteEmojiReaction,
				icon: "ph-speaker-high ph-bold ph-lg",
				action: (): void => {
					void (async () => {
						const { canceled } = await os.confirm({
							type: "question",
							text: i18n.t("unmuteEmojiReactionConfirm", {
								name: emojiName,
							}),
						});
						if (canceled) return;

						const cur = defaultStore.state.reactionMutedWords;
						const next = cur.filter((w) => w !== canonical);
						defaultStore.set("reactionMutedWords", next);
						os.success();
					})();
				},
			});
		} else {
			menu.push({
				text: i18n.ts.muteEmojiReaction,
				icon: "ph-speaker-slash ph-bold ph-lg",
				action: (): void => {
					void (async () => {
						const { canceled } = await os.confirm({
							type: "question",
							text: i18n.t("muteEmojiReactionConfirm", {
								name: emojiName,
							}),
						});
						if (canceled) return;

						const prev = defaultStore.state.reactionMutedWords;
						if (prev.some((w) => w === canonical)) return;

						defaultStore.set("reactionMutedWords", [...prev, canonical]);
						os.success();
					})();
				},
			});
		}
	}
	// #endregion

	os.popupMenu(menu, reactButton);
}
