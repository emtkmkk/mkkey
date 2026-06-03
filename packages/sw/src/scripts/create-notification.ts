/*
 * Notification manager for SW
 */
declare var self: ServiceWorkerGlobalScope;

import { swLang } from "@/scripts/lang";
import { pushNotificationDataMap } from "@/types";
import getUserName from "@/scripts/get-user-name";
import { I18n } from "@/scripts/i18n";
import { char2fileName } from "@/scripts/twemoji-base";
import * as url from "@/scripts/url";
import {
	buildNotificationOptions,
	getNoteNotificationImage,
} from "@/scripts/notification-options";

/** バッジ URL の存在確認キャッシュ（同一 URL の再 fetch を避ける） */
const badgeUrlCache = new Map<string, boolean>();

const closeNotificationsByTags = async (tags: string[]) => {
	for (const n of (
		await Promise.all(
			tags.map((tag) => globalThis.registration.getNotifications({ tag })),
		)
	).flat()) {
		n.close();
	}
};

const iconUrl = (name: string) =>
	`/static-assets/notification-badges/${name}.png`;

export async function createNotification<
	K extends keyof pushNotificationDataMap,
>(data: pushNotificationDataMap[K]) {
	const n = await composeNotification(data);

	if (n) {
		return self.registration.showNotification(...n);
	} else {
		console.error("Could not compose notification", data);
		return null;
	}
}

