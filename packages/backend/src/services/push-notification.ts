/**
 * @packageDocumentation
 *
 * プッシュ通知の送信を行うサービス。
 *
 * @remarks
 * - **役割**: web-push でクライアントへプッシュ通知を送る。SwSubscriptions を参照し、通知・メッセージイベントを配送する。
 * - read* 系はストリーム同期に移行済みのため push では送信しない（{@link PUSH_READ_SYNC_TYPES}）。
 * - 購読削除は HTTP 410（Gone）のみ。
 *
 * @see {@link services/stream} ストリーム連携
 * @internal
 */
import push from "web-push";
import config from "@/config/index.js";
import { Mutings, SwSubscriptions } from "@/models/index.js";
import { hasMuteScope } from "@/misc/mute-scope.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import {
	getSwSubscriptionsByUserId,
	invalidateSwSubscriptionsCache,
} from "@/misc/sw-subscriptions-cache.js";
import type { Packed } from "@/misc/schema.js";
import { getNoteSummary } from "@/misc/get-note-summary.js";
import Logger from "@/services/logger.js";
import {
	PUSH_READ_SYNC_TYPES,
	type pushNotificationsTypes,
} from "@/misc/push-notification-types.js";
import {
	hashPushEndpoint,
	logPushSend,
	logPushSubscriptionChange,
} from "@/services/push-audit-log.js";
import {
	resolveMessagingNotificationDisplayImageUrl,
	resolveNoteNotificationDisplayImageUrl,
	resolveReactionNotificationBadgeUrl,
	resolveReactionNotificationIconUrl,
} from "@/misc/notification-display-media.js";
import {
	resolveMessagingDisplayText,
	resolveNotificationDisplayText,
	type NotificationDisplayUser,
} from "@/misc/notification-display-text.js";

export type { pushNotificationsTypes };

const logger = new Logger("push-notification", "yellow");

const SEND_TIMEOUT_MS = 15_000;

/** Web Push ペイロード上限（バイト） */
const MAX_PUSH_PAYLOAD_BYTES = 3800;

/** VAPID 初期化済みか（鍵ペアの指紋） */
let vapidInitializedKey: string | null = null;

/**
 * メタ更新後に VAPID 設定を再読み込みする。
 *
 * @internal
 */
export function resetPushVapidDetails(): void {
	vapidInitializedKey = null;
}

async function ensureVapidDetails(): Promise<boolean> {
	const meta = await fetchMeta();
	if (
		!meta.enableServiceWorker ||
		meta.swPublicKey == null ||
		meta.swPrivateKey == null
	) {
		return false;
	}

	const keyFingerprint = `${meta.swPublicKey}:${meta.swPrivateKey}`;
	if (vapidInitializedKey !== keyFingerprint) {
		let vapidSubject = config.url;
		if (!config.url.startsWith("https://")) {
			try {
				vapidSubject = `mailto:admin@${new URL(config.url).hostname}`;
			} catch {
				vapidSubject = "mailto:noreply@localhost";
			}
		}
		if (meta.maintainerEmail != null && meta.maintainerEmail !== "") {
			vapidSubject = `mailto:${meta.maintainerEmail}`;
		}
		push.setVapidDetails(vapidSubject, meta.swPublicKey, meta.swPrivateKey);
		vapidInitializedKey = keyFingerprint;
	}
	return true;
}

/**
 * プッシュペイロード用にノート本文を要約し、不要フィールドを落とす。
 *
 * @remarks
 * {@link attachDisplayTextToNotification} より後に呼ぶこと。
 * 先に truncate すると `note.text` が要約済みのまま `files` が残り、
 * displayBody 生成時に添付数が二重付与される。
 *
 * @param notification - displayTitle/Body 付与済みの pack 通知
 * @internal
 */
