/**
 * @packageDocumentation
 *
 * showNotification 用の共通オプション組み立て。
 *
 * @remarks
 * - リアクション通知の icon / badge 解決もここに集約する。
 *
 * @internal
 */
declare var self: ServiceWorkerGlobalScope;

import { char2fileName, char2filePath } from "@/scripts/twemoji-base";
import * as url from "@/scripts/url";

const MAX_NOTIFICATION_ACTIONS = 2;

/** デフォルトリアクション（ふぁぼ）通知の badge 名 */
export const DEFAULT_REACTION_BADGE = "star";

/** 非デフォルトでリアクション badge 取得失敗時の badge 名 */
export const REACTION_BADGE_FALLBACK = "face-smile";

/** バッジ URL の存在確認キャッシュ（同一 URL の再 fetch を避ける） */
const badgeUrlCache = new Map<string, boolean>();

/**
 * 静的 notification-badges の URL を返す。
 *
 * @param name - ファイル名（拡張子なし）
 * @public
 */
export function notificationBadgeUrl(name: string): string {
	return `/static-assets/notification-badges/${name}.png`;
}

/**
 * インスタンス既定リアクションかどうか。
 *
 * @param reaction - リアクション文字列
 * @param defaultReaction - 既定リアクション
 * @public
 */
export function isDefaultInstanceReaction(
	reaction: string,
	defaultReaction: string,
): boolean {
	return (
		reaction === defaultReaction ||
		reaction.startsWith(`${defaultReaction} (+`)
	);
}

/**
 * 通知 actions を OS 上限に合わせて切り詰める。
 *
 * @param actions - 元の actions
 * @returns 最大2件の actions
 * @internal
 */
export function clipNotificationActions(
	actions: NotificationAction[] | undefined,
): NotificationAction[] | undefined {
	if (actions == null || actions.length <= MAX_NOTIFICATION_ACTIONS) {
		return actions;
	}
	return actions.slice(0, MAX_NOTIFICATION_ACTIONS);
}

type PushDisplayFile = {
	url?: string | null;
	thumbnailUrl?: string | null;
	type?: string | null;
	isSensitive?: boolean;
};

type PushNotificationBody = {
	displayImageUrl?: string | null;
	note?: {
		cw?: string | null;
		files?: PushDisplayFile[];
		emojis?: Array<{ name: string; url: string }>;
	} | null;
	file?: PushDisplayFile | null;
	reaction?: string | null;
};

function isImageType(type: string | null | undefined): boolean {
	return type?.toLowerCase().startsWith("image") ?? false;
}

function isVideoOrAudioType(type: string | null | undefined): boolean {
	const t = type?.toLowerCase() ?? "";
	return t.startsWith("video") || t.startsWith("audio");
}

/**
 * ノート添付から表示用画像 URL を解決する（後方互換・displayImageUrl 未設定時）。
 *
 * @param note - 通知に含まれるノート
 * @param reaction - リアクション文字列
 * @returns image URL または undefined
 * @internal
 */
export function getNoteNotificationImage(
	note:
		| {
				cw?: string | null;
				files?: PushDisplayFile[];
				emojis?: Array<{ name: string; url: string }>;
		  }
		| null
		| undefined,
	reaction?: string | null,
): string | undefined {
	if (note == null || note.cw != null) return undefined;

	const file = note.files?.[0];
	if (file != null && !file.isSensitive) {
		if (isImageType(file.type)) {
			return file.url ?? file.thumbnailUrl ?? undefined;
		}
		if (isVideoOrAudioType(file.type)) {
			return file.thumbnailUrl ?? undefined;
		}
	}

	if (reaction != null && reaction.startsWith(":") && note.emojis != null) {
		let name = reaction.slice(1);
		if (name.endsWith(":")) name = name.slice(0, -1);
		if (name.includes("@")) name = name.split("@")[0]!;
		const custom = note.emojis.find((x) => x.name === name);
		if (custom?.url) return custom.url;
	}

	const second = note.files?.[1];
	if (second != null && !second.isSensitive && second.type?.startsWith("image")) {
		return second.thumbnailUrl ?? second.url ?? undefined;
	}

	return undefined;
}

/**
 * サーバー付与の表示テキスト（Webhook 風）を取得する。
 *
 * @param body - notification / messaging body
 * @returns title / body。未設定なら undefined
 * @internal
 */
export function getPushDisplayText(
	body:
		| {
				displayTitle?: string | null;
				displayBody?: string | null;
		  }
		| null
		| undefined,
): { title: string; body?: string } | undefined {
	if (body == null) return undefined;
	if (
		typeof body.displayTitle !== "string" ||
		body.displayTitle.length === 0
	) {
		return undefined;
	}
	return {
		title: body.displayTitle,
		body:
			typeof body.displayBody === "string" &&
			body.displayBody.length > 0
				? body.displayBody
				: undefined,
	};
}

/**
 * プッシュペイロードから OS 通知の大画像 URL を取得する。
 *
 * @param body - notification / messaging の body
 * @returns `NotificationOptions.image` 用 URL
 * @remarks
 * 優先順: `displayImageUrl`（サーバー解決）→ ノート/DM のローカル解決
 * @internal
 */