async function composeNotification<K extends keyof pushNotificationDataMap>(
	data: pushNotificationDataMap[K],
): Promise<[string, NotificationOptions] | null> {
	if (!swLang.i18n) swLang.fetchLocale();
	const i18n = (await swLang.i18n) as I18n<any>;
	const { t } = i18n;
	switch (data.type) {
		/*
		case 'driveFileCreated': // TODO (Server Side)
			return [t('_notification.fileUploaded'), {
				body: body.name,
				icon: body.url,
				data
			}];
		*/
		case "notification":
			switch (data.body.type) {
				case "follow":
					return [
						t("_notification.youWereFollowed"),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("user-plus"),
							tag: `follow:${data.body.userId}`,
							data,
							actions: [
								{
									action: "follow",
									title: t("_notification._actions.followBack"),
								},
							],
						}),
					];

				case "userWasUnfollowed":
					return [
						t("_notification.youWereUnfollowed"),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("user-plus"),
							tag: `unfollowed:${data.body.userId}`,
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						}),
					];

				case "wasForciblyUnfollowed":
					return [
						t("_notification.youWereForciblyUnfollowed"),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("clock"),
							tag: `forcibly-unfollowed:${data.body.userId}`,
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						}),
					];

				case "wasBlocked":
					return [
						t("_notification.youWereBlocked"),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("null"),
							tag: `blocked:${data.body.userId}`,
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						}),
					];

				case "followedAccountWasDeleted":
					return [
						t("_notification.followedAccountWasDeleted", {
							name: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("null"),
							tag: `followed-deleted:${data.body.userId}`,
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						}),
					];

				case "mention":
					return [
						t("_notification.youGotMention", {
							name: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: iconUrl("at"),
							image: getNoteNotificationImage(data.body.note),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							requireInteraction: true,
							data,
							actions: [
								{
									action: "reply",
									title: t("_notification._actions.reply"),
								},
							],
						}),
					];

				case "reply":
					return [
						t("_notification.youGotReply", {
							name: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: iconUrl("reply"),
							image: getNoteNotificationImage(data.body.note),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							requireInteraction: true,
							data,
							actions: [
								{
									action: "reply",
									title: t("_notification._actions.reply"),
								},
							],
						}),
					];

				case "unreadAntenna": {
					const bodyText =
						data.body.user.id !== data.body.note.userId
							? `RT ${getUserName(data.body.note.user)} : ${
									data.body.note.text
							  }`
							: data.body.note.text;
					const antennaName =
						(data.body as { antenna?: { name?: string } }).antenna?.name ??
						data.body.reaction;
					return [
						t("_notification.youUnreadAntenna", {
							name: antennaName,
						}),
						buildNotificationOptions(data, {
							body: `${getUserName(data.body.user)} : ${bodyText}` || "",
							icon: data.body.user.avatarUrl,
							badge: iconUrl("comments"),
							tag: `antenna:${data.body.antenna.id}`,
							data,
						}),
					];
				}
				case "renote":
					return [
						t("_notification.youRenoted", {
							name: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: iconUrl("retweet"),
							image: getNoteNotificationImage(data.body.note),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						}),
					];

				case "quote":
					return [
						t("_notification.youGotQuote", {
							name: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: iconUrl("quote-right"),
							image: getNoteNotificationImage(data.body.note),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							data,
							actions: [
								{
									action: "reply",
									title: t("_notification._actions.reply"),
								},
								...(data.body.note.visibility === "public" ||
								data.body.note.visibility === "home"
									? [
											{
												action: "renote",
												title: t("_notification._actions.renote"),
											},
									  ]
									: []),
							],
						}),
					];

				case "reaction":
					let reaction = data.body.reaction;
					let badge: string | undefined;

					if (reaction.startsWith(":")) {
						// カスタム絵文字の場合
						const customEmoji = data.body.note.emojis.find(
							(x) => x.name === reaction.substr(1, reaction.length - 2),
						);
						if (customEmoji) {
							if (reaction.includes("@")) {
								reaction = `:${reaction.substr(1, reaction.indexOf("@") - 1)}:`;
							}

							const u = new URL(customEmoji.url);
							if (u.href.startsWith(`${origin}/proxy/`)) {
								// もう既にproxyっぽそうだったらsearchParams付けるだけ
								u.searchParams.set("badge", "1");
								badge = u.href;
							} else {
								const dummy = `${u.host}${u.pathname}`; // 拡張子がないとキャッシュしてくれないCDNがあるので
								badge = `${origin}/proxy/${dummy}?${url.query({
									url: u.href,
									badge: "1",
								})}`;
							}
						}
					} else {
						// Unicode絵文字の場合
						badge = `/twemoji-badge/${char2fileName(reaction)}.png`;
					}

					if (badge) {
						let ok = badgeUrlCache.get(badge);
						if (ok === undefined) {
							ok = await fetch(badge)
								.then((res) => res.status === 200)
								.catch(() => false);
							badgeUrlCache.set(badge, ok);
						}
						if (!ok) {
							badge = iconUrl("plus");
						}
					}

					return [
						`${reaction} ${getUserName(data.body.user)}`,
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							tag: `reaction:${data.body.note.id}`,
							badge,
							image: getNoteNotificationImage(data.body.note),
							data,
							actions: [
								{
									action: "showUser",
									title: getUserName(data.body.user),
								},
							],
						}),
					];

				case "pollVote":
					return [
						t("_notification.youGotPoll", {
							name: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: iconUrl("poll-h"),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							data,
						}),
					];

				case "pollEnded":
					return [
						t("_notification.pollEnded"),
						buildNotificationOptions(data, {
							body: data.body.note.text || "",
							badge: iconUrl("clipboard-check-solid"),
							tag: `poll:${data.body.note.id}`,
							data,
						}),
					];

				case "receiveFollowRequest":
					return [
						t("_notification.youReceivedFollowRequest"),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("clock"),
							tag: `follow-request:${data.body.userId}`,
							requireInteraction: true,
							data,
							actions: [
								{
									action: "accept",
									title: t("accept"),
								},
								{
									action: "reject",
									title: t("reject"),
								},
							],
						}),
					];

				case "followRequestAccepted":
					return [
						t("_notification.yourFollowRequestAccepted"),
						buildNotificationOptions(data, {
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: iconUrl("check"),
							tag: `follow-accepted:${data.body.userId}`,
							data,
						}),
					];

				case "groupInvited":
					return [
						t("_notification.youWereInvitedToGroup", {
							userName: getUserName(data.body.user),
						}),
						buildNotificationOptions(data, {
							body: data.body.invitation.group.name,
							badge: iconUrl("id-card-alt"),
							tag: `group-invite:${data.body.invitation.id}`,
							requireInteraction: true,
							data,
							actions: [
								{
									action: "accept",
									title: t("accept"),
								},
								{
									action: "reject",
									title: t("reject"),
								},
							],
						}),
					];

				case "app":
					return [
						data.body.header || data.body.body,
						buildNotificationOptions(data, {
							body: data.body.header && data.body.body,
							icon: data.body.icon,
							tag:
								data.body.header === "プッシュ通知テスト"
									? "push-test"
									: undefined,
							data,
						}),
					];

				default:
					return null;
			}
		case "unreadMessagingMessage":
			if (data.body.groupId === null) {
				return [
					t("_notification.youGotMessagingMessageFromUser", {
						name: getUserName(data.body.user),
					}),
					buildNotificationOptions(data, {
						body: data.body.text || "",
						icon: data.body.user.avatarUrl,
						badge: iconUrl("comments"),
						tag: `messaging:user:${data.body.userId}`,
						requireInteraction: true,
						data,
						renotify: true,
					}),
				];
			}
			return [
				t("_notification.youGotMessagingMessageFromGroup", {
					name: data.body.group.name,
				}),
				buildNotificationOptions(data, {
					body: `${getUserName(data.body.user)} : ${data.body.text}` || "",
					icon: data.body.user.avatarUrl,
					badge: iconUrl("comments"),
					tag: `messaging:group:${data.body.groupId}`,
					requireInteraction: true,
					data,
					renotify: true,
				}),
			];
		default:
			return null;
	}
}

export async function createEmptyNotification(data?) {
	return new Promise<void>(async (res) => {
		if (!swLang.i18n) swLang.fetchLocale();
		const i18n = (await swLang.i18n) as I18n<any>;
		const { t } = i18n;

		await self.registration.showNotification(
			data ? data : t("_notification.emptyPushNotificationMessage"),
			{
				silent: true,
				badge: iconUrl("null"),
				tag: "read_notification",
			},
		);

		res();

		setTimeout(async () => {
			try {
				await closeNotificationsByTags([
					"user_visible_auto_notification",
					"read_notification",
				]);
			} finally {
				res();
			}
		}, 1000);
	});
}
