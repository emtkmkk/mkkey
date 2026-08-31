/**
 * @packageDocumentation
 *
 * dev モード時のみ設定に表示する実験的通知種別。
 *
 * @remarks
 * - ブロック（wasBlocked）とブロック解除（wasUnblocked）は設定 UI 上も別トグルで個別に制御する。
 * - フォロー強制解除（wasForciblyUnfollowed）も独立したトグル。
 * - followRequestRejected は設定 UI に出さず、wasForciblyUnfollowed のミュートに追従する。
 *
 * @internal
 */
import { notificationTypes } from "calckey-js";

/** 実験的通知種別（デフォルトミュート） */
export const EXPERIMENTAL_NOTIFICATION_TYPES = [
	"userWasUnfollowed",
	"wasForciblyUnfollowed",
	"wasBlocked",
	"wasUnblocked",
] as const satisfies readonly (typeof notificationTypes)[number][];

/** 設定 UI に出さず、別種別のミュート設定に追従する通知 */
export const GROUPED_MUTED_NOTIFICATION_TYPES = {
	followRequestRejected: "wasForciblyUnfollowed",
} as const satisfies Partial<
	Record<
		(typeof notificationTypes)[number],
		(typeof notificationTypes)[number]
	>
>;

const hiddenGroupedTypeSet = new Set<string>(
	Object.keys(GROUPED_MUTED_NOTIFICATION_TYPES),
);

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
		return notificationTypes.filter(
			(x) => !hiddenGroupedTypeSet.has(x),
		);
	}
	return notificationTypes.filter(
		(x) =>
			!(EXPERIMENTAL_NOTIFICATION_TYPES as readonly string[]).includes(x) &&
			!hiddenGroupedTypeSet.has(x),
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

	const muting = notificationTypes.filter((type) => {
		const groupedParent =
			GROUPED_MUTED_NOTIFICATION_TYPES[
				type as keyof typeof GROUPED_MUTED_NOTIFICATION_TYPES
			];
		if (groupedParent != null) {
			if (visible.includes(groupedParent)) {
				return !enabledTypes.includes(groupedParent);
			}
			return (
				currentMuting.includes(type) ||
				currentMuting.includes(groupedParent)
			);
		}

		if (visible.includes(type)) {
			return !enabledTypes.includes(type);
		}
		if (!developer && experimentalSet.has(type)) {
			return currentMuting.includes(type);
		}
		return currentMuting.includes(type);
	});

	return muting;
}
