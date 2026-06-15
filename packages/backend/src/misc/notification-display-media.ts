/**
 * @packageDocumentation
 *
 * 通知の表示用画像 URL を解決する（Webhook / プッシュ共通）。
 *
 * @remarks
 * - Webhook（Discord/Slack）とプッシュ（`displayImageUrl`）で同じ選定ルールを使う。
 * - センシティブ・CW 付き投稿の添付は表示しない。
 * - リアクション通知の `icon` / `badge` 用 URL もここで解決する。
 *
 * @internal
 */
import config from "@/config/index.js";
import { query } from "@/prelude/url.js";

/** 添付ファイルの最小型 */
export type NotificationDisplayFile = {
	url?: string | null;
	thumbnailUrl?: string | null;
	type?: string | null;
	isSensitive?: boolean;
	properties?: { height?: number; width?: number };
};

/** カスタム絵文字の最小型 */
export type NotificationDisplayEmoji = { name: string; url: string };

/** ノートの最小型 */
export type NotificationDisplayNote = {
	cw?: string | null;
	files?: NotificationDisplayFile[];
	/** ノート本文中のカスタム絵文字 */
	emojis?: NotificationDisplayEmoji[];
	/** ノートに付いたリアクションのカスタム絵文字 */
	reactionEmojis?: NotificationDisplayEmoji[];
};

/** メッセージの最小型 */
export type NotificationDisplayMessage = {
	file?: NotificationDisplayFile | null;
};

/** リアクション通知の補助 */
export type NotificationDisplayReactionContext = {
	/** リアクション文字列（`:name:` または Unicode） */
	reaction?: string | null;
	customEmoji?: { publicUrl?: string | null } | null;
	defaultReaction?: string;
};

function isImageFileType(type: string | null | undefined): boolean {
	return type?.toLowerCase().startsWith("image") ?? false;
}

function isVideoOrAudioFileType(type: string | null | undefined): boolean {
	const t = type?.toLowerCase() ?? "";
	return t.startsWith("video") || t.startsWith("audio");
}

function firstNoteFile(
	note: NotificationDisplayNote | null | undefined,
): NotificationDisplayFile | undefined {
	return note?.files?.[0];
}

function noteAllowsMedia(note: NotificationDisplayNote | null | undefined): boolean {
	if (note == null || note.cw != null) return false;
	return true;
}

function fileAllowsDisplay(file: NotificationDisplayFile | undefined): boolean {
	return file != null && !file.isSensitive;
}

/**
 * Webhook embed の `image`（先頭添付が画像）に相当する URL。
 *
 * @param note - ノート
 * @returns 画像 URL
 * @public
 */
export function resolveNoteEmbedImageUrl(
	note: NotificationDisplayNote | null | undefined,
): string | undefined {
	if (!noteAllowsMedia(note)) return undefined;
	const file = firstNoteFile(note);
	if (!fileAllowsDisplay(file) || !isImageFileType(file?.type)) {
		return undefined;
	}
	return file?.url ?? undefined;
}

/**
 * Webhook embed の `image` オブジェクト（Discord 用）。
 *
 * @param note - ノート
 * @internal
 */
export function resolveNoteDiscordEmbedImage(
	note: NotificationDisplayNote | null | undefined,
):
	| { url: string; height?: number; width?: number }
	| undefined {
	const url = resolveNoteEmbedImageUrl(note);
	if (url == null) return undefined;
	const file = firstNoteFile(note);
	return {
		url,
		height: file?.properties?.height,
		width: file?.properties?.width,
	};
}

/**
 * Webhook embed の `video`（先頭添付が動画/音声）に相当する URL。
 *
 * @param note - ノート
 * @internal
 */
export function resolveNoteDiscordEmbedVideo(
	note: NotificationDisplayNote | null | undefined,
):
	| { url: string; height?: number; width?: number }
	| undefined {
	if (!noteAllowsMedia(note)) return undefined;
	const file = firstNoteFile(note);
	if (!fileAllowsDisplay(file) || !isVideoOrAudioFileType(file?.type)) {
		return undefined;
	}
	const url = file?.url;
	if (url == null) return undefined;
	return {
		url,
		height: file?.properties?.height,
		width: file?.properties?.width,
	};
}

/**
 * インスタンス既定リアクション（ふぁぼ）かどうか。
 *
 * @param reaction - リアクション文字列
 * @param defaultReaction - インスタンス既定リアクション
 * @returns 既定リアクションなら true
 * @public
 */
export function isDefaultInstanceReaction(
	reaction: string | null | undefined,
	defaultReaction: string,
): boolean {
	if (reaction == null || reaction === "") return false;
	return (
		reaction === defaultReaction ||
		reaction.startsWith(`${defaultReaction} (+`)
	);
}

/**
 * Unicode 絵文字を twemoji ファイル名に変換する（SW `char2fileName` 同等）。
 *
 * @param char - 絵文字1文字（合成絵文字可）
 * @returns codepoint 連結
 * @internal
 */