export function truncateNotification(notification: Packed<"Notification">): any {
	// renote の「表示」action 用に RT 先 noteId をトップレベルにも保持する
	const renoteTargetNoteId =
		notification.type === "renote" && notification.note != null
			? notification.note.renoteId ??
				(notification.note.renote as { id?: string } | null | undefined)?.id
			: undefined;
	// R5 の「表示」action 用 noteId（notification.data から note が落ちても残す）
	const viewNoteId =
		notification.type === "reaction" &&
		typeof notification.note?.id === "string"
			? notification.note.id
			: typeof renoteTargetNoteId === "string"
				? renoteTargetNoteId
				: undefined;

	if (notification.note) {
		// reaction 用: SW ローカル解決の保険として name+url のみ残す
		const reactionEmojis =
			notification.type === "reaction" &&
			Array.isArray(
				(notification.note as { reactionEmojis?: unknown }).reactionEmojis,
			)
				? (
						(notification.note as { reactionEmojis: unknown[] })
							.reactionEmojis as Array<{ name?: unknown; url?: unknown }>
					)
						.filter(
							(e) =>
								typeof e.name === "string" && typeof e.url === "string",
						)
						.map((e) => ({ name: e.name as string, url: e.url as string }))
				: undefined;

		// displayBody があれば SW フォールバックの note.text と一致させる
		const displayBody = (notification as { displayBody?: string }).displayBody;
		const summarizedText =
			typeof displayBody === "string"
				? displayBody
				: getNoteSummary(
						notification.type === "renote"
							? (notification.note.renote as Packed<"Note">)
							: notification.note,
					);

		return {
			...notification,
			...(typeof renoteTargetNoteId === "string"
				? { renoteTargetNoteId }
				: {}),
			...(typeof viewNoteId === "string" ? { viewNoteId } : {}),
			note: {
				...notification.note,
				text: summarizedText,
				cw: undefined,
				files: undefined,
				poll: undefined,
				reply: undefined,
				renote: undefined,
				user: undefined as any,
				...(reactionEmojis != null && reactionEmojis.length > 0
					? { reactionEmojis }
					: {}),
			},
		};
	}
	return notification;
}

/**
 * SW の compose 用に notifier ユーザーを最小フィールドに縮小する。
 *
 * @param user - pack 済みユーザ
 * @returns 最小ユーザオブジェクト、または undefined
 * @internal
 */
function minimalPushUser(
	user: unknown,
): { id: string; username: string; name: string | null; avatarUrl: string | null } | undefined {
	if (user == null || typeof user !== "object") return undefined;
	const u = user as Record<string, unknown>;
	if (typeof u.id !== "string" || typeof u.username !== "string") {
		return undefined;
	}
	return {
		id: u.id,
		username: u.username,
		name: typeof u.name === "string" ? u.name : u.name == null ? null : String(u.name),
		avatarUrl:
			typeof u.avatarUrl === "string"
				? u.avatarUrl
				: u.avatarUrl == null
					? null
					: String(u.avatarUrl),
	};
}

/**
 * 4KB 超過時の通知ペイロード最小形（SW 表示に user を残す）。
 *
 * @param minimal - truncate 後の通知オブジェクト
 * @returns プッシュ用の最小通知
 * @internal
 */
export function buildMinimalNotificationPayloadForPush(
	minimal: Record<string, unknown>,
): Record<string, unknown> {
	const userId =
		typeof minimal.userId === "string"
			? minimal.userId
			: typeof minimal.notifierId === "string"
				? minimal.notifierId
				: undefined;
	const user = minimalPushUser(minimal.user);

	const note = minimal.note as
		| {
				id?: string;
				userId?: string;
				reactionEmojis?: Array<{ name: string; url: string }>;
		  }
		| null
		| undefined;
	const minimalReactionEmojis =
		note != null && Array.isArray(note.reactionEmojis)
			? note.reactionEmojis.filter(
					(e) => typeof e.name === "string" && typeof e.url === "string",
				)
			: undefined;
	const minimalNote =
		note != null && typeof note.id === "string"
			? {
					id: note.id,
					...(typeof note.userId === "string" ? { userId: note.userId } : {}),
					...(minimalReactionEmojis != null &&
					minimalReactionEmojis.length > 0
						? { reactionEmojis: minimalReactionEmojis }
						: {}),
				}
			: undefined;

	return {
		id: minimal.id,
		type: minimal.type,
		header: minimal.header,
		body: minimal.body,
		...(userId != null ? { userId } : {}),
		...(user != null ? { user } : {}),
		...(minimalNote != null ? { note: minimalNote } : {}),
		...(typeof minimal.renoteTargetNoteId === "string"
			? { renoteTargetNoteId: minimal.renoteTargetNoteId }
			: {}),
		...(typeof minimal.viewNoteId === "string"
			? { viewNoteId: minimal.viewNoteId }
			: {}),
		...(typeof minimal.displayImageUrl === "string"
			? { displayImageUrl: minimal.displayImageUrl }
			: {}),
		...(typeof minimal.displayTitle === "string"
			? { displayTitle: minimal.displayTitle }
			: {}),
		...(typeof minimal.displayBody === "string"
			? { displayBody: minimal.displayBody }
			: {}),
		...(typeof minimal.reaction === "string"
			? { reaction: minimal.reaction }
			: {}),
		...(typeof minimal.defaultReaction === "string"
			? { defaultReaction: minimal.defaultReaction }
			: {}),
		...(typeof minimal.reactionIconUrl === "string"
			? { reactionIconUrl: minimal.reactionIconUrl }
			: {}),
		...(typeof minimal.reactionBadgeUrl === "string"
			? { reactionBadgeUrl: minimal.reactionBadgeUrl }
			: {}),
	};
}

