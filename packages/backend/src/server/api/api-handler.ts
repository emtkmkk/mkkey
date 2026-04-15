/**
 * @packageDocumentation
 *
 * API リクエストの認証・実行・エラーレスポンスを担当するハンドラ。
 *
 * @remarks
 * - **役割**: Koa から渡されたエンドポイントと ctx を受け、認証 → call（実行）→ レスポンス返却を行う。
 * - ルーティングは `endpoints.ts` と連携し、パスに応じてこのハンドラが呼ばれる。
 *
 * @see {@link call} エンドポイント実行
 * @see {@link authenticate} 認証
 * @internal
 */
import type Koa from "koa";

import type { User } from "@/models/entities/user.js";
import { UserIps } from "@/models/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import type { IEndpoint } from "./endpoints.js";
import authenticate, { AuthenticationError } from "./authenticate.js";
import call from "./call.js";
import { ApiError } from "./error.js";
import { apiLogger } from "./logger.js";

const userIpHistories = new Map<User["id"], Set<string>>();
const MASKED_HEADER_NAMES = new Set([
	"authorization",
	"cookie",
	"set-cookie",
	"proxy-authorization",
]);
const ERROR_WINDOW_MS = {
	oneMinute: 60 * 1000,
	fiveMinutes: 5 * 60 * 1000,
	oneHour: 60 * 60 * 1000,
} as const;
const errorWindowBuckets = new Map<string, number[]>();
const errorSampleCounters = new Map<string, number>();

setInterval(() => {
	userIpHistories.clear();
}, 1000 * 60 * 60);

/**
 * API リクエストヘッダーを調査用途向けに整形して返す。
 *
 * @remarks
 * NOTE: 機密ヘッダーはマスクしつつ、必要に応じて全ヘッダーを出力できるようにする。
 * @param headers - Koa が受け取ったリクエストヘッダー
 * @returns マスク済みの全ヘッダー情報
 * @internal
 */
function sanitizeHeaders(headers: Koa.Context["headers"]): Record<string, string | string[]> {
	// NOTE: ブロック条件の検討材料にするため、全ヘッダーをキーごとに保持する。
	const sanitized: Record<string, string | string[]> = {};
	for (const [headerName, headerValue] of Object.entries(headers)) {
		const normalizedHeaderName = headerName.toLowerCase();
		if (MASKED_HEADER_NAMES.has(normalizedHeaderName)) {
			sanitized[normalizedHeaderName] = "***masked***";
			continue;
		}

		if (headerValue == null) {
			continue;
		}

		sanitized[normalizedHeaderName] = headerValue;
	}
	return sanitized;
}

/**
 * 調査で頻用するヘッダーだけを抜き出して返す。
 *
 * @remarks
 * NOTE: ダッシュボードやログ閲覧でまず見る項目を固定化することで、追跡時間を短縮する。
 * @param headers - Koa が受け取ったリクエストヘッダー
 * @returns 主要ヘッダーの要約
 * @internal
 */
function extractRoutingHintHeaders(headers: Record<string, string | string[]>) {
	return {
		origin: headers["origin"] ?? null,
		referer: headers["referer"] ?? null,
		userAgent: headers["user-agent"] ?? null,
		cfIpCountry: headers["cf-ipcountry"] ?? null,
		secFetchSite: headers["sec-fetch-site"] ?? null,
		secFetchMode: headers["sec-fetch-mode"] ?? null,
		secFetchDest: headers["sec-fetch-dest"] ?? null,
		xForwardedFor: headers["x-forwarded-for"] ?? null,
	};
}

/**
 * 指定キーのエラー件数を時間窓ごとに集計する。
 *
 * @remarks
 * NOTE: サンプリングで一部ログを間引いても、期間内の発生総数を追えるようにする。
 * @param key - 集計キー（IP + endpoint + method + errorCode）
 * @returns 1分/5分/1時間の件数
 * @internal
 */
function updateErrorWindowCounts(key: string) {
	const now = Date.now();
	const oneHourAgo = now - ERROR_WINDOW_MS.oneHour;
	const currentBucket = errorWindowBuckets.get(key) ?? [];
	const compactedBucket = currentBucket.filter((timestamp) => timestamp >= oneHourAgo);
	compactedBucket.push(now);
	errorWindowBuckets.set(key, compactedBucket);

	return {
		last1m: compactedBucket.filter(
			(timestamp) => timestamp >= now - ERROR_WINDOW_MS.oneMinute,
		).length,
		last5m: compactedBucket.filter(
			(timestamp) => timestamp >= now - ERROR_WINDOW_MS.fiveMinutes,
		).length,
		last1h: compactedBucket.length,
	};
}

/**
 * エラーログを出力するか（サンプリング）を判定する。
 *
 * @remarks
 * NOTE: 初動調査しやすいよう先頭数件は必ず出し、その後は一定間隔で出力する。
 * @param key - 集計キー（IP + endpoint + method + errorCode）
 * @returns true のときログ出力
 * @internal
 */
