/**
 * @packageDocumentation
 *
 * プッシュ通知の監査ログ。
 *
 * @remarks
 * - **なぜ Redis なのか**: web ワーカーが複数あるため、プロセス内バッファだと
 *   記録したワーカーと `i/push-log` を処理するワーカーが一致せず、
 *   取得のたびに内容が変わっていた。再起動でも消えていた。
 * - **なぜ skip を残すのか**: 「通知が来ない」の原因はほとんどが送信前の
 *   早期 return（ミュート・既読・購読なし等）で、送信ログだけ見ても何も分からない。
 * - endpoint はハッシュのみ保持する。
 * - 記録は全ユーザー分行い、**閲覧のみ** dev モードに限定する。
 *   ただし容量のため、成功ログだけは dev ユーザーに限る（{@link shouldRecord}）。
 *
 * @internal
 */
import { createHash } from "node:crypto";
import { redisClient } from "@/db/redis.js";
import type { User } from "@/models/entities/user.js";
import { isDeveloperUser } from "@/misc/is-developer-user.js";

/** ユーザーごとの保持件数 */
const PER_USER_LIMIT = 200;

/** ログの保持期間 */
const TTL_SECONDS = 60 * 60 * 24 * 7;

export type PushAuditLogKind = "send" | "subscription" | "skip";

export type PushSubscriptionChangeEvent =
	| "register"
	| "update"
	| "unregister-by-user"
	| "unregister-by-logout"
	| "unregister-by-410"
	| "unregister-by-404"
	| "unregister-by-unresolvable"
	| "unregister-by-cascade";

export type PushSubscriptionChangeCause =
	| "api-call"
	| "web-push-error"
	| "pushsubscriptionchange"
	| "unknown";

/**
 * プッシュを送信しなかった理由。
 *
 * @remarks
 * 「来なかった」の切り分けに直結するので、増やすときは
 * クライアントの表示ラベルも合わせて更新すること。
 */
export type PushSkipReason =
	/** read* 系はストリーム同期に移行済み */
	| "read-sync"
	/** 通知元をプッシュミュートしている */
	| "push-muted"
	/** Service Worker 無効、または VAPID 未設定 */
	| "vapid-disabled"
	/** 購読が 1 件も無い */
	| "no-subscriptions"
	/** 3 秒の猶予内に既読が付いた */
	| "already-read"
	/** ユーザミュート・インスタンスミュート・サスペンド */
	| "not-deliverable";

export type PushAuditLogEntry =
	| {
			at: number;
			userId: User["id"];
			kind: "send";
			type: string;
			endpointHash: string;
			ok: boolean;
			statusCode?: number;
			errorMsg?: string;
			durationMs?: number;
			payloadSize?: number;
	  }
	| {
			at: number;
			userId: User["id"];
			kind: "subscription";
			event: PushSubscriptionChangeEvent;
			cause: PushSubscriptionChangeCause;
			endpointHash: string;
	  }
	| {
			at: number;
			userId: User["id"];
			kind: "skip";
			reason: PushSkipReason;
			type?: string;
			notificationId?: string;
	  };

function logKey(userId: User["id"]): string {
	return `pushLog:${userId}`;
}

/**
 * endpoint URL をマスク用ハッシュに変換する。
 *
 * @param endpoint - Push subscription endpoint
 * @returns 先頭8+末尾4文字の短い識別子
 * @internal
 */
export function hashPushEndpoint(endpoint: string): string {
	const digest = createHash("sha256").update(endpoint).digest("hex").slice(0, 16);
	if (endpoint.length <= 12) return digest;
	return `${digest}:${endpoint.slice(0, 4)}…${endpoint.slice(-4)}`;
}

/**
 * このエントリを記録すべきか。
 *
 * @remarks
 * 失敗・skip・購読変更は全ユーザー分残す（不具合報告を後から追うため）。
 * 成功ログだけは件数が多いので dev ユーザーに限る。
 *
 * @internal
 */
async function shouldRecord(
	userId: User["id"],
	entry: PushAuditLogEntry,
): Promise<boolean> {
	if (entry.kind === "send" && entry.ok) {
		return await isDeveloperUser(userId);
	}
	return true;
}

async function append(entry: PushAuditLogEntry): Promise<void> {
	try {
		if (!(await shouldRecord(entry.userId, entry))) return;

		const key = logKey(entry.userId);
		await redisClient
			.multi()
			.lpush(key, JSON.stringify(entry))
			.ltrim(key, 0, PER_USER_LIMIT - 1)
			.expire(key, TTL_SECONDS)
			.exec();
	} catch {
		// NOTE: 監査ログの失敗でプッシュ本体を止めない
	}
}

/**
 * 送信結果を記録する。
 *
 * @internal
 */
export async function logPushSend(
	userId: User["id"],
	params: Omit<Extract<PushAuditLogEntry, { kind: "send" }>, "at" | "userId" | "kind">,
): Promise<void> {
	await append({ at: Date.now(), userId, kind: "send", ...params });
}

/**
 * 購読変更を記録する。
 *
 * @internal
 */
export async function logPushSubscriptionChange(
	userId: User["id"],
	params: Omit<
		Extract<PushAuditLogEntry, { kind: "subscription" }>,
		"at" | "userId" | "kind"
	>,
): Promise<void> {
	await append({ at: Date.now(), userId, kind: "subscription", ...params });
}

/**
 * プッシュを送らなかったことを記録する。
 *
 * @remarks
 * 「通知が来ない」の原因の大半はここに出る。
 *
 * @internal
 */
export async function logPushSkip(
	userId: User["id"],
	params: Omit<Extract<PushAuditLogEntry, { kind: "skip" }>, "at" | "userId" | "kind">,
): Promise<void> {
	await append({ at: Date.now(), userId, kind: "skip", ...params });
}

/**
 * ユーザーの監査ログを取得する（dev モードのみ）。
 *
 * @param userId - 対象ユーザー
 * @param options - フィルタ
 * @returns ログ配列（新しい順）
 * @internal
 */
export async function getPushAuditLogs(
	userId: User["id"],
	options: {
		limit?: number;
		since?: number;
		kind?: PushAuditLogKind | "all";
	} = {},
): Promise<PushAuditLogEntry[]> {
	if (!(await isDeveloperUser(userId))) {
		return [];
	}

	const limit = Math.min(options.limit ?? 50, PER_USER_LIMIT);
	const since = options.since ?? 0;
	const kind = options.kind ?? "all";

	let raw: string[];
	try {
		raw = await redisClient.lrange(logKey(userId), 0, PER_USER_LIMIT - 1);
	} catch {
		return [];
	}

	const entries: PushAuditLogEntry[] = [];
	for (const line of raw) {
		let entry: PushAuditLogEntry;
		try {
			entry = JSON.parse(line) as PushAuditLogEntry;
		} catch {
			continue;
		}
		if (entry.at < since) continue;
		if (kind !== "all" && entry.kind !== kind) continue;
		entries.push(entry);
		if (entries.length >= limit) break;
	}

	// LPUSH なので Redis の並びが既に新しい順
	return entries;
}
