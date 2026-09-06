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
import type * as https from "node:https";
import push from "web-push";
import config from "@/config/index.js";
import { httpsAgent } from "@/misc/fetch.js";
import { redisClient } from "@/db/redis.js";
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
	logPushSkip,
	logPushSubscriptionChange,
	type PushSkipReason,
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

/** 購読 1 件への送信結果 */
export type PushSendResult = {
	endpointHash: string;
	ok: boolean;
	statusCode?: number;
	errorMsg?: string;
	durationMs?: number;
	/** 送信失敗を受けて購読を削除したときの理由 */
	removed?: "410" | "unresolvable";
};

/**
 * {@link pushNotification} の結果。
 *
 * @remarks
 * 通常の呼び出し元は無視してよい。`i/test-push-notification` が
 * 「送ったつもりで全滅している」状態を検知するために使う。
 */
export type PushDeliveryReport = {
	/** 1 件でも成功したか。skip / 購読なしのときは false */
	ok: boolean;
	/** 送信を試みた購読数 */
	attempted: number;
	results: PushSendResult[];
	/** 送信自体を行わなかったときの理由 */
	skipped?: PushSkipReason;
};

const logger = new Logger("push-notification", "yellow");

const SEND_TIMEOUT_MS = 15_000;

/** Web Push ペイロード上限（バイト） */
const MAX_PUSH_PAYLOAD_BYTES = 3800;

/** 名前解決不能が続いた購読を削除するまでの連続失敗回数 */
const UNRESOLVABLE_FAILURE_THRESHOLD = 8;

/** 初回失敗からこれだけ経過していないと削除しない（DNS 障害の巻き添え防止） */
const UNRESOLVABLE_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** 失敗カウンタの保持期間。この間に閾値へ達しなければ数え直し */
const UNRESOLVABLE_TTL_SECONDS = 60 * 60 * 24 * 30;

function unresolvableCounterKey(userId: string, endpointHash: string): string {
	// endpointHash は "<hex>:<前4>…<後4>" 形式。キーには hex 部分だけ使う
	return `pushUnresolvable:${userId}:${endpointHash.split(":")[0]}`;
}

/**
 * 「宛先ホストが名前解決できない」エラーか。
 *
 * @remarks
 * NOTE: `EAI_AGAIN`（一時的な解決失敗）は意図的に含めない。リゾルバ障害で
 * 全ユーザーの購読を巻き添えに削除しないため、恒久的な NXDOMAIN のみ数える。
 *
 * @param err - web-push が投げたエラー
 * @internal
 */
export function isUnresolvableHostError(err: unknown): boolean {
	if (err == null || typeof err !== "object") return false;

	if ((err as { code?: unknown }).code === "ENOTFOUND") return true;

	const message = (err as { message?: unknown }).message;
	return typeof message === "string" && message.includes("ENOTFOUND");
}

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

/**
 * VAPID の `sub` に使えるメールアドレスか。
 *
 * @remarks
 * web-push は `mailto:` の接頭辞しか検証しないため、ここで中身を担保する。
 * Apple の Web Push は `sub` の形式に厳格で、不正だと 403 を返す。
 *
 * @param value - 検証する文字列
 * @internal
 */
export function isValidVapidContactEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * VAPID の subject を決める。
 *
 * @remarks
 * CHANGED: `maintainerEmail` は使わない。Fediverse ハンドル等が入っていることがあり、
 * `mailto:` を前置すると不正な URI になって Apple が 403 を返すため、
 * 専用の `swContactEmail` に分離した。未設定・不正なら `config.url` へフォールバックする。
 *
 * @param swContactEmail - meta の連絡先メールアドレス
 * @internal
 */