/**
 * pack 済み通知の実効種別（unreadAntenna が `note` になるケースを補正）。
 *
 * @param notification - 通知オブジェクト
 * @internal
 */
export function resolveEffectiveNotificationType(
	notification: Record<string, unknown>,
): string {
	const type = notification.type;
	if (typeof type !== "string") return "unknown";
	if (
		type === "note" &&
		typeof notification.reaction === "string" &&
		notification.reaction.length > 0
	) {
		return "unreadAntenna";
	}
	return type;
}

/**
 * プッシュ用に `displayTitle` / `displayBody` を付与する。
 *
 * @param notification - truncate 後の通知
 * @param defaultReaction - 既定リアクション
 * @internal
 */
export function attachDisplayTextToNotification(
	notification: Record<string, unknown>,
	defaultReaction: string,
): Record<string, unknown> {
	const note = notification.note as
		| Parameters<typeof resolveNotificationDisplayText>[0]["note"]
		| undefined;
	const user = notification.user as NotificationDisplayUser | undefined;
	const effectiveType = resolveEffectiveNotificationType(notification);

	const resolved = resolveNotificationDisplayText({
		type: effectiveType,
		user,
		note,
		reaction:
			typeof notification.reaction === "string"
				? notification.reaction
				: undefined,
		antennaName:
			typeof notification.reaction === "string"
				? notification.reaction
				: undefined,
		notifierUser: (note as { user?: NotificationDisplayUser } | undefined)
			?.user,
		defaultReaction,
	});

	if (resolved == null) {
		return notification;
	}

	return { ...notification, ...resolved };
}

/**
 * DM プッシュ用に表示テキストを付与する。
 *
 * @param message - メッセージ pack
 * @internal
 */
export function attachDisplayTextToMessagingMessage(
	message: Record<string, unknown>,
): Record<string, unknown> {
	const user = message.user as NotificationDisplayUser | undefined;
	const group = message.group as { name?: string } | null | undefined;

	const resolved = resolveMessagingDisplayText({
		user,
		groupName: group?.name,
		text: typeof message.text === "string" ? message.text : undefined,
	});

	if (resolved == null) {
		return message;
	}

	return { ...message, ...resolved };
}

/**
 * プッシュ用に `displayImageUrl` を付与する（Webhook と同じ選定）。
 *
 * @param notification - truncate 後の通知
 * @param defaultReaction - インスタンス既定リアクション
 * @remarks
 * `reaction` 種別は `icon` でリアクション画像を出すため、ここでは `displayImageUrl` を付けない。
 * @internal
 */
export function attachDisplayImageUrlToNotification(
	notification: Record<string, unknown>,
	defaultReaction: string,
): Record<string, unknown> {
	// NOTE: reaction は icon / badge で絵文字を出すため image 用 URL は付与しない
	if (notification.type === "reaction") {
		return notification;
	}

	const note = notification.note as
		| Parameters<typeof resolveNoteNotificationDisplayImageUrl>[0]
		| undefined;
	if (note == null) {
		return notification;
	}

	const displayImageUrl = resolveNoteNotificationDisplayImageUrl(note, {
		reaction:
			typeof notification.reaction === "string"
				? notification.reaction
				: undefined,
		defaultReaction,
	});

	if (displayImageUrl == null) {
		return notification;
	}

	return { ...notification, displayImageUrl };
}

/**
 * DM プッシュ用に `displayImageUrl` を付与する。
 *
 * @param message - truncate 前後のメッセージ pack
 * @internal
 */
export function attachDisplayImageUrlToMessagingMessage(
	message: Record<string, unknown>,
): Record<string, unknown> {
	const displayImageUrl = resolveMessagingNotificationDisplayImageUrl(
		message as Parameters<typeof resolveMessagingNotificationDisplayImageUrl>[0],
		typeof (message as { emoji?: { publicUrl?: string } }).emoji?.publicUrl ===
			"string"
			? (message as { emoji: { publicUrl: string } }).emoji.publicUrl
			: undefined,
	);

	if (displayImageUrl == null) {
		return message;
	}

	return { ...message, displayImageUrl };
}

/**
 * リアクション通知プッシュ用に icon/badge 解決結果を付与する。
 *
 * @param notification - truncate 後の通知
 * @param defaultReaction - インスタンス既定リアクション
 * @internal
 */
