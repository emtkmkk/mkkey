/*
 * Notification manager for SW
 */
declare var self: ServiceWorkerGlobalScope;

import { swLang } from "@/scripts/lang";
import { pushNotificationDataMap } from "@/types";
import getUserName from "@/scripts/get-user-name";
import { I18n } from "@/scripts/i18n";
import {
	buildNotificationOptions,
	DEFAULT_REACTION_BADGE,
	getPushDisplayText,
	getPushNotificationImage,
	isDefaultInstanceReaction,
	notificationBadgeUrl,
	REACTION_BADGE_FALLBACK,
	resolveAndValidateBadge,
	resolveReactionNotificationBadge,
	resolveReactionNotificationIcon,
} from "@/scripts/notification-options";
import {
	finalizeNotificationActions,
	hasValidNotificationUser,
	profileAction,
	r4Actions,
	r5Actions,
	replyAction,
	type NotificationActionRule,
	viewAction,
} from "@/scripts/notification-actions";
import { withNotificationClickMeta } from "@/scripts/notification-click";

const closeNotificationsByTags = async (tags: string[]) => {
	for (const n of (
		await Promise.all(
			tags.map((tag) => globalThis.registration.getNotifications({ tag })),
		)
	).flat()) {
		n.close();
	}
};

/**
 * notifier が欠落したペイロードでも compose が落ちないよう表示名を返す。
 *
 * @param user - pack 済みユーザ（省略可）
 * @returns 表示名（空文字のときあり）
 * @internal
 */
function safeUserName(
	user:
		| {
				name?: string | null;
				username?: string;
		  }
		| null
		| undefined,
): string {
	if (user == null || typeof user.username !== "string") {
		return "";
	}
	return getUserName({
		name: user.name,
		username: user.username,
	});
}

type ComposeNotificationOptions = NotificationOptions & {
	/** actions 補完ルール（省略時は R1） */
	actionRule?: NotificationActionRule;
	/** notificationclick 用メタ（実効種別・viewNoteId） */
	clickMeta?: {
		effectiveType: string;
		viewNoteId?: string;
	};
};

/**
 * push body からクリック処理用の実効種別を推定する。
 *
 * @param body - notification body
 * @internal
 */
function resolveEffectiveTypeFromBody(body: {
	type?: string;
	reaction?: string;
}): string {
	if (
		body.type === "note" &&
		typeof body.reaction === "string" &&
		body.reaction.length > 0
	) {
		return "unreadAntenna";
	}
	return typeof body.type === "string" ? body.type : "";
}

/**
 * サーバー付与の displayTitle/Body を優先して OS 通知文面を組み立てる。
 *
 * @param data - push データ
 * @param fallbackTitle - displayTitle 未設定時のタイトル
 * @param t - i18n 関数
 * @param options - 種別固有オプション
 * @internal
 */
function composeWithDisplayText<
	T extends { body: { displayTitle?: string | null; displayBody?: string | null } },
