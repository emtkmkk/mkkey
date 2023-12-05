import { defaultStore } from "@/store";
import { instance } from "@/instance";
import { host } from "@/config";
import * as os from "@/os";
import XTutorial from "../components/MkTutorialDialog.vue";
import { $i } from "@/account";
import { i18n } from "@/i18n";

export function openHelpMenu_(ev: MouseEvent) {
	// 招待可能条件
	// 登録から(7日-((投稿数-20)*1.5時間))経過
	// ただし1日未満にはならない
	// 投稿数が20以上
	const eTime = $i ? (Date.now() - new Date($i.createdAt).valueOf()) : undefined;
	const inviteBorder = eTime ? eTime > 7 * 24 * 60 * 60 * 1000 ? 7 * 24 * 60 * 60 * 1000 : Math.max(7 * 24 * 60 * 60 * 1000 - ($i.notesCount * 90 * 60 * 1000), 24 * 60 * 60 * 1000) : undefined;
	const canInvite = $i ? eTime > inviteBorder && $i.notesCount >= 20 : false;

	os.popupMenu(
		[
			{
				text: instance.name ?? host,
				type: "label",
			},
			{
				type: "link",
				text: i18n.ts.instanceInfo,
				icon: "ph-info ph-bold ph-lg",
				to: "/about",
			},
			{
				type: "link",
				text: i18n.ts.aboutMisskey,
				icon: "ph-lightbulb ph-bold ph-lg",
				to: "/about-calckey",
			},
			$i && !$i.isSilenced && canInvite ? {
				type: "button",
				action: async () => {
					os.api("admin/invite")
						.then((x) => {
							os.alert({
								type: "info",
								text: `${x.code}\n\n※有効期限 : 24時間\n期限内なら何回でも使用できます。`,
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
			} : $i && !$i.isSilenced && $i.notesCount >= 20 ? {
				text: "招待可能まで後" + (Math.ceil((inviteBorder - eTime) / (6 * 60 * 1000)) / 10) + "時間",
				type: "label",
			} : undefined,
			{
				type: "button",
				text: i18n.ts._apps.apps,
				icon: "ph-device-mobile ph-bold ph-lg",
				action: () => {
					window.open("https://calckey.org/apps", "_blank");
				},
			},
			{
				type: "button",
				action: async () => {
					defaultStore.set("tutorial", 0);
					os.popup(XTutorial, {}, {}, "closed");
				},
				text: i18n.ts.replayTutorial,
				icon: "ph-circle-wavy-question ph-bold ph-lg",
			},
			null,
			{
				type: "parent",
				text: i18n.ts.developer,
				icon: "ph-code ph-bold ph-lg",
				children: [
					{
						type: "link",
						to: "/api-console",
						text: "API Console",
						icon: "ph-terminal-window ph-bold ph-lg",
					},
					{
						text: i18n.ts.document,
						icon: "ph-file-doc ph-bold ph-lg",
						action: () => {
							window.open("/api-doc", "_blank");
						},
					},
					{
						type: "link",
						to: "/scratchpad",
						text: "AiScript Scratchpad",
						icon: "ph-scribble-loop ph-bold ph-lg",
					},
				],
			},
		].filter(x => x !== undefined),
		ev.currentTarget ?? ev.target,
	);
}
