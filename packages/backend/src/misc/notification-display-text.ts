/**
 * @packageDocumentation
 *
 * 通知の表示用テキストを解決する（Webhook / プッシュ共通）。
 *
 * @remarks
 * - Webhook `typeToBody` と同系の日本語文面。大意が一致すればよい（プッシュ用に title/body に分割）。
 * - MFM 除去・抜粋は {@link excludeNotPlain} を共用する。
 *
 * @internal
 */
import config from "@/config/index.js";
import { getNoteSummary } from "@/misc/get-note-summary.js";

/** 表示用ユーザの最小型 */
export type NotificationDisplayUser = {
	id?: string;
	name?: string | null;
	username: string;
	host?: string | null;
};

/** プッシュ / Webhook 表示テキスト */
export type NotificationDisplayText = {
	displayTitle: string;
	displayBody?: string;
};

/** プッシュ本文の既定最大長 */
export const DEFAULT_PUSH_EXCERPT_LENGTH = 80;

/**
 * MFM タグ等を除いたプレーンテキストにする（Webhook 同等）。
 *
 * @param text - 元テキスト
 * @returns プレーンテキスト
 * @public
 */
export function excludeNotPlain(text?: string): string | undefined {
	return text
		? text
				.replaceAll(/<\/?\w*?>/g, "")
				.replaceAll(
					/(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*(\$\[([^\s]*?)\s*\])?\s*\])?\s*\])?\s*\])/g,
					"",
				)
		: undefined;
}

/**
 * 表示用の短いユーザ名（Webhook `getUsername` 相当）。
 *
 * @param user - ユーザ
 * @returns 表示名
 * @internal
 */
export function getDisplayUsername(
	user?: NotificationDisplayUser | null,
): string | undefined {
	if (user == null) return undefined;
	const base =
		user.name?.replaceAll(/\s?:\w+?:/g, "").trim() || user.username;
	return `${base}${user.host ? `@${user.host}` : ""}`;
}

/**
 * 表示用のフルユーザ名（Webhook `fullUsername` 相当）。
 *
 * @param user - ユーザ
 * @returns フル表示名
 * @internal
 */
export function getDisplayFullUsername(
	user?: NotificationDisplayUser | null,
): string | undefined {
	if (user == null) return undefined;
	const hostSuffix = user.host ? `@${user.host}` : `@${config.host}`;
	if (user.name) {
		return `${user.name} (${user.username}${hostSuffix})`;
	}
	return `${user.username}${hostSuffix}`;
}

/**
 * ノート本文の抜粋（MFM 除去済み）。
 *
 * @param note - ノート（生データ。要約済み text と files が混在すると添付数が二重になる）
 * @param maxLength - 最大文字数
 * @returns 抜粋
 * @internal
 */
export function getNoteTextExcerpt(
	note:
		| {
				text?: string | null;
				cw?: string | null;
				renote?: unknown;
				files?: unknown[] | null;
		  }
		| null
		| undefined,
	maxLength: number = DEFAULT_PUSH_EXCERPT_LENGTH,
): string | undefined {
	if (note == null) return undefined;
	// 本文があるノート自身を優先。空のリノートは RT 先を要約する
	const target = note.text ? note : (note.renote as typeof note | undefined);
	if (target == null) return undefined;

	let noteText = excludeNotPlain(getNoteSummary(target as Parameters<typeof getNoteSummary>[0]));
	if (noteText == null || noteText === "") return undefined;

	if (note.cw != null && noteText.length > maxLength) {
		noteText = `${noteText.slice(0, maxLength)}… (CW)`;
	} else if (noteText.length > maxLength) {
		noteText = `${noteText.slice(0, maxLength)}…`;
	}

	return noteText;
}

/**
 * メッセージ本文の抜粋。
 *
 * @param text - メッセージ本文
 * @param maxLength - 最大文字数
 * @internal
 */
