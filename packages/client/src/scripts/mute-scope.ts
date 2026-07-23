/**
 * @packageDocumentation
 *
 * ユーザー単位のミュート範囲と共通期限を編集するフォームを提供する。
 *
 * @remarks
 * `all` は従来の通常ミュートを表し、個別範囲より優先される。
 *
 * @internal
 */

import type { MuteType, UserDetailed } from "calckey-js/built/entities";
import { i18n } from "@/i18n";
import * as os from "@/os";

/**
 * 対象ユーザーのミュート範囲と共通期限を編集する。
 *
 * @param user - 関係情報を含む対象ユーザー
 * @returns 更新後のユーザー。キャンセル時はnull
 * @public
 */
export async function configureUserMute(
	user: UserDetailed,
): Promise<UserDetailed | null> {
	const currentTypes =
		user.muteTypes ??
		(user.isMuted
			? ["all" as const]
			: [
					...(user.isRenoteMuted ? (["renote"] as const) : []),
					...(user.isPushMuted ? (["push"] as const) : []),
					...(user.isFollowBlocking ? (["follow"] as const) : []),
			  ]);
	const has = (type: MuteType): boolean => currentTypes.includes(type);
	const keepCurrentExpiry = user.muteExpiresAt != null;
	const response = (await os.form(i18n.ts.muteSettings, {
		all: {
			type: "boolean",
			default: has("all"),
			label: i18n.ts._muteScopes.all,
			description: i18n.ts._muteScopes.allDescription,
		},
		note: {
			type: "boolean",
			default: has("note"),
			label: i18n.ts._muteScopes.note,
		},
		renote: {
			type: "boolean",
			default: has("renote"),
			label: i18n.ts._muteScopes.renote,
		},
		reaction: {
			type: "boolean",
			default: has("reaction"),
			label: i18n.ts._muteScopes.reaction,
		},
		message: {
			type: "boolean",
			default: has("message"),
			label: i18n.ts._muteScopes.message,
		},
		notification: {
			type: "boolean",
			default: has("notification"),
			label: i18n.ts._muteScopes.notification,
			description: i18n.ts._muteScopes.notificationDescription,
		},
		push: {
			type: "boolean",
			default: has("push"),
			label: i18n.ts._muteScopes.push,
			description: i18n.ts._muteScopes.pushDescription,
		},
		follow: {
			type: "boolean",
			default: has("follow"),
			label: i18n.ts._muteScopes.follow,
			description: i18n.ts._muteScopes.followDescription,
		},
		period: {
			type: "enum",
			default: keepCurrentExpiry ? "keep" : "indefinitely",
			label: i18n.ts.mutePeriod,
			enum: [
				...(keepCurrentExpiry
					? [{ value: "keep", label: i18n.ts.keepCurrentExpiration }]
					: []),
				{ value: "indefinitely", label: i18n.ts.indefinitely },
				{ value: "tenMinutes", label: i18n.ts.tenMinutes },
				{ value: "oneHour", label: i18n.ts.oneHour },
				{ value: "oneDay", label: i18n.ts.oneDay },
				{ value: "oneWeek", label: i18n.ts.oneWeek },
			],
		},
	})) as
		| { canceled: true }
		| { canceled?: false; result: Record<string, boolean | string> };
	if (response.canceled) return null;

	const { result } = response;
	const individualTypes: MuteType[] = [
		"reaction",
		"renote",
		"push",
		"note",
		"notification",
		"message",
		"follow",
	];
	const types: MuteType[] = result.all
		? ["all"]
		: individualTypes.filter((type) => result[type] === true);
	const expiresAt =
		result.period === "keep"
			? new Date(user.muteExpiresAt!).getTime()
			: result.period === "indefinitely"
			? null
			: result.period === "tenMinutes"
			? Date.now() + 1000 * 60 * 10
			: result.period === "oneHour"
			? Date.now() + 1000 * 60 * 60
			: result.period === "oneDay"
			? Date.now() + 1000 * 60 * 60 * 24
			: Date.now() + 1000 * 60 * 60 * 24 * 7;

	return await os.apiWithDialog("mute/update", {
		userId: user.id,
		types,
		expiresAt,
	});
}