export function attachReactionPushDisplayExtras(
	notification: Record<string, unknown>,
	defaultReaction: string,
): Record<string, unknown> {
	if (notification.type !== "reaction") {
		return notification;
	}

	const reaction =
		typeof notification.reaction === "string"
			? notification.reaction
			: undefined;
	const note = notification.note as
		| Parameters<typeof resolveReactionNotificationIconUrl>[1]
		| undefined;

	const enriched: Record<string, unknown> = {
		...notification,
		defaultReaction,
	};

	if (reaction == null) {
		return enriched;
	}

	const reactionIconUrl = resolveReactionNotificationIconUrl(
		reaction,
		note,
		defaultReaction,
	);
	if (reactionIconUrl != null) {
		enriched.reactionIconUrl = reactionIconUrl;
	}

	const reactionBadgeUrl = resolveReactionNotificationBadgeUrl(
		reaction,
		note,
		defaultReaction,
	);
	if (reactionBadgeUrl != null) {
		enriched.reactionBadgeUrl = reactionBadgeUrl;
	}

	return enriched;
}

/**
 * プッシュペイロードから通知元ユーザ ID を取り出す（プッシュミュート判定用）。
 *
 * @param type - プッシュ種別
 * @param body - ペイロード本体
 * @returns 通知元ユーザ ID。判定不要なら undefined
 * @internal
 */
export function extractNotifierIdForPushMute(
	type: keyof pushNotificationsTypes,
	body: unknown,
): string | undefined {
	if (body == null || typeof body !== "object") return undefined;

	const record = body as Record<string, unknown>;

	if (type === "notification") {
		if (typeof record.userId === "string") return record.userId;
		return undefined;
	}

	if (type === "unreadMessagingMessage") {
		if (typeof record.userId === "string") return record.userId;
		const user = record.user;
		if (user != null && typeof user === "object") {
			const userId = (user as { id?: unknown }).id;
			if (typeof userId === "string") return userId;
		}
	}

	return undefined;
}

/**
 * 通知先が通知元のプッシュ通知をミュートしているか。
 *
 * @param notifieeId - 通知先ユーザ ID
 * @param notifierId - 通知元ユーザ ID
 * @returns ミュート中なら true
 * @internal
 */
export async function isNotifierPushMuted(
	notifieeId: string,
	notifierId: string,
): Promise<boolean> {
	if (notifieeId === notifierId) return false;

	try {
		const muting = await Mutings.findOne({
			where: {
				muterId: notifieeId,
				muteeId: notifierId,
			},
		});
		return muting != null && hasMuteScope(muting.scope, "push");
	} catch {
		// NOTE: テーブル未作成・DB 障害時はプッシュを止めない（フェイルセーフ）
		return false;
	}
}

async function buildPayload<T extends keyof pushNotificationsTypes>(
	userId: string,
	type: T,
	body: pushNotificationsTypes[T],
): Promise<string> {
	let truncatedBody: pushNotificationsTypes[T] = body;

	if (type === "notification" && truncatedBody != null && typeof truncatedBody === "object") {
		const meta = await fetchMeta();
		// NOTE: 表示テキスト・画像 URL は生ノート（files / user 付き）で解決してから truncate する
		let enriched = attachDisplayImageUrlToNotification(
			truncatedBody as Record<string, unknown>,
			meta.defaultReaction,
		);
		enriched = attachDisplayTextToNotification(enriched, meta.defaultReaction);
		enriched = attachReactionPushDisplayExtras(
			enriched,
			meta.defaultReaction,
		);
		enriched = truncateNotification(
			enriched as Packed<"Notification">,
		) as Record<string, unknown>;
		truncatedBody = enriched as pushNotificationsTypes[T];
	}

	if (
		type === "unreadMessagingMessage" &&
		truncatedBody != null &&
		typeof truncatedBody === "object"
	) {
		let enriched = attachDisplayImageUrlToMessagingMessage(
			truncatedBody as Record<string, unknown>,
		);
		enriched = attachDisplayTextToMessagingMessage(enriched);
		truncatedBody = enriched as pushNotificationsTypes[T];
	}

	const buildJson = () =>
		JSON.stringify({
			type,
			body: truncatedBody,
			userId,
			dateTime: Date.now(),
		});

	let payload = buildJson();

	// 4KB 制限: 段階的にペイロードを削減する
	if (Buffer.byteLength(payload, "utf8") > MAX_PUSH_PAYLOAD_BYTES) {
		if (
			type === "notification" &&
			truncatedBody != null &&
			typeof truncatedBody === "object" &&
			"note" in truncatedBody &&
			truncatedBody.note != null
		) {
			const note = truncatedBody.note as { text?: string };
			if (typeof note.text === "string" && note.text.length > 80) {
				note.text = `${note.text.slice(0, 80)}…`;
				truncatedBody = { ...truncatedBody, note: { ...note } };
				payload = buildJson();
			}
		}
	}

	// 2 段目: まだ超過なら note 本体を落としヘッダ/種別のみ送る
	if (Buffer.byteLength(payload, "utf8") > MAX_PUSH_PAYLOAD_BYTES) {
		if (
			type === "notification" &&
			truncatedBody != null &&
			typeof truncatedBody === "object"
		) {
			const minimal = truncatedBody as Record<string, unknown>;
			truncatedBody = buildMinimalNotificationPayloadForPush(
				minimal,
			) as pushNotificationsTypes[T];
			payload = buildJson();
		}
	}

	return payload;
}

