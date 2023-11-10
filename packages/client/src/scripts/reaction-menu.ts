import { defaultStore } from "@/store";
import { host } from "@/config";
import * as os from "@/os";
import { i18n } from "@/i18n";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import MkRippleEffect from '@/components/MkRipple.vue';

const createReaction = ({ noteId, reaction }: { noteId: string, reaction: string }): Promise<null> => {
	return os.api('notes/reactions/create', { noteId, reaction });
};

const deleteReaction = ({ noteId, reaction }: { noteId: string, reaction: string }): Promise<null> => {
	return os.api('notes/reactions/delete', { noteId, reaction });
};

const rippleEffect = (el: HTMLElement | null | undefined): void => {
	if (!el) return;
	const rect = el.getBoundingClientRect();
	const x = rect.left + (el.offsetWidth / 2);
	const y = rect.top + (el.offsetHeight / 2);
	os.popup(MkRippleEffect, { x, y }, {}, 'end');
};

export function openReactionMenu_(reaction, note, canToggle, multi, reactButton) {
	const emojiName = reaction.split("@")?.[0]?.replaceAll(":", "");
	let emojiHost = reaction.split("@")?.[1]?.replaceAll(":", "");
	const noteId = note.id;
	const menu: any[] = [];

	if (emojiName){
		menu.push(
			{
				text: emojiName,
				type: "label",
			}
		);
	}
	if (emojiHost && host !== emojiHost){
		menu.push(
			{
				text: `@${emojiHost}`,
				type: "label",
			}
		);
	} else {
		emojiHost = undefined;
	}

	const reacted = multi
		? note.myReactions?.some((x) => x?.replace(/@[\w:\.\-]+:$/,"@") === reaction?.replace(/@[\w:\.\-]+:$/,"@"))
		: note.myReaction && note.myReaction?.replace(/@[\w:\.\-]+:$/,"@") === reaction?.replace(/@[\w:\.\-]+:$/,"@");

	if (!canToggle) {
		if (multi){
			if (reacted) {
				menu.push({
					text: i18n.ts.doUnreact,
					icon: 'ph-minus ph-bold ph-lg',
					action: (): void => {
						rippleEffect(reactButton);

						deleteReaction({ noteId, reaction });
					},
				});
			} else {
				menu.push({
					text: i18n.ts.doReact,
					icon: 'ph-plus ph-bold ph-lg',
					action: (): void => {
						rippleEffect(reactButton);

						createReaction({ noteId, reaction });
					}
				});
			}
		} else {
			if (note.myReaction && reacted) {
				menu.push({
					text: i18n.ts.doUnreact,
					icon: 'ph-minus ph-bold ph-lg',
					action: (): void => {
						rippleEffect(reactButton);

						deleteReaction({ noteId, reaction });
					},
				});
			} else if (!note.myReaction) {
				menu.push({
					text: i18n.ts.doReact,
					icon: 'ph-plus ph-bold ph-lg',
					action: (): void => {
						rippleEffect(reactButton);

						createReaction({ noteId, reaction });
					}
				});
			}
		}
	}

	menu.push({
		text: i18n.ts.copy,
		icon: 'ph-copy ph-bold ph-lg',
		action: (): void => {
			copyToClipboard(reaction);
			os.success();
		},
	});

	if (((defaultStore.state.reactions2?.length ?? 0) + (defaultStore.state.reactions3?.length ?? 0) + (defaultStore.state.reactions4?.length ?? 0) + (defaultStore.state.reactions5?.length ?? 0)) === 0) {
		menu.push({
			text: i18n.ts.plusPinnedEmoji,
			icon: "ph-list-plus ph-bold ph-lg",
			action: () => {
				defaultStore.state.reactions = [...defaultStore.state.reactions,reaction];
				os.success();
			},
		});
	} else {
		menu.push({
			type: "parent",
			text: i18n.ts.plusPinnedEmoji,
			icon: "ph-list-plus ph-bold ph-lg",
			children: [
				{
					text: `${defaultStore.state.reactionsFolderName || "1ページ目"}に追加`,
					action: () => {
					  defaultStore.state.reactions = [...defaultStore.state.reactions,reaction];
						os.success();
					},
				},
				{
					text: `${defaultStore.state.reactionsFolderName2 || "2ページ目"}に追加`,
					action: () => {
					  defaultStore.state.reactions2 = [...defaultStore.state.reactions2,reaction];
						os.success();
					},
				},
				{
					text: `${defaultStore.state.reactionsFolderName3 || "3ページ目"}に追加`,
					action: () => {
					  defaultStore.state.reactions3 = [...defaultStore.state.reactions3,reaction];
						os.success();
					},
				},
				{
					text: `${defaultStore.state.reactionsFolderName4 || "4ページ目"}に追加`,
					action: () => {
					  defaultStore.state.reactions4 = [...defaultStore.state.reactions4,reaction];
						os.success();
					},
				},
				{
					text: `${defaultStore.state.reactionsFolderName5 || "5ページ目"}に追加`,
					action: () => {
					  defaultStore.state.reactions5 = [...defaultStore.state.reactions5,reaction];
						os.success();
					},
				},
			],
		});
	}

	os.popupMenu(menu, reactButton);
}
