/**
 * @packageDocumentation
 *
 * ヘルプメニューの項目と、各項目から実行する操作を定義する。
 *
 * @remarks
 * チュートリアルの再表示など、端末内の状態を変更する操作もここで扱う。
 *
 * @internal
 */
import { defaultStore } from "@/store";
import { instance } from "@/instance";
import { host } from "@/config";
import * as os from "@/os";
import XTutorial from "../components/MkTutorialDialog.vue";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { resetPwaInstallPromptSuppression } from "@/scripts/pwa-install-prompt";
import {
	MenuButton,
	MenuItem,
	MenuLabel,
	MenuLink,
	MenuParent,
} from "@/types/menu";

/**
 * 操作元の要素に紐づけてヘルプメニューを開く。
 *
 * @remarks
 * アカウントの状態に応じて、招待コードなど表示可能な項目を切り替える。
 *
 * @param ev - ヘルプメニューを開いたマウスイベント
 * @returns メニューを表示した時点で処理を終える
 *
 * @public
 */
export function openHelpMenu_(ev: MouseEvent) {
	// 招待可能条件
	// 登録から(7日-((投稿数-20)*1.5時間))経過
	// ただし1日未満にはならない
	// 投稿数が20以上
	const eTime = $i ? Date.now() - new Date($i.createdAt).valueOf() : undefined;
	const inviteBorder = eTime
		? eTime > 7 * 24 * 60 * 60 * 1000
			? 7 * 24 * 60 * 60 * 1000
			: Math.max(
					7 * 24 * 60 * 60 * 1000 - $i.notesCount * 90 * 60 * 1000,
					24 * 60 * 60 * 1000,
			  )
		: undefined;
	const canInvite = $i ? eTime > inviteBorder && $i.notesCount >= 20 : false;

	os.popupMenu(
		[
			{
				text: instance.name ?? host,
				type: "label",
			} as MenuLabel,
			{
				type: "link",
				text: i18n.ts.instanceInfo,
				icon: "ph-info ph-bold ph-lg",
				to: "/about",
			} as MenuLink,
			{
				type: "link",
				text: i18n.ts.aboutMisskey,
				icon: "ph-lightbulb ph-bold ph-lg",
				to: "/about-cluckey",
			} as MenuLink,
			$i && !$i.isSilenced && $i.canInvite && $i.canInvite
				? ({
						type: "button",
						action: async () => {
							os.api("admin/invite")
								.then((x) => {
									os.alert({
										type: "info",
										text: `${x.code}\n\n${i18n.ts.inviteCodeExpiryNote}`,
									});
								})
								.catch((err) => {
									os.alert({
										type: "error",
										text: err,
									});
								});
						},
						text: i18n.ts.showInviteCode,
						icon: "ph-user-plus ph-bold ph-lg",
				  } as MenuButton)
				: $i && !$i.isSilenced && $i.canInvite && $i.notesCount >= 20
				? ({
						type: "label",
						text: i18n.t("inviteAvailableInHours", {
							hours: String(Math.ceil((inviteBorder - eTime) / (6 * 60 * 1000)) / 10),
						}),
				  } as MenuLabel)
				: undefined,
			{
				type: "button",
				text: i18n.ts.mkkeyOfuse,
				icon: "ph-piggy-bank ph-bold ph-lg",
				action: () => {
					window.open("https://ofuse.me/mkkey", "_blank");
				},
			} as MenuButton,
			{
				type: "button",
				action: async () => {
					const { canceled } = await os.yesno({
						type: "question",
						text: i18n.ts.replayTutorialConfirm,
					});
					if (canceled) return;

					resetPwaInstallPromptSuppression();
					defaultStore.set("tutorial", 0);
					defaultStore.set("showLocalPostsInfoPopup", false);
					defaultStore.set("showInviteInfoPopupAccount", false);
					defaultStore.set("showInviteInfoPopupDevice", false);
					defaultStore.set("showMultiReactionInfoPopup", false);

					os.popup(XTutorial, {}, {}, "closed");
				},
				text: i18n.ts.replayTutorial,
				icon: "ph-circle-wavy-question ph-bold ph-lg",
			} as MenuButton,
			null,
			{
				type: "parent",
				text: i18n.ts.developer,
				icon: "ph-code ph-bold ph-lg",
				children: [
					{
						type: "link",
						to: "/api-console",
						text: i18n.ts.apiConsole,
						icon: "ph-terminal-window ph-bold ph-lg",
					} as MenuLink,
					{
						text: i18n.ts.document,
						icon: "ph-file-doc ph-bold ph-lg",
						action: () => {
							window.open("/api-doc", "_blank");
						},
					} as MenuItem,
					{
						type: "link",
						to: "/scratchpad",
						text: i18n.ts.aiScriptScratchpad,
						icon: "ph-scribble-loop ph-bold ph-lg",
					} as MenuLink,
				],
			} as MenuParent,
		].filter((x) => x !== undefined),
		ev.currentTarget ?? ev.target,
	);
}
