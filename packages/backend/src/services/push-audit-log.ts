/**

 * @packageDocumentation

 *

 * プッシュ通知の監査ログ（dev モードユーザー向け・インメモリリングバッファ）。

 *

 * @remarks

 * NOTE: 不意な購読解除の追跡が主目的。endpoint はハッシュのみ保持する。

 * NOTE: ユーザーごとに FIFO を維持し、1 人の大量ログで他ユーザーの履歴が消えないようにする。

 *

 * @internal

 */

import { createHash } from "node:crypto";

import type { User } from "@/models/entities/user.js";

import { isDeveloperUser } from "@/misc/is-developer-user.js";



const PER_USER_LIMIT = 100;

const GLOBAL_LIMIT = 2000;



export type PushAuditLogKind = "send" | "subscription";



export type PushSubscriptionChangeEvent =

	| "register"

	| "update"

	| "unregister-by-user"

	| "unregister-by-logout"

	| "unregister-by-410"

	| "unregister-by-404"

	| "unregister-by-cascade";



export type PushSubscriptionChangeCause =

	| "api-call"

	| "web-push-error"

	| "pushsubscriptionchange"

	| "unknown";



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

			payloadSize?: number;

	  }

	| {

			at: number;

			userId: User["id"];

			kind: "subscription";

			event: PushSubscriptionChangeEvent;

			cause: PushSubscriptionChangeCause;

			endpointHash: string;

	  };



/** 全ユーザー横断の新着順参照用（GLOBAL_LIMIT でトリム） */

const globalBuffer: PushAuditLogEntry[] = [];



/** ユーザー単位の FIFO（PER_USER_LIMIT でトリム） */

const perUserBuffers = new Map<User["id"], PushAuditLogEntry[]>();



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



function trimGlobalBuffer(): void {

	while (globalBuffer.length > GLOBAL_LIMIT) {

		const removed = globalBuffer.shift();

		if (removed == null) break;

		const userBuf = perUserBuffers.get(removed.userId);

		if (userBuf != null) {

			const idx = userBuf.indexOf(removed);

			if (idx >= 0) userBuf.splice(idx, 1);

		}

	}

}



function append(entry: PushAuditLogEntry): void {

	globalBuffer.push(entry);



	let userBuf = perUserBuffers.get(entry.userId);

	if (userBuf == null) {

		userBuf = [];

		perUserBuffers.set(entry.userId, userBuf);

	}

	userBuf.push(entry);

	while (userBuf.length > PER_USER_LIMIT) {

		const removed = userBuf.shift();

		if (removed == null) break;

		const globalIdx = globalBuffer.indexOf(removed);

		if (globalIdx >= 0) globalBuffer.splice(globalIdx, 1);

	}



	trimGlobalBuffer();

}



/**

 * dev モードユーザーの送信ログを記録する。

 *

 * @internal

 */

export async function logPushSend(

	userId: User["id"],

	params: Omit<Extract<PushAuditLogEntry, { kind: "send" }>, "at" | "userId" | "kind">,

): Promise<void> {

	if (!(await isDeveloperUser(userId))) return;

	append({ at: Date.now(), userId, kind: "send", ...params });

}



/**

 * dev モードユーザーの購読変更ログを記録する。

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

	if (!(await isDeveloperUser(userId))) return;

	append({ at: Date.now(), userId, kind: "subscription", ...params });

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



	const userBuf = perUserBuffers.get(userId) ?? [];



	const filtered = userBuf.filter((e) => {

		if (e.at < since) return false;

		if (kind !== "all" && e.kind !== kind) return false;

		return true;

	});



	return filtered.slice(-limit).reverse();

}