export function resolveVapidSubject(swContactEmail: string | null): string {
	if (swContactEmail != null && isValidVapidContactEmail(swContactEmail)) {
		return `mailto:${swContactEmail}`;
	}

	if (config.url.startsWith("https://")) {
		return config.url;
	}

	try {
		return `mailto:admin@${new URL(config.url).hostname}`;
	} catch {
		return "mailto:noreply@localhost";
	}
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

	const vapidSubject = resolveVapidSubject(meta.swContactEmail);
	// NOTE: subject も指紋に含める。meta のポーリング更新だけで全ワーカーが追従する
	const keyFingerprint = `${meta.swPublicKey}:${meta.swPrivateKey}:${vapidSubject}`;
	if (vapidInitializedKey !== keyFingerprint) {
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

/**
 * 名前解決不能な購読の連続失敗を数え、閾値を超えたら削除する。
 *
 * @param userId - 送信先ユーザー ID
 * @param endpointHash - ログ用の endpoint ハッシュ
 * @param subscription - 削除対象の購読
 * @returns 削除したとき true
 * @internal
 */
async function recordUnresolvableFailure(
	userId: string,
	endpointHash: string,
	subscription: { endpoint: string; auth: string; publickey: string },
): Promise<boolean> {
	const key = unresolvableCounterKey(userId, endpointHash);
	const now = Date.now();

	let count: number;
	let firstAt: number;
	try {
		const results = await redisClient
			.multi()
			.hsetnx(key, "firstAt", String(now))
			.hincrby(key, "count", 1)
			.expire(key, UNRESOLVABLE_TTL_SECONDS)
			.hget(key, "firstAt")
			.exec();

		if (results == null) return false;
		count = Number(results[1]?.[1] ?? 0);
		firstAt = Number(results[3]?.[1] ?? now);
	} catch {
		// NOTE: Redis 障害時は削除しない（フェイルセーフ）
		return false;
	}

	if (!Number.isFinite(count) || count < UNRESOLVABLE_FAILURE_THRESHOLD) {
		return false;
	}
	// 短時間に閾値へ達しただけなら、リゾルバ側の一時障害を疑って猶予する
	if (Number.isFinite(firstAt) && now - firstAt < UNRESOLVABLE_MIN_AGE_MS) {
		return false;
	}

	await SwSubscriptions.delete({
		userId,
		endpoint: subscription.endpoint,
		auth: subscription.auth,
		publickey: subscription.publickey,
	});
	await invalidateSwSubscriptionsCache(userId);
	await redisClient.del(key).catch(() => {});

	void logPushSubscriptionChange(userId, {
		event: "unregister-by-unresolvable",
		cause: "web-push-error",
		endpointHash,
	});
	logger.warn(
		`購読先ホストが名前解決できない状態が続いたため削除しました (${count}回): ${endpointHash}`,
	);
	return true;
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
): Promise<PushSendResult> {
	const pushSubscription = {
		endpoint: subscription.endpoint,
		keys: {
			auth: subscription.auth,
			p256dh: subscription.publickey,
		},
	};

	const endpointHash = hashPushEndpoint(subscription.endpoint);
	const startedAt = Date.now();

	try {
		// web-push 3.x は top-level `urgency` 非対応。RFC 8030 の Urgency ヘッダで指定する。
		const isRealtime =
			type === "notification" || type === "unreadMessagingMessage";
		// 告知は即時性は不要だが、オフライン端末にも後から届いてほしいので TTL は長く取る
		const isHighPriority = isRealtime || type === "pushNotice";
		const sendOptions: Parameters<typeof push.sendNotification>[2] = {
			// NOTE: keepAlive で TLS ハンドシェイクを使い回す。httpsAgent は
			// config.proxy の有無を吸収する（hpagent の Agent は https.Agent を継承）。
			// `proxy` と併用すると web-push 側で agent が無視されるので渡さない。
			agent: httpsAgent as https.Agent,
			// NOTE: web-push が実際にリクエストを中断する。Promise.race では
			// 接続が残り、タイマーも解放されなかった。
			timeout: SEND_TIMEOUT_MS,
			TTL: isHighPriority ? 86400 : 300,
			headers: {
				Urgency: isRealtime ? "high" : "normal",
			},
		};

		await push.sendNotification(pushSubscription, payload, sendOptions);

		void logPushSend(userId, {
			type,
			endpointHash,
			ok: true,
			durationMs: Date.now() - startedAt,
			payloadSize: Buffer.byteLength(payload, "utf8"),
		});

		// 成功したら名前解決失敗のカウンタを畳む（連続失敗のみを数えるため）
		void redisClient
			.del(unresolvableCounterKey(userId, endpointHash))
			.catch(() => {});

		return { endpointHash, ok: true, durationMs: Date.now() - startedAt };
	} catch (err: any) {
		const statusCode = err?.statusCode;
		const errorMsg = err?.message ?? String(err);
		const durationMs = Date.now() - startedAt;
		void logPushSend(userId, {
			type,
			endpointHash,
			ok: false,
			statusCode,
			errorMsg,
			durationMs,
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
			return {
				endpointHash,
				ok: false,
				statusCode,
				errorMsg,
				durationMs,
				removed: "410",
			};
		}

		// 名前解決できないホストは status が付かない。連続したら削除する
		if (isUnresolvableHostError(err)) {
			if (await recordUnresolvableFailure(userId, endpointHash, subscription)) {
				return {
					endpointHash,
					ok: false,
					errorMsg,
					durationMs,
					removed: "unresolvable",
				};
			}
		}

		logger.error(
			`プッシュ通知送信に失敗しました (status=${statusCode ?? "unknown"})`,
		);
		logger.error(err);

		return { endpointHash, ok: false, statusCode, errorMsg, durationMs };
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
): Promise<PushDeliveryReport> {
	const notificationId =
		body != null && typeof body === "object"
			? (body as { id?: unknown }).id
			: undefined;

	/** 送信せずに終わるときの共通処理（理由を必ず記録する） */
	const skip = (reason: PushSkipReason): PushDeliveryReport => {
		void logPushSkip(userId, {
			reason,
			type,
			...(typeof notificationId === "string" ? { notificationId } : {}),
		});
		return { ok: false, attempted: 0, results: [], skipped: reason };
	};

	// read* 系は push では送らない（ストリーム + SW postMessage で同期）
	if ((PUSH_READ_SYNC_TYPES as readonly string[]).includes(type)) {
		return skip("read-sync");
	}

	const notifierId = extractNotifierIdForPushMute(type, body);
	if (
		notifierId != null &&
		(await isNotifierPushMuted(userId, notifierId))
	) {
		return skip("push-muted");
	}

	if (!(await ensureVapidDetails())) {
		logger.warn("Service Worker の設定が無効なため、プッシュ通知をスキップします。");
		return skip("vapid-disabled");
	}

	const subscriptions = await getSwSubscriptionsByUserId(userId);
	if (subscriptions.length === 0) {
		return skip("no-subscriptions");
	}

	const payload = await buildPayload(userId, type, body);

	const settled = await Promise.allSettled(
		subscriptions.map((subscription) =>
			sendToSubscription(userId, type, payload, subscription),
		),
	);

	const results: PushSendResult[] = settled.map((r, i) =>
		r.status === "fulfilled"
			? r.value
			: {
					endpointHash: hashPushEndpoint(subscriptions[i].endpoint),
					ok: false,
					errorMsg: String(r.reason),
				},
	);

	return {
		ok: results.some((r) => r.ok),
		attempted: results.length,
		results,
	};
}
