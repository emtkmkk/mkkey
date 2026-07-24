/**
 * @packageDocumentation
 *
 * ユーザー操作メニューと、範囲付きミュート設定フォームを組み立てる。
 *
 * @remarks
 * NOTE: 「チャットを開始」「グループに招待」は
 * `defaultStore.state.showUserMenuMessagingAndGroup` が ON のときだけ表示する
 * （対応サーバが少なく利用も少ないため、デフォルトは非表示）。
 * NOTE: ブロック時の all ミュート付与はサーバー側。解除時のみクライアントから mute/delete する。
 *
 * @internal
 */
import * as Acct from "calckey-js/built/acct";
import { defineAsyncComponent } from "vue";
import { i18n } from "@/i18n";
import copyToClipboard from "@/scripts/copy-to-clipboard";
import { host } from "@/config";
import * as os from "@/os";
import { userActions } from "@/store";
import { $i, iAmModerator } from "@/account";
import { mainRouter } from "@/router";
import { Router } from "@/nirax";
import * as config from "@/config";
import { defaultStore } from "@/store";
import { acct } from "@/filters/user";
import { configureUserMute } from "@/scripts/mute-scope";

export function getUserMenu(user, router: Router = mainRouter) {
	const meId = $i ? $i.id : null;

	async function pushList() {
		const t = i18n.ts.selectList; // なぜか後で参照すると null になるので最初にメモリに確保しておく
		const lists = await os.api("users/lists/list");
		if (lists.length === 0) {
			os.alert({
				type: "error",
				text: i18n.ts.youHaveNoLists,
			});
			return;
		}
		const { canceled, result: listId } = await os.select({
			title: t,
			items: lists.map((list) => ({
				value: list.id,
				text: list.name,
			})),
		});
		if (canceled) return;
		os.apiWithDialog("users/lists/push", {
			listId: listId,
			userId: user.id,
		});
	}

	async function inviteGroup() {
		const groups = await os.api("users/groups/owned");
		if (groups.length === 0) {
			os.alert({
				type: "error",
				text: i18n.ts.youHaveNoGroups,
			});
			return;
		}
		const { canceled, result: groupId } = await os.select({
			title: i18n.ts.group,
			items: groups.map((group) => ({
				value: group.id,
				text: group.name,
			})),
		});
		if (canceled) return;
		os.apiWithDialog("users/groups/invite", {
			groupId: groupId,
			userId: user.id,
		});
	}

	async function configureMute(): Promise<void> {
		const updated = await configureUserMute(user);
		if (updated != null) Object.assign(user, updated);
	}

	async function addHiddenIconUserIds(): Promise<void> {
		let hiddenIconUserIds = defaultStore.state.hiddenIconUserIds;
		hiddenIconUserIds.push(user.id);
		defaultStore.set("hiddenIconUserIds", hiddenIconUserIds);
		let hiddenIconUserAccts = defaultStore.state.hiddenIconUserAccts;
		hiddenIconUserAccts.push(acct(user));
		defaultStore.set("hiddenIconUserAccts", hiddenIconUserAccts);
	}

	async function delHiddenIconUserIds(): Promise<void> {
		let hiddenIconUserIds = defaultStore.state.hiddenIconUserIds;
		hiddenIconUserIds = hiddenIconUserIds.filter((x) => x !== user.id);
		defaultStore.set("hiddenIconUserIds", hiddenIconUserIds);
		let hiddenIconUserAccts = defaultStore.state.hiddenIconUserAccts;
		hiddenIconUserAccts = hiddenIconUserAccts.filter((x) => x !== acct(user));
		defaultStore.set("hiddenIconUserAccts", hiddenIconUserAccts);
	}

	async function setCustomName(): Promise<void> {
		const { canceled, result: input } = await os.inputText({
			title: i18n.ts.addCustomname,
			placeholder: user.fixedName || user.originalName || "",
			default: user.originalName ? user.name : user.fixedName || "",
		});
		if (canceled) {
			return;
		}
		os.apiWithDialog("users/update-memo", {
			userId: user.id,
			customName: input || null,
			memo: user.memo,
		}).then(() => {
			user.originalName = user.originalName || user.name;
			user.name = input;
		});
	}

	/**
	 * ブロック／ブロック解除を切り替える。
	 *
	 * @remarks
	 * - ブロック作成時の all ミュート付与はサーバー側（blocking/create）で行う。
	 *   クライアントから mute/create を重ねると ALREADY_MUTING になるため呼ばない。
	 * - 解除時は従来どおり mute/delete も呼び、UI 上の「ブロック＝見えない」対称性を保つ。
	 */
	async function toggleBlock(): Promise<void> {
		if (
			!(await getConfirmed(
				user.isBlocking ? i18n.ts.unblockConfirm : i18n.ts.blockConfirm,
			))
		)
			return;

		await os.apiWithDialog(
			user.isBlocking ? "blocking/delete" : "blocking/create",
			{
				userId: user.id,
			},
		);
		user.isBlocking = !user.isBlocking;
		if (user.isBlocking) {
			// サーバーが all ミュートを付与済み
			user.isMuted = true;
			await os.api("following/delete", {
				userId: user.id,
			});
			user.isFollowing = false;
		} else if (user.isMuted) {
			// ミュートが無い場合は呼ばない（NOT_MUTING 回避）
			await os.api("mute/delete", {
				userId: user.id,
			});
			user.isMuted = false;
		} else {
			user.isMuted = false;
		}
	}

	async function toggleSilence() {
		if (
			!(await getConfirmed(
				i18n.t(user.isSilenced ? "unsilenceConfirm" : "silenceConfirm"),
			))
		)
			return;

		os.apiWithDialog(
			user.isSilenced ? "admin/unsilence-user" : "admin/silence-user",
			{
				userId: user.id,
			},
		).then(() => {
			user.isSilenced = !user.isSilenced;
		});
	}

	async function toggleSuspend() {
		if (
			!(await getConfirmed(
				i18n.t(user.isSuspended ? "unsuspendConfirm" : "suspendConfirm"),
			))
		)
			return;

		os.apiWithDialog(
			user.isSuspended ? "admin/unsuspend-user" : "admin/suspend-user",
			{
				userId: user.id,
			},
		).then(() => {
			user.isSuspended = !user.isSuspended;
		});
	}

	function reportAbuse() {
		os.popup(
			defineAsyncComponent(
				() => import("@/components/MkAbuseReportWindow.vue"),
			),
			{
				user: user,
			},
			{},
			"closed",
		);
	}

	async function getConfirmed(text: string): Promise<boolean> {
		const confirm = await os.confirm({
			type: "warning",
			title: "confirm",
			text,
		});

		return !confirm.canceled;
	}

	async function invalidateFollow() {
		if (!(await getConfirmed(i18n.ts.breakFollowConfirm))) return;

		os.apiWithDialog("following/invalidate", {
			userId: user.id,
		}).then(() => {
			user.isFollowed = !user.isFollowed;
		});
	}

	async function accept() {
		const { canceled } = await os.confirm({
			type: "question",
			text: i18n.t("acceptConfirm", {
				name: user.name || user.username,
			}),
		});
		if (canceled) return;
		os.api("following/requests/accept", { userId: user.id });
	}

	async function reject() {
		const { canceled } = await os.confirm({
			type: "warning",
			text: i18n.t("rejectConfirm", {
				name: user.name || user.username,
			}),
		});
		if (canceled) return;
		os.api("following/requests/reject", { userId: user.id });
	}

	async function showFollowedMessage() {
		await os.alert({
			type: "info",
			text: user.followedMessage,
		});
	}

	let menu = [
		{
			icon: "ph-at ph-bold ph-lg",
			text: i18n.ts.copyUsername,
			action: () => {
				copyToClipboard(`@${user.username}@${user.host || host}`);
			},
		},
		{
			icon: "ph-info ph-bold ph-lg",
			text: i18n.ts.info,
			action: () => {
				router.push(`/user-info/${user.id}`);
			},
		},
		{
			icon: "ph-envelope-simple-open ph-bold ph-lg",
			text: i18n.ts.sendMessage,
			action: () => {
				const canonical =
					user.host === null
						? `@${user.username}`
						: `@${user.username}@${user.host}`;
				os.post({ specified: user, initialText: `${canonical} ` });
			},
		},
		// 対応サーバが少ないため、設定ON時のみ表示
		meId !== user.id && defaultStore.state.showUserMenuMessagingAndGroup
			? {
					type: "link",
					icon: "ph-chats-teardrop ph-bold ph-lg",
					text: i18n.ts.startMessaging,
					to: `/my/messaging/${Acct.toString(user)}`,
			  }
			: undefined,
		{
			icon: "ph-share-network ph-bold ph-lg",
			text: i18n.ts.copyUserUrl,
			action: () => {
				copyToClipboard(
					`https://${config.host}/@${user.username}${
						user.host ? `@${user.host}` : ""
					}`,
				);
			},
		},
		...(user.hasPendingFollowRequestToYou
			? [
					null,
					{
						icon: "ph-check ph-bold ph-lg",
						text: i18n.ts.followAccept,
						action: accept,
					},
					{
						icon: "ph-x ph-bold ph-lg",
						text: i18n.ts.followReject,
						action: reject,
					},
			  ]
			: []),
		null,
		meId !== user.id && user.isFollowed && user.followedMessage
			? {
				icon: "ph-chat-dots ph-bold ph-lg",
				text: i18n.ts.followMessageMenu,
				action: showFollowedMessage,
			} : undefined,
		meId !== user.id && !defaultStore.state.hiddenIconUserIds?.includes(user.id)
			? {
					icon: "ph-eye-slash ph-bold ph-lg",
					text: i18n.ts.addHiddenIconUserIds,
					action: addHiddenIconUserIds,
			  }
			: undefined,
		meId !== user.id && defaultStore.state.hiddenIconUserIds?.includes(user.id)
			? {
					icon: "ph-eye ph-bold ph-lg",
					text: i18n.ts.delHiddenIconUserIds,
					action: delHiddenIconUserIds,
			  }
			: undefined,
		meId !== user.id
			? {
					icon: "ph-note-pencil ph-bold ph-lg",
					text: i18n.ts.addCustomname,
					action: setCustomName,
			  }
			: undefined,
		{
			icon: "ph-list-bullets ph-bold ph-lg",
			text: i18n.ts.addToList,
			action: pushList,
		},
		// 対応サーバが少ないため、設定ON時のみ表示（チャット開始と同じスイッチ）
		meId !== user.id && defaultStore.state.showUserMenuMessagingAndGroup
			? {
					icon: "ph-users-three ph-bold ph-lg",
					text: i18n.ts.inviteToGroup,
					action: inviteGroup,
			  }
			: undefined,
	] as any;

	if ($i && meId !== user.id) {
		menu = menu.concat([
			{
				icon:
					(user.muteTypes?.length ?? 0) > 0
						? "ph-sliders-horizontal ph-bold ph-lg"
						: "ph-eye-slash ph-bold ph-lg",
				text: i18n.ts.muteSettings,
				hidden: user.isBlocking === true,
				action: configureMute,
			},
			{
				icon: "ph-prohibit ph-bold ph-lg",
				text: user.isBlocking ? i18n.ts.unblock : i18n.ts.block,
				action: toggleBlock,
			},
		]);

		if (user.isFollowed) {
			menu = menu.concat([
				{
					icon: "ph-link-break ph-bold ph-lg",
					text: i18n.ts.breakFollow,
					action: invalidateFollow,
				},
			]);
		}

		menu = menu.concat([
			null,
			{
				icon: "ph-warning-circle ph-bold ph-lg",
				text: i18n.ts.reportAbuse,
				action: reportAbuse,
			},
		]);
		if (user.isInviter) {
			menu = menu.concat([
				null,
				{
					icon: "ph-snowflake ph-bold ph-lg",
					text: i18n.ts.canSuspend,
					action: async () => {
						await os.alert({
							type: "info",
							text: `あなたはこのユーザを凍結させる権利がある様です。\n\nもしこのユーザを凍結させたい場合は、管理人にDMにて申請を行ってください。\n（凍結させたいユーザのID(@${user.username})と凍結させたい理由を送ってください。）`,
						});
					},
				},
			]);
		}

		// これここにいる？
		if (iAmModerator && false) {
			menu = menu.concat([
				null,
				{
					icon: "ph-microphone-slash ph-bold ph-lg",
					text: user.isSilenced ? i18n.ts.unsilence : i18n.ts.silence,
					action: toggleSilence,
				},
				{
					icon: "ph-snowflake ph-bold ph-lg",
					text: user.isSuspended ? i18n.ts.unsuspend : i18n.ts.suspend,
					action: toggleSuspend,
				},
			]);
		}
	}

	if ($i && meId === user.id) {
		menu = menu.concat([
			null,
			{
				icon: "ph-pencil ph-bold ph-lg",
				text: i18n.ts.editProfile,
				action: () => {
					router.push("/settings/profile");
				},
			},
		]);
	}

	if (userActions.length > 0) {
		menu = menu.concat([
			null,
			...userActions.map((action) => ({
				icon: "ph-plug ph-bold ph-lg",
				text: action.title,
				action: () => {
					action.handler(user);
				},
			})),
		]);
	}

	return menu;
}