async function sendToSubscription(
	userId: string,
	type: keyof pushNotificationsTypes,
	payload: string,
	subscription: {
		endpoint: string;
		auth: string;
		publickey: string;
	},
): Promise<void> {
	const pushSubscription = {
		endpoint: subscription.endpoint,
		keys: {
			auth: subscription.auth,
			p256dh: subscription.publickey,
		},
	};

	const endpointHash = hashPushEndpoint(subscription.endpoint);

	try {
		// web-push 3.x は top-level `urgency` 非対応。RFC 8030 の Urgency ヘッダで指定する。
		const isHighPriority =
			type === "notification" || type === "unreadMessagingMessage";
		const sendOptions: Parameters<typeof push.sendNotification>[2] = {
			proxy: config.proxy,
			TTL: isHighPriority ? 86400 : 300,
			headers: {
				Urgency: isHighPriority ? "high" : "normal",
			},
		};

		await Promise.race([
			push.sendNotification(pushSubscription, payload, sendOptions),
			new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error("push-send-timeout")), SEND_TIMEOUT_MS);
			}),
		]);

		void logPushSend(userId, {
			type,
			endpointHash,
			ok: true,
			payloadSize: Buffer.byteLength(payload, "utf8"),
		});
	} catch (err: any) {
		const statusCode = err?.statusCode;
		void logPushSend(userId, {
			type,
			endpointHash,
			ok: false,
			statusCode,
			errorMsg: err?.message ?? String(err),
			payloadSize: Buffer.byteLength(payload, "utf8"),
		});

		// 410 Gone のみ購読削除（404 は本家同様に削除しない）
		if (statusCode === 410) {
			await SwSubscriptions.delete({
				userId,
				endpoint: subscription.endpoint,
				auth: subscription.auth,
				publickey: subscription.publickey,
			});
			await invalidateSwSubscriptionsCache(userId);
			void logPushSubscriptionChange(userId, {
				event: "unregister-by-410",
				cause: "web-push-error",
				endpointHash,
			});
			logger.warn(
				`購読が無効でした (status=410)。削除しました: ${endpointHash}`,
			);
			return;
		}

		logger.error(
			`プッシュ通知送信に失敗しました (status=${statusCode ?? "unknown"})`,
		);
		logger.error(err);
	}
}

/**
 * プッシュ通知を送信する。
 *
 * @param userId - 送信先ユーザー ID
 * @param type - 通知種別
 * @param body - ペイロード本体
 * @remarks
 * read* 系はストリーム同期に移行済みのため no-op。
 * @internal
 */
export async function pushNotification<T extends keyof pushNotificationsTypes>(
	userId: string,
	type: T,
	body: pushNotificationsTypes[T],
): Promise<void> {
	// read* 系は push では送らない（ストリーム + SW postMessage で同期）
	if ((PUSH_READ_SYNC_TYPES as readonly string[]).includes(type)) {
		return;
	}

	const notifierId = extractNotifierIdForPushMute(type, body);
	if (
		notifierId != null &&
		(await isNotifierPushMuted(userId, notifierId))
	) {
		return;
	}

	if (!(await ensureVapidDetails())) {
		logger.warn("Service Worker の設定が無効なため、プッシュ通知をスキップします。");
		return;
	}

	const subscriptions = await getSwSubscriptionsByUserId(userId);
	if (subscriptions.length === 0) return;

	const payload = await buildPayload(userId, type, body);

	const tasks = subscriptions.map((subscription) =>
		sendToSubscription(userId, type, payload, subscription),
	);

	await Promise.allSettled(tasks);
}