export function unicodeEmojiToTwemojiFileName(char: string): string {
	let codes = Array.from(char).map((x) => x.codePointAt(0)?.toString(16));
	if (!codes.includes("200d")) codes = codes.filter((x) => x !== "fe0f");
	codes = codes.filter((x) => x != null && x.length > 0) as string[];
	return codes.join("-");
}

/**
 * プッシュ通知 `icon` 用のリアクション画像 URL（フルカラー）。
 *
 * @param reaction - リアクション文字列
 * @param note - ノート
 * @param defaultReaction - 既定リアクション
 * @returns 非デフォルト時の icon URL。既定時は undefined
 * @public
 */
export function resolveReactionNotificationIconUrl(
	reaction: string | null | undefined,
	note: NotificationDisplayNote | null | undefined,
	defaultReaction: string,
): string | undefined {
	if (isDefaultInstanceReaction(reaction, defaultReaction)) {
		return undefined;
	}
	if (reaction == null) return undefined;

	const custom = resolveReactionEmojiImageUrlFromNote(reaction, note);
	if (custom != null) return custom;

	if (!reaction.startsWith(":")) {
		return `${config.url}/twemoji/${unicodeEmojiToTwemojiFileName(reaction)}.svg`;
	}

	return undefined;
}

/**
 * プッシュ通知 `badge` 用のリアクション画像 URL（モノクロ）。
 *
 * @param reaction - リアクション文字列
 * @param note - ノート
 * @param defaultReaction - 既定リアクション
 * @returns 非デフォルト時の badge URL。既定時は undefined
 * @public
 */
export function resolveReactionNotificationBadgeUrl(
	reaction: string | null | undefined,
	note: NotificationDisplayNote | null | undefined,
	defaultReaction: string,
): string | undefined {
	if (isDefaultInstanceReaction(reaction, defaultReaction)) {
		return undefined;
	}
	if (reaction == null) return undefined;

	if (reaction.startsWith(":")) {
		const emojiUrl = resolveReactionEmojiImageUrlFromNote(reaction, note);
		if (emojiUrl == null) return undefined;

		try {
			const u = new URL(emojiUrl);
			if (u.href.startsWith(`${config.url}/proxy/`)) {
				u.searchParams.set("badge", "1");
				return u.href;
			}
			const dummy = `${u.host}${u.pathname}`;
			return `${config.url}/proxy/${dummy}?${query({
				url: u.href,
				badge: "1",
			})}`;
		} catch {
			return undefined;
		}
	}

	return `${config.url}/twemoji-badge/${unicodeEmojiToTwemojiFileName(reaction)}.png`;
}

/**
 * カスタム絵文字リアクション文字列から名前部分（`@host` 含む）を取り出す。
 *
 * @param reaction - `:name:` / `:name@host:` 形式
 * @returns 正規化した名前（`:foo@.:` → `foo@.`、`:foo:` → `foo`）
 * @internal
 */
export function normalizeReactionEmojiName(
	reaction: string,
): string | undefined {
	if (!reaction.startsWith(":")) return undefined;

	let name = reaction.slice(1);
	if (name.endsWith(":")) {
		name = name.slice(0, -1);
	}
	return name.length > 0 ? name : undefined;
}

/**
 * リアクション名と pack 済み絵文字名が同一のカスタム絵文字を指すか判定する。
 *
 * @remarks
 * `populateEmojis` はリアクション由来で `blobcat@.` / `blobcat@example.com` のように
 * `@host` 付き name を返す。reaction 側だけ host を剥がすと不一致になるため両側を正規化する。
 *
 * @param reactionName - `normalizeReactionEmojiName` の結果
 * @param entryName - `note.emojis` / `reactionEmojis` 要素の name
 * @internal
 */
export function emojiNameMatches(
	reactionName: string,
	entryName: string,
): boolean {
	const stripHost = (s: string) => s.replace(/@.*$/, "");
	const rBase = stripHost(reactionName);
	const eBase = stripHost(entryName);

	return (
		entryName === reactionName ||
		eBase === rBase ||
		entryName === `${rBase}@.`
	);
}

/**
 * カスタム絵文字リアクションの URL を絵文字一覧から解決する。
 *
 * @param reaction - リアクション文字列（`:name:` 形式）
 * @param emojis - 検索対象の絵文字一覧
 * @returns 画像 URL（見つからないとき undefined）
 * @public
 */
export function resolveReactionEmojiImageUrl(
	reaction: string | null | undefined,
	emojis: NotificationDisplayEmoji[] | null | undefined,
): string | undefined {
	if (reaction == null || !reaction.startsWith(":") || emojis == null) {
		return undefined;
	}

	const reactionName = normalizeReactionEmojiName(reaction);
	if (reactionName == null) return undefined;

	const custom = emojis.find((x) => emojiNameMatches(reactionName, x.name));
	return custom?.url;
}

/**
 * ノートの `emojis` と `reactionEmojis` からカスタム絵文字 URL を解決する。
 *
 * @remarks
 * リアクション専用絵文字は `reactionEmojis` にのみ入るため、両方を順に検索する。
 *
 * @param reaction - リアクション文字列
 * @param note - ノート
 * @returns 画像 URL（見つからないとき undefined）
 * @public
 */
