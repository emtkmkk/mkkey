/**
 * @packageDocumentation
 *
 * dev モード時のみ設定に表示する実験的通知種別。
 *
 * @internal
 */
import { notificationTypes } from "calckey-js";

/** 実験的通知種別（デフォルトミュート） */
export const EXPERIMENTAL_NOTIFICATION_TYPES = [
	"userWasUnfollowed",
	"wasForciblyUnfollowed",
	"wasBlocked",
] as const satisfies readonly (typeof notificationTypes)[number][];

/**
 * developer フラグに応じて設定画面・通知一覧フィルタに表示する種別一覧を返す。
 *
 * @param developer - registry developer フラグ
 * @internal
 */
export function getConfigurableNotificationTypes(
	developer: boolean,
): (typeof notificationTypes)[number][] {
	if (developer) {
		return [...notificationTypes];
	}
	return notificationTypes.filter(
		(x) =>
			!(EXPERIMENTAL_NOTIFICATION_TYPES as readonly string[]).includes(x),
	);
}

/**
 * mutingNotificationTypes を更新する際、非 dev ユーザーから実験的種別の状態を維持する。
 *
 * @param developer - registry developer フラグ
 * @param enabledTypes - 設定画面で ON にした種別
 * @param currentMuting - 現在のミュート一覧
 * @internal
 */
export function buildMutingNotificationTypes(
	developer: boolean,
	enabledTypes: readonly string[],
	currentMuting: readonly string[],
): (typeof notificationTypes)[number][] {
	const visible = getConfigurableNotificationTypes(developer);
	const experimentalSet = new Set<string>(EXPERIMENTAL_NOTIFICATION_TYPES);

	return notificationTypes.filter((type) => {
		if (visible.includes(type)) {
			return !enabledTypes.includes(type);
		}
		if (!developer && experimentalSet.has(type)) {
			return currentMuting.includes(type);
		}
		return currentMuting.includes(type);
	});
}