>(
	data: T,
	fallbackTitle: string,
	t: (key: string, ...args: unknown[]) => string,
	options: ComposeNotificationOptions,
): [string, NotificationOptions] {
	const { actionRule = "r1", actions, clickMeta, ...rest } = options;
	let notificationData = data;
	if ((data as { type?: string }).type === "notification") {
		const pushData = data as pushNotificationDataMap["notification"];
		const body = pushData.body as {
			viewNoteId?: string;
			type?: string;
			reaction?: string;
		};
		notificationData = withNotificationClickMeta(
			pushData,
			clickMeta?.effectiveType ??
				resolveEffectiveTypeFromBody(body),
			{
				viewNoteId:
					clickMeta?.viewNoteId ?? body.viewNoteId,
			},
		);
	}
	const display = getPushDisplayText(notificationData.body);
	return [
		display?.title ?? fallbackTitle,
		buildNotificationOptions(notificationData, {
			...rest,
			body: display?.body ?? rest.body,
			actions: finalizeNotificationActions(actions, actionRule, t),
		}),
	];
}

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
		case "notification": {
			// pack 上は `note` だが実体は unreadAntenna のことがある
			const notificationType =
				data.body.type === "note" &&
				typeof (data.body as { reaction?: string }).reaction ===
					"string" &&
				(data.body as { reaction?: string }).reaction
					? "unreadAntenna"
					: data.body.type;

			/** notificationclick 用の実効種別メタ */
			const buildClickMeta = (extra?: { viewNoteId?: string }) => ({
				effectiveType: notificationType,
				...extra,
			});

			switch (notificationType) {
				case "follow":
					return composeWithDisplayText(
						data,
						t("_notification.youWereFollowed"),
						t,
						{
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("user-plus"),
							tag: `follow:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);

				case "userWasUnfollowed": {
					const name = safeUserName(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.youWereUnfollowed"),
						t,
						{
							body: name || undefined,
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("user-plus"),
							tag: `unfollowed:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);
				}

				case "wasForciblyUnfollowed": {
					const name = safeUserName(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.youWereForciblyUnfollowed"),
						t,
						{
							body: name || undefined,
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("clock"),
							tag: `forcibly-unfollowed:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);
				}

				case "followRequestRejected": {
					const name = safeUserName(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.youWereFollowRequestRejected"),
						t,
						{
							body: name || undefined,
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("clock"),
							tag: `follow-request-rejected:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);
				}

				case "wasBlocked": {
					const name = safeUserName(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.youWereBlocked"),
						t,
						{
							body: name || undefined,
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("null"),
							tag: `blocked:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);
				}

				case "wasUnblocked": {
					const name = safeUserName(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.youWereUnblocked"),
						t,
						{
							body: name || undefined,
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("check"),
							tag: `unblocked:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);
				}

				case "followedAccountWasDeleted": {
					const name = safeUserName(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.followedAccountWasDeleted", {
							name: name || data.body.type,
						}),
						t,
						{
							body: name || undefined,
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("null"),
							tag: `followed-deleted:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);
				}

				case "mention":
					return composeWithDisplayText(
						data,
						t("_notification.youGotMention", {
							name: getUserName(data.body.user),
						}),
						t,
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("at"),
							image: getPushNotificationImage(data.body),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							requireInteraction: true,
							data,
							actions: [replyAction(t)],
						},
					);

				case "reply":
					return composeWithDisplayText(
						data,
						t("_notification.youGotReply", {
							name: getUserName(data.body.user),
						}),
						t,
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("reply"),
							image: getPushNotificationImage(data.body),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							requireInteraction: true,
							data,
							actions: [replyAction(t)],
						},
					);

				case "unreadAntenna": {
					const noteUserId = data.body.note?.userId;
					const noteUser = data.body.note?.user;
					const bodyText =
						noteUserId != null &&
						data.body.user?.id != null &&
						data.body.user.id !== noteUserId &&
						noteUser != null
							? `RT ${getUserName(noteUser)} : ${data.body.note.text ?? ""}`
							: data.body.note?.text ?? "";
					const antennaName =
						(data.body as { antenna?: { name?: string } }).antenna?.name ??
						data.body.reaction ??
						"";
					const antennaTagKey =
						(data.body as { antenna?: { id?: string } }).antenna?.id ??
						data.body.reaction ??
						data.body.id;
					return composeWithDisplayText(
						data,
						t("_notification.youUnreadAntenna", {
							name: antennaName,
						}),
						t,
						{
							body: `${getUserName(data.body.user)} : ${bodyText}` || "",
							icon: data.body.user?.avatarUrl,
							badge: notificationBadgeUrl("comments"),
							image: getPushNotificationImage(data.body),
							tag: `antenna:${antennaTagKey}`,
							data,
						},
					);
				}
				case "renote":
					return composeWithDisplayText(
						data,
						t("_notification.youRenoted", {
							name: getUserName(data.body.user),
						}),
						t,
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("retweet"),
							image: getPushNotificationImage(data.body),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							data,
							actions: hasValidNotificationUser(data.body.user)
								? r5Actions(t)
								: [viewAction(t)],
							actionRule: hasValidNotificationUser(data.body.user)
								? "r5"
								: "r1",
							clickMeta: buildClickMeta({
								viewNoteId:
									(
										data.body as {
											viewNoteId?: string;
											renoteTargetNoteId?: string;
										}
									).viewNoteId ??
									(
										data.body as {
											renoteTargetNoteId?: string;
										}
									).renoteTargetNoteId ??
									data.body.note?.renoteId,
							}),
						},
					);

				case "quote":
					return composeWithDisplayText(
						data,
						t("_notification.youGotQuote", {
							name: getUserName(data.body.user),
						}),
						t,
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("quote-right"),
							image: getPushNotificationImage(data.body),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							data,
							actions: [replyAction(t)],
						},
					);

				case "reaction": {
					const reactionBody = data.body as typeof data.body & {
						defaultReaction?: string | null;
						reactionIconUrl?: string | null;
						reactionBadgeUrl?: string | null;
					};
					const defaultReaction =
						reactionBody.defaultReaction ?? "⭐";
					const reactionRaw = reactionBody.reaction ?? "";
					const isDefault = isDefaultInstanceReaction(
						reactionRaw,
						defaultReaction,
					);

					// タイトル表示用にリモート絵文字名を短縮
					let displayReaction = reactionRaw;
					if (
						displayReaction.startsWith(":") &&
						displayReaction.includes("@")
					) {
						displayReaction = `:${displayReaction.slice(
							1,
							displayReaction.indexOf("@") - 1,
						)}:`;
					}

					const icon = isDefault
						? data.body.user.avatarUrl
						: (resolveReactionNotificationIcon(reactionBody) ??
								data.body.user.avatarUrl);

					const badge = isDefault
						? notificationBadgeUrl(DEFAULT_REACTION_BADGE)
						: await resolveAndValidateBadge(
								reactionBody.reactionBadgeUrl ??
									resolveReactionNotificationBadge(
										reactionRaw,
										reactionBody.note,
									),
								notificationBadgeUrl(REACTION_BADGE_FALLBACK),
							);

					return composeWithDisplayText(
						data,
						`${displayReaction} ${getUserName(data.body.user)}`,
						t,
						{
							body: data.body.note.text || "",
							icon,
							tag: `reaction:${data.body.note.id}`,
							badge,
							// NOTE: リアクション画像は icon で表示するため image は付けない
							data,
							actions: hasValidNotificationUser(data.body.user)
								? r5Actions(t)
								: [viewAction(t)],
							actionRule: hasValidNotificationUser(data.body.user)
								? "r5"
								: "r1",
							clickMeta: buildClickMeta({
								viewNoteId:
									(data.body as { viewNoteId?: string })
										.viewNoteId ?? data.body.note?.id,
							}),
						},
					);
				}

				case "pollVote": {
					const triggerId = data.body.user?.id;
					const posterId =
						data.body.note?.userId ??
						(data.body.note as { user?: { id?: string } } | undefined)
							?.user?.id;
					const showProfileAction =
						triggerId != null &&
						posterId != null &&
						triggerId !== posterId;
					return composeWithDisplayText(
						data,
						t("_notification.youGotPoll", {
							name: getUserName(data.body.user),
						}),
						t,
						{
							body: data.body.note.text || "",
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("poll-h"),
							tag: data.body.note?.id
								? `note:${data.body.note.id}`
								: undefined,
							data,
							actions: showProfileAction
								? [profileAction(t)]
								: undefined,
						},
					);
				}

				case "pollEnded":
					return composeWithDisplayText(
						data,
						t("_notification.pollEnded"),
						t,
						{
							body: data.body.note.text || "",
							badge: notificationBadgeUrl("clipboard-check-solid"),
							tag: `poll:${data.body.note.id}`,
							data,
						},
					);

				case "receiveFollowRequest": {
					const hasUser = hasValidNotificationUser(data.body.user);
					return composeWithDisplayText(
						data,
						t("_notification.youReceivedFollowRequest"),
						t,
						{
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("clock"),
							tag: `follow-request:${data.body.userId}`,
							requireInteraction: true,
							data,
							actions: [
								viewAction(t),
								...(hasUser ? [profileAction(t)] : []),
							],
							actionRule: "explicit",
						},
					);
				}

				case "followRequestAccepted":
					return composeWithDisplayText(
						data,
						t("_notification.yourFollowRequestAccepted"),
						t,
						{
							body: getUserName(data.body.user),
							icon: data.body.user.avatarUrl,
							badge: notificationBadgeUrl("check"),
							tag: `follow-accepted:${data.body.userId}`,
							data,
							actions: r4Actions(
								t,
								hasValidNotificationUser(data.body.user),
							),
							actionRule: "r4",
						},
					);

				case "groupInvited":
					return composeWithDisplayText(
						data,
						t("_notification.youWereInvitedToGroup", {
							userName: getUserName(data.body.user),
						}),
						t,
						{
							body: data.body.invitation.group.name,
							badge: notificationBadgeUrl("id-card-alt"),
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
							actionRule: "groupInvited",
						},
					);

				case "app": {
					const isPushTest =
						(data.body as { isPushTest?: boolean }).isPushTest === true;
					let notificationBody: string | undefined =
						data.body.header && data.body.body
							? data.body.body
							: undefined;
					if (isPushTest) {
						const swVersionLine = `SW: ${_VERSION_}`;
						notificationBody = notificationBody
							? `${notificationBody}\n${swVersionLine}`
							: swVersionLine;
					}
					const subIcon = (data.body as { subIcon?: string | null })
						.subIcon;
					const badge =
						typeof subIcon === "string" && /^https?:\/\//.test(subIcon)
							? subIcon
							: undefined;
					return composeWithDisplayText(
						data,
						data.body.header || data.body.body,
						t,
						{
							body: notificationBody,
							icon: data.body.icon,
							badge,
							tag: isPushTest ? "push-test" : undefined,
							data,
						},
					);
				}

				case "badge":
					return composeWithDisplayText(
						data,
						data.body.header || data.body.body,
						t,
						{
							body: data.body.body,
							badge: notificationBadgeUrl("star"),
							tag: `badge:${data.body.id}`,
							data,
						},
					);

				default: {
					// 未対応種別・古い SW でも汎用通知を出す（compose 失敗を防ぐ）
					const name = safeUserName(data.body.user);
					const notifType =
						typeof data.body.type === "string" ? data.body.type : "";
					return composeWithDisplayText(
						data,
						t("_notification.emptyPushNotificationMessage"),
						t,
						{
							body: name || notifType || undefined,
							icon: data.body.user?.avatarUrl,
							tag: data.body.id
								? `notification:${data.body.id}`
								: notifType
									? `notification-type:${notifType}`
									: undefined,
							data,
						},
					);
				}
			}
		}
		case "unreadMessagingMessage":
			if (data.body.groupId === null) {
				return composeWithDisplayText(
					data,
					t("_notification.youGotMessagingMessageFromUser", {
						name: getUserName(data.body.user),
					}),
					t,
					{
						body: data.body.text || "",
						icon: data.body.user.avatarUrl,
						badge: notificationBadgeUrl("comments"),
						image: getPushNotificationImage(data.body),
						tag: `messaging:user:${data.body.userId}`,
						requireInteraction: true,
						data,
						renotify: true,
					},
				);
			}
			return composeWithDisplayText(
				data,
				t("_notification.youGotMessagingMessageFromGroup", {
					name: data.body.group.name,
				}),
				t,
				{
					body: `${getUserName(data.body.user)} : ${data.body.text}` || "",
					icon: data.body.user.avatarUrl,
					badge: notificationBadgeUrl("comments"),
					image: getPushNotificationImage(data.body),
					tag: `messaging:group:${data.body.groupId}`,
					requireInteraction: true,
					data,
					renotify: true,
				},
			);
		default:
			return null;
	}
}

export async function createEmptyNotification(data?: string) {
	if (!swLang.i18n) swLang.fetchLocale();
	const i18n = (await swLang.i18n) as I18n<any>;
	const { t } = i18n;

	await self.registration.showNotification(
		data ?? t("_notification.emptyPushNotificationMessage"),
		{
			silent: true,
			badge: notificationBadgeUrl("null"),
			tag: "read_notification",
		},
	);

	await new Promise<void>((resolve) => {
		setTimeout(async () => {
			try {
				await closeNotificationsByTags([
					"user_visible_auto_notification",
					"read_notification",
				]);
			} finally {
				resolve();
			}
		}, 1000);
	});
}