export function resolveReactionEmojiImageUrlFromNote(
	reaction: string | null | undefined,
	note: NotificationDisplayNote | null | undefined,
): string | undefined {
	return (
		resolveReactionEmojiImageUrl(reaction, note?.emojis) ??
		resolveReactionEmojiImageUrl(reaction, note?.reactionEmojis)
	);
}

/**
 * Webhook の `thumbnail.url` に相当する URL。
 *
 * @param note - ノート
 * @param ctx - リアクション・デフォルトリアクション
 * @param notifierAvatarUrl - 通知元アバター（フォールバック）
 * @internal
 */
export function resolveNoteThumbnailUrl(
	note: NotificationDisplayNote | null | undefined,
	ctx: NotificationDisplayReactionContext,
	notifierAvatarUrl?: string | null,
): string | undefined {
	if (ctx.customEmoji?.publicUrl) {
		return ctx.customEmoji.publicUrl;
	}

	const reactionFromEmoji =
		ctx.reaction != null
			? resolveReactionEmojiImageUrlFromNote(ctx.reaction, note)
			: undefined;
	if (reactionFromEmoji != null) return reactionFromEmoji;

	if (noteAllowsMedia(note)) {
		const second = note?.files?.[1];
		if (
			fileAllowsDisplay(second) &&
			second?.type?.startsWith("image")
		) {
			return second.thumbnailUrl ?? second.url ?? undefined;
		}
	}

	const defaultReaction = ctx.defaultReaction;
	if (
		ctx.reaction != null &&
		defaultReaction != null &&
		(ctx.reaction === defaultReaction ||
			ctx.reaction.startsWith(`${defaultReaction} (+`))
	) {
		return undefined;
	}

	return notifierAvatarUrl ?? undefined;
}

/**
 * プッシュ通知の `image`（大画像）用 URL。Webhook の image / thumbnail 優先を 1 本にまとめる。
 *
 * @param note - ノート
 * @param ctx - リアクション文脈
 * @remarks
 * アバターは `icon` で表示するため、ここでは返さない。
 * @public
 */
export function resolveNoteNotificationDisplayImageUrl(
	note: NotificationDisplayNote | null | undefined,
	ctx: NotificationDisplayReactionContext = {},
): string | undefined {
	const embedImage = resolveNoteEmbedImageUrl(note);
	if (embedImage != null) return embedImage;

	if (noteAllowsMedia(note)) {
		const file = firstNoteFile(note);
		if (fileAllowsDisplay(file) && isVideoOrAudioFileType(file?.type)) {
			return file?.thumbnailUrl ?? undefined;
		}
	}

	if (ctx.customEmoji?.publicUrl) {
		return ctx.customEmoji.publicUrl;
	}

	const reactionEmoji = resolveReactionEmojiImageUrlFromNote(
		ctx.reaction,
		note,
	);
	if (reactionEmoji != null) return reactionEmoji;

	if (noteAllowsMedia(note)) {
		const second = note?.files?.[1];
		if (fileAllowsDisplay(second) && second?.type?.startsWith("image")) {
			return second.thumbnailUrl ?? second.url ?? undefined;
		}
	}

	return undefined;
}

/**
 * DM プッシュ / Webhook の message `image` 用 URL。
 *
 * @param message - メッセージ
 * @internal
 */
export function resolveMessagingEmbedImageUrl(
	message: NotificationDisplayMessage | null | undefined,
): string | undefined {
	const file = message?.file;
	if (file == null || file.isSensitive || !isImageFileType(file.type)) {
		return undefined;
	}
	return file.url ?? undefined;
}

/**
 * DM プッシュの `image` 用 URL（添付画像・動画サムネ・絵文字）。
 *
 * @param message - メッセージ
 * @param emojiPublicUrl - チャット絵文字 URL
 * @internal
 */
export function resolveMessagingNotificationDisplayImageUrl(
	message: NotificationDisplayMessage | null | undefined,
	emojiPublicUrl?: string | null,
): string | undefined {
	const image = resolveMessagingEmbedImageUrl(message);
	if (image != null) return image;

	if (emojiPublicUrl) return emojiPublicUrl;

	const file = message?.file;
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
 * Webhook message thumbnail URL。
 *
 * @param message - メッセージ
 * @param emojiPublicUrl - 絵文字 URL
 * @param notifierAvatarUrl - 送信者アバター
 * @internal
 */
export function resolveMessagingThumbnailUrl(
	message: NotificationDisplayMessage | null | undefined,
	emojiPublicUrl?: string | null,
	notifierAvatarUrl?: string | null,
): string | undefined {
	if (emojiPublicUrl) return emojiPublicUrl;

	const file = message?.file;
	if (
		file != null &&
		!file.isSensitive &&
		file.type?.toLowerCase().startsWith("video")
	) {
		return file.thumbnailUrl ?? undefined;
	}

	return notifierAvatarUrl ?? undefined;
}