export function getPushNotificationImage(
	body: PushNotificationBody | null | undefined,
): string | undefined {
	if (body == null) return undefined;

	if (
		typeof body.displayImageUrl === "string" &&
		body.displayImageUrl.length > 0
	) {
		return body.displayImageUrl;
	}

	if (body.note != null) {
		const fromNote = getNoteNotificationImage(body.note, body.reaction);
		if (fromNote != null) return fromNote;
	}

	const file = body.file;
	if (file != null && !file.isSensitive && isImageType(file.type)) {
		return file.url ?? file.thumbnailUrl ?? undefined;
	}
	if (
		file != null &&
		!file.isSensitive &&
		file.type?.toLowerCase().startsWith("video")
	) {
		return file.thumbnailUrl ?? undefined;
	}

	return undefined;
}

/**
 * push ペイロードから共通 NotificationOptions を組み立てる。
 *
 * @param data - push データ
 * @param options - 種別固有オプション
 * @internal
 */
export function buildNotificationOptions(
	data: { dateTime: number },
	options: NotificationOptions,
): NotificationOptions {
	return {
		timestamp: data.dateTime,
		...options,
		actions: clipNotificationActions(options.actions),
	};
}

type ReactionNotificationEmoji = { name: string; url: string };

type ReactionNotificationBody = {
	reaction?: string | null;
	defaultReaction?: string | null;
	reactionIconUrl?: string | null;
	reactionBadgeUrl?: string | null;
	note?: {
		emojis?: ReactionNotificationEmoji[];
		reactionEmojis?: ReactionNotificationEmoji[];
	} | null;
};

/**
 * カスタム絵文字リアクションの URL を複数リストから解決する。
 *
 * @param reaction - リアクション文字列（`:name:` 形式）
 * @param emojiLists - 検索対象（`emojis` / `reactionEmojis` 等）
 * @returns 画像 URL（見つからないとき undefined）
 * @internal
 */
function findCustomEmojiUrl(
	reaction: string,
	emojiLists: Array<ReactionNotificationEmoji[] | null | undefined>,
): string | undefined {
	if (!reaction.startsWith(":")) return undefined;

	let name = reaction.slice(1);
	if (name.endsWith(":")) name = name.slice(0, -1);
	if (name.includes("@")) name = name.split("@")[0]!;

	for (const emojis of emojiLists) {
		if (emojis == null) continue;
		const custom = emojis.find((x) => x.name === name);
		if (custom?.url) return custom.url;
	}

	return undefined;
}

/**
 * プッシュ `icon` 用のリアクション画像 URL を解決する。
 *
 * @param body - notification body
 * @returns フルカラー icon URL
 * @internal
 */
export function resolveReactionNotificationIcon(
	body: ReactionNotificationBody,
): string | undefined {
	if (
		typeof body.reactionIconUrl === "string" &&
		body.reactionIconUrl.length > 0
	) {
		return body.reactionIconUrl;
	}

	const reaction = body.reaction;
	const note = body.note;
	if (reaction == null || reaction === "") return undefined;

	if (reaction.startsWith(":")) {
		return findCustomEmojiUrl(reaction, [
			note?.emojis,
			note?.reactionEmojis,
		]);
	}

	if (!reaction.startsWith(":")) {
		return char2filePath(reaction);
	}

	return undefined;
}

/**
 * プッシュ `badge` 用のリアクション画像 URL をローカル解決する。
 *
 * @param reaction - リアクション文字列
 * @param note - ノート
 * @returns モノクロ badge URL
 * @internal
 */
export function resolveReactionNotificationBadge(
	reaction: string,
	note: ReactionNotificationBody["note"],
): string | undefined {
	if (reaction.startsWith(":")) {
		const customUrl = findCustomEmojiUrl(reaction, [
			note?.emojis,
			note?.reactionEmojis,
		]);
		if (customUrl == null) return undefined;

		const u = new URL(customUrl);
		if (u.href.startsWith(`${origin}/proxy/`)) {
			u.searchParams.set("badge", "1");
			return u.href;
		}

		const dummy = `${u.host}${u.pathname}`;
		return `${origin}/proxy/${dummy}?${url.query({
			url: u.href,
			badge: "1",
		})}`;
	}

	return `/twemoji-badge/${char2fileName(reaction)}.png`;
}

/**
 * badge URL を fetch 検証し、失敗時はフォールバックを返す。
 *
 * @param candidate - 候補 URL
 * @param fallbackUrl - 取得失敗時 URL
 * @returns 利用可能な badge URL
 * @internal
 */
export async function resolveAndValidateBadge(
	candidate: string | undefined,
	fallbackUrl: string,
): Promise<string> {
	if (candidate == null || candidate === "") {
		return fallbackUrl;
	}

	let ok = badgeUrlCache.get(candidate);
	if (ok === undefined) {
		ok = await fetch(candidate)
			.then((res) => res.status === 200)
			.catch(() => false);
		badgeUrlCache.set(candidate, ok);
	}

	return ok ? candidate : fallbackUrl;
}
