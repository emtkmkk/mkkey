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
import { SwSubscriptions } from "@/models/index.js";
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

// プッシュメッセージサーバーには文字数制限があるため、内容を削減します
function truncateNotification(notification: Packed<"Notification">): any {
	if (notification.note) {
		return {
			...notification,
			note: {
				...notification.note,
				text: getNoteSummary(
					notification.type === "renote"
						? (notification.note.renote as Packed<"Note">)
						: notification.note,
				),
				cw: undefined,
				reply: undefined,
				renote: undefined,
				user: undefined as any,
			},
		};
	}
	return notification;
}

function buildPayload<T extends keyof pushNotificationsTypes>(
	userId: string,
	type: T,
	body: pushNotificationsTypes[T],
): string {
	let truncatedBody =
		type === "notification"
			? truncateNotification(body as Packed<"Notification">)
			: body;

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
			truncatedBody = {
				id: minimal.id,
				type: minimal.type,
				header: minimal.header,
				body: minimal.body,
			} as pushNotificationsTypes[T];
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

	if (!(await ensureVapidDetails())) {
		logger.warn("Service Worker の設定が無効なため、プッシュ通知をスキップします。");
		return;
	}

	const subscriptions = await getSwSubscriptionsByUserId(userId);
	if (subscriptions.length === 0) return;

	const payload = buildPayload(userId, type, body);

	const tasks = subscriptions.map((subscription) =>
		sendToSubscription(userId, type, payload, subscription),
	);

	await Promise.allSettled(tasks);
}