export function getMessageTextExcerpt(
	text?: string | null,
	maxLength: number = DEFAULT_PUSH_EXCERPT_LENGTH,
): string | undefined {
	const plain = excludeNotPlain(text ?? undefined);
	if (plain == null || plain === "") return undefined;
	if (plain.length <= maxLength) return plain;
	return `${plain.slice(0, maxLength)}…`;
}

function formatReactionLabel(
	reaction: string,
	defaultReaction: string,
): string {
	if (
		reaction === defaultReaction ||
		reaction.startsWith(`${defaultReaction} (+`)
	) {
		return "ふぁぼ";
	}
	return reaction.replaceAll(/:(\w+):/g, "：$1：");
}

/**
 *  packed 通知向けのプッシュ表示テキスト。
 *
 * @param params - 種別・ユーザ・ノート等
 * @returns title/body。未対応種別は undefined
 * @public
 */
export function resolveNotificationDisplayText(params: {
	type: string;
	user?: NotificationDisplayUser | null;
	note?: Parameters<typeof getNoteTextExcerpt>[0];
	reaction?: string | null;
	antennaName?: string | null;
	notifierUser?: NotificationDisplayUser | null;
	defaultReaction?: string;
	excerptLength?: number;
}): NotificationDisplayText | undefined {
	const username = getDisplayUsername(params.user);
	const fullUsername = getDisplayFullUsername(params.user);
	const excerptLength = params.excerptLength ?? DEFAULT_PUSH_EXCERPT_LENGTH;
	const noteExcerpt = getNoteTextExcerpt(params.note, excerptLength);
	const defaultReaction = params.defaultReaction ?? "⭐";

	if (username == null && fullUsername == null) {
		return undefined;
	}

	const name = username ?? fullUsername!;

	switch (params.type) {
		case "mention":
			return {
				displayTitle: `${name} から 呼びかけ`,
				displayBody: noteExcerpt,
			};
		case "reply":
			return {
				displayTitle: `${name} から 返信`,
				displayBody: noteExcerpt,
			};
		case "renote":
			return {
				displayTitle: `${name} から RT`,
				displayBody: noteExcerpt,
			};
		case "quote":
			return {
				displayTitle: `${name} から 引用`,
				displayBody: noteExcerpt,
			};
		case "reaction": {
			const label = params.reaction
				? formatReactionLabel(params.reaction, defaultReaction)
				: "リアクション";
			return {
				displayTitle: `${name} から ${label}`,
				displayBody: noteExcerpt,
			};
		}
		case "unreadAntenna": {
			const antennaName = params.antennaName ?? params.reaction ?? "アンテナ";
			const notifierName = getDisplayUsername(params.user);
			const noteAuthorName = getDisplayUsername(params.notifierUser);
			let title = `${antennaName}📡新着`;
			if (notifierName) {
				title += ` : ${notifierName}`;
				if (
					params.notifierUser?.id != null &&
					params.user?.id != null &&
					params.notifierUser.id !== params.user.id &&
					noteAuthorName
				) {
					title += ` : RT ${noteAuthorName}`;
				}
			}
			return {
				displayTitle: title,
				displayBody: noteExcerpt,
			};
		}
		case "follow":
			return {
				displayTitle: `${fullUsername ?? name} から フォローされました`,
			};
		case "receiveFollowRequest":
			return {
				displayTitle: `${fullUsername ?? name} から フォローリクエスト`,
			};
		case "followRequestAccepted":
			return {
				displayTitle: `${fullUsername ?? name} が フォローを承認しました`,
			};
		case "userWasUnfollowed":
			return {
				displayTitle: `${fullUsername ?? name} から リムーブされました`,
			};
		case "wasForciblyUnfollowed":
			return {
				displayTitle: `${fullUsername ?? name} への フォローを解除させられました`,
			};
		case "followRequestRejected":
			return {
				displayTitle: `${fullUsername ?? name} への フォローが拒否されました`,
			};
		case "wasBlocked":
			return {
				displayTitle: `${fullUsername ?? name} から ブロックされました`,
			};
		case "wasUnblocked":
			return {
				displayTitle: `${fullUsername ?? name} から ブロックが解除されました`,
			};
		case "followedAccountWasDeleted":
			return {
				displayTitle: `${fullUsername ?? name} が アカウントを削除しました`,
			};
		case "pollVote":
			return {
				displayTitle: `${name} が アンケートに投票`,
				displayBody: noteExcerpt,
			};
		case "pollEnded":
			return {
				displayTitle: "アンケートが終了しました",
				displayBody: noteExcerpt,
			};
		case "groupInvited":
			return {
				displayTitle: `${name} から グループに招待`,
			};
		default:
			return undefined;
	}
}