function shouldEmitErrorLog(key: string) {
	const sampledCount = (errorSampleCounters.get(key) ?? 0) + 1;
	errorSampleCounters.set(key, sampledCount);
	// NOTE: 初回〜3回目は必ず出力し、その後は20件ごとに再出力する。
	return sampledCount <= 3 || sampledCount % 20 === 0;
}

export default (endpoint: IEndpoint, ctx: Koa.Context) =>
	new Promise<void>((res) => {
		// #region リクエスト情報の初期化
		const requestContext = {
			ep: endpoint.name,
			ip: ctx.ip,
			method: ctx.method,
		};
		const sanitizedHeaders = sanitizeHeaders(ctx.headers);
		const routingHintHeaders = extractRoutingHintHeaders(sanitizedHeaders);
		// #endregion

		// #region エラー情報の整形ヘルパー
		const toErrorInfo = (e: unknown) => {
			if (e instanceof Error) {
				return {
					message: e.message,
					code: e.name,
					stack: e.stack,
				};
			}

			return {
				message: "不明なエラー",
				code: "UnknownError",
				raw: e,
			};
		};
		// #endregion

		const body = ctx.is("multipart/form-data")
			? (ctx.request as any).body
			: ctx.method === "GET"
			? ctx.query
			: ctx.request.body;

		const reply = (x?: any, y?: ApiError) => {
			if (x == null) {
				ctx.status = 204;
			} else if (typeof x === "number" && y) {
				ctx.status = x;
				ctx.body = {
					error: {
						message: y!.message,
						code: y!.code,
						id: y!.id,
						kind: y!.kind,
						...(y!.info ? { info: y!.info } : {}),
					},
				};
			} else {
				// 文字列を返す場合は、JSON.stringify通さないとJSONと認識されない
				ctx.body = typeof x === "string" ? JSON.stringify(x) : x;
			}
			res();
		};

		// 認証（GET の場合は body を渡さない。安全でないため）
		authenticate(
			ctx.headers.authorization,
			ctx.method === "GET" ? null : body["i"],
		)
			.then(([user, app]) => {
				// API 実行
				call(endpoint.name, user, app, body, ctx)
					.then((res: any) => {
						if (
							ctx.method === "GET" &&
							endpoint.meta.cacheSec &&
							!body["i"] &&
							!user
						) {
							ctx.set(
								"Cache-Control",
								`public, max-age=${endpoint.meta.cacheSec}`,
							);
						}
						reply(res);
					})
					.catch((e: unknown) => {
						const errorInfo = toErrorInfo(e);
						const errorKey =
							`${requestContext.ip}:${requestContext.ep}:${requestContext.method}:${errorInfo.code}`;
						const errorCounts = updateErrorWindowCounts(errorKey);
						const shouldLog = shouldEmitErrorLog(errorKey);
						if (shouldLog) {
							apiLogger.error("API リクエストに失敗しました。", {
								...requestContext,
								error: errorInfo,
								headers: sanitizedHeaders,
								headerHints: routingHintHeaders,
								sampling: {
									emitted: true,
									key: errorKey,
									totalSeenForKey: errorSampleCounters.get(errorKey),
								},
								errorCounts,
							});
						}

						if (e instanceof ApiError) {
							reply(
								e.httpStatusCode
									? e.httpStatusCode
									: e.kind === "client"
									? 400
									: 500,
								e,
							);
							return;
						}

						reply(
							500,
							new ApiError(null, {
								e: errorInfo,
							}),
						);
					});

				// IP を記録
				if (user) {
					fetchMeta().then((meta) => {
						if (!meta.enableIpLogging) return;
						const ip = ctx.ip;
						const ips = userIpHistories.get(user.id);
						if (ips == null || !ips.has(ip)) {
							if (ips == null) {
								userIpHistories.set(user.id, new Set([ip]));
							} else {
								ips.add(ip);
							}

							try {
								UserIps.createQueryBuilder()
									.insert()
									.values({
										createdAt: new Date(),
										userId: user.id,
										ip: ip,
									})
									.orIgnore(true)
									.execute();
							} catch {}
						}
					});
				}
			})
			.catch((e) => {
				if (e instanceof AuthenticationError) {
					ctx.response.status = 403;
					ctx.response.set("WWW-Authenticate", "Bearer");
					ctx.response.body = {
						message: `Authentication failed: ${e.message}`,
						code: "AUTHENTICATION_FAILED",
						id: "b0a7f5f8-dc2f-4171-b91f-de88ad238e14",
						kind: "client",
					};
					res();
				} else {
					const errorInfo = toErrorInfo(e);
					apiLogger.error("認証フローで予期しないエラーが発生しました。", {
						...requestContext,
						error: errorInfo,
						headers: sanitizedHeaders,
						headerHints: routingHintHeaders,
					});
					reply(500, new ApiError(null, { e: errorInfo }));
				}
			});
	});
