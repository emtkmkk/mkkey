/**
 * @packageDocumentation
 *
 * プッシュ通知 actions の組み立てヘルパー。
 *
 * @remarks
 * - R1: 0件なら「表示」、1件なら左に「表示」を補完
 * - R4: タップ＝表示＝通知一覧、プロフィールは別遷移
 * - R5: タップ＝通知一覧、表示＝ノート、プロフィール＝通知者
 *
 * @internal
 */

/** action ID: 表示（原則タップ既定と同じ遷移。R5 のみノート） */
export const ACTION_VIEW = "view";

/** action ID: プロフィール（固定ラベル） */
export const ACTION_PROFILE = "profile";

/** action ID: 返信 */
export const ACTION_REPLY = "reply";

/**
 * actions 適用ルール。
 *
 * @remarks
 * - `r1`: ensureViewAction を適用
 * - `r4` / `r5` / `explicit` / `groupInvited`: compose 側で確定済みの actions をそのまま使う
 */
export type NotificationActionRule =
	| "r1"
	| "r4"
	| "r5"
	| "explicit"
	| "groupInvited";

/** R4 適用種別（タップ＝表示＝通知一覧） */
const R4_NOTIFICATION_TYPES = new Set([
	"follow",
	"followRequestAccepted",
	"userWasUnfollowed",
	"wasForciblyUnfollowed",
	"followRequestRejected",
	"wasBlocked",
	"wasUnblocked",
	"followedAccountWasDeleted",
]);

/** R5 適用種別（タップ＝通知一覧、表示＝ノート） */
const R5_NOTIFICATION_TYPES = new Set(["renote", "reaction"]);

/**
 * 通知種別が R4 かどうか。
 *
 * @param type - 通知種別
 * @public
 */
export function isR4NotificationType(type: string): boolean {
	return R4_NOTIFICATION_TYPES.has(type);
}

/**
 * 通知種別が R5 かどうか。
 *
 * @param type - 通知種別
 * @public
 */
export function isR5NotificationType(type: string): boolean {
	return R5_NOTIFICATION_TYPES.has(type);
}

/**
 * compose 用にユーザが有効かどうか。
 *
 * @param user - pack 済みユーザ
 * @public
 */
export function hasValidNotificationUser(
	user:
		| {
				id?: string;
				username?: string;
		  }
		| null
		| undefined,
): boolean {
	return (
		user != null &&
		typeof user.id === "string" &&
		typeof user.username === "string"
	);
}

/**
 * 「表示」action を生成する。
 *
 * @param t - i18n 関数
 * @public
 */
export function viewAction(t: (key: string) => string): NotificationAction {
	return {
		action: ACTION_VIEW,
		title: t("_notification._actions.view"),
	};
}

/**
 * 「プロフィール」action を生成する（ラベル固定）。
 *
 * @param t - i18n 関数
 * @public
 */
export function profileAction(t: (key: string) => string): NotificationAction {
	return {
		action: ACTION_PROFILE,
		title: t("_notification._actions.profile"),
	};
}

/**
 * 「返信」action を生成する。
 *
 * @param t - i18n 関数
 * @public
 */
export function replyAction(t: (key: string) => string): NotificationAction {
	return {
		action: ACTION_REPLY,
		title: t("_notification._actions.reply"),
	};
}

/**
 * R4 用 actions（表示 + プロフィール、ユーザ欠落時は表示のみ）。
 *
 * @param t - i18n 関数
 * @param hasUser - プロフィール遷移先ユーザが有効か
 * @public
 */
export function r4Actions(
	t: (key: string) => string,
	hasUser: boolean,
): NotificationAction[] {
	if (!hasUser) {
		return [viewAction(t)];
	}
	return [viewAction(t), profileAction(t)];
}

/**
 * R5 用 actions（表示 + プロフィール）。
 *
 * @param t - i18n 関数
 * @public
 */
export function r5Actions(t: (key: string) => string): NotificationAction[] {
	return [viewAction(t), profileAction(t)];
}

/**
 * R1: compose 後の actions に「表示」を補完する。
 *
 * @param actions - compose 直後の actions
 * @param t - i18n 関数
 * @returns 補完後の actions（空のとき undefined）
 * @public
 */
export function ensureViewAction(
	actions: NotificationAction[] | undefined,
	t: (key: string) => string,
): NotificationAction[] | undefined {
	const list = actions ?? [];
	if (list.length === 0) {
		return [viewAction(t)];
	}
	if (list.length === 1 && list[0].action !== ACTION_VIEW) {
		return [viewAction(t), list[0]];
	}
	return list;
}

/**
 * ルールに応じて actions を確定する。
 *
 * @param actions - compose 直後の actions
 * @param rule - 適用ルール
 * @param t - i18n 関数
 * @returns 確定後の actions
 * @public
 */
export function finalizeNotificationActions(
	actions: NotificationAction[] | undefined,
	rule: NotificationActionRule,
	t: (key: string) => string,
): NotificationAction[] | undefined {
	if (
		rule === "r4" ||
		rule === "r5" ||
		rule === "explicit" ||
		rule === "groupInvited"
	) {
		return actions;
	}
	return ensureViewAction(actions, t);
}