/**
 * DM プッシュ用表示テキスト。
 *
 * @param params - メッセージ情報
 * @internal
 */
export function resolveMessagingDisplayText(params: {
	user?: NotificationDisplayUser | null;
	groupName?: string | null;
	text?: string | null;
	excerptLength?: number;
}): NotificationDisplayText | undefined {
	const username = getDisplayUsername(params.user);
	if (username == null) return undefined;

	const excerptLength = params.excerptLength ?? DEFAULT_PUSH_EXCERPT_LENGTH;
	const body = getMessageTextExcerpt(params.text, excerptLength);

	if (params.groupName) {
		return {
			displayTitle: `${params.groupName} で ${username} から チャット`,
			displayBody: body,
		};
	}

	return {
		displayTitle: `${username} から チャット`,
		displayBody: body,
	};
}

/**
 * Webhook `typeToBody` 用の一行 content（既存挙動維持）。
 *
 * @param webhookType - Webhook ジョブ種別
 * @param params - 文面組み立てパラメータ
 * @internal
 */
export function resolveWebhookTypeToBodyContent(
	webhookType: string,
	params: {
		username?: string;
		fullUsername?: string;
		noteExcerptSuffix?: string;
		reactionEmojiName?: string;
		antennaName?: string;
		groupName?: string;
		noteHasText?: boolean;
		defaultReaction?: string;
		rtPrefix?: string;
	},
): string {
	const content = params.noteExcerptSuffix ?? "";
	const defaultReaction = params.defaultReaction ?? "⭐";

	switch (webhookType) {
		case "mention":
			return `${params.username} から 呼びかけ${content}`;
		case "unfollow":
			return `${params.fullUsername} から リムーブされました`;
		case "deletefollow":
			return `${params.fullUsername} への フォローを解除させられました`;
		case "rejectRequest":
			return `${params.fullUsername} への フォロー申請が拒否されました`;
		case "silentUnfollow":
			return `💬 ${params.fullUsername} から リムーブされました`;
		case "follow":
			return `${params.fullUsername} の フォローに成功`;
		case "followed":
			return `${params.fullUsername} から フォローされました`;
		case "note":
			return `投稿に成功しました${content}`;
		case "reply":
			return `${params.username} から 返信${content}`;
		case "renote":
			return `${params.username} から ${params.noteHasText ? "引用" : "RT"}${content}`;
		case "reaction": {
			const emoji = params.reactionEmojiName ?? "";
			if (
				emoji === defaultReaction ||
				emoji.startsWith(`${defaultReaction} (+`)
			) {
				return `${params.username} から ふぁぼ${content}`;
			}
			return `${params.username} から ${emoji.replaceAll(/:(\w+):/g, "：$1：")}${content}`;
		}
		case "antenna":
			return `${params.antennaName}📡新着 : ${params.username}${params.rtPrefix ?? ""}${content}`;
		case "userMessage":
			return `${params.username} から チャット${content}`;
		case "groupMessage":
			return `${params.groupName} で ${params.username} から チャット${content}`;
		default:
			return `type : ${webhookType}${content}`;
	}
}
