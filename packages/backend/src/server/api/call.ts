/**
 * @packageDocumentation
 *
 * API エンドポイントの呼び出し。エンドポイント解決・レートリミット・認証・実行を行う。
 *
 * @remarks
 * - **役割**: api-handler から呼ばれ、エンドポイント名で解決・レート制限チェック・認証済みユーザーで execute を実行する。
 * - モデレーション警告の当日 ACK 前は `isModerationWarningAckPending` が true のユーザーを、ホワイトリスト以外の API で拒否する。
 * - レスポンスは define の res スキーマに沿って返却される。
 *
 * @see {@link define} エンドポイント定義
 * @see {@link endpoints} エンドポイント一覧
 * @internal
 */
import { performance } from "perf_hooks";
import Xev from "xev";
import type Koa from "koa";
import type { CacheableLocalUser } from "@/models/entities/user.js";
import { User } from "@/models/entities/user.js";
import type { AccessToken } from "@/models/entities/access-token.js";
import { getIpHash } from "@/misc/get-ip-hash.js";
import { limiter } from "./limiter.js";
import type { IEndpointMeta } from "./endpoints.js";
import endpoints from "./endpoints.js";
import compatibility from "./compatibility.js";
import { ApiError } from "./error.js";
import { apiLogger } from "./logger.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { isModerationWarningAckPending } from "@/misc/moderation-warning-ack.js";

const ev = new Xev();

const accessDenied = {
	message: "アクセスが拒否されました。",
	code: "ACCESS_DENIED",
	id: "56f35758-7dd5-468b-8439-5d6fb8ec9b8e",
};

/**
 * 警告フラグがあり、当日分の `i/ack-moderation-warning` 前にだけ通すエンドポイント。
 * それ以外の認証付き API は 403 とし、アプリ操作をブロックする。
 *
 * @remarks
 * - `auth/validate` 完了後も、クライアントは `fetchAccount` と警告ダイアログを `.then` で遅延実行する一方、
 *   `meta`・絵文字・レジストリ読取などが並列で走るため、**起動・表示に必要な読み取り系**だけをここに含める。
 * - ノート投稿・`i/registry/set` など副作用の大きい API は意図的に含めない（ACK 後に利用させる）。
 */
const MODERATION_WARNING_ACK_ENDPOINT_ALLOWLIST = new Set([
	"i",
	"i/ack-moderation-warning",
	"auth/validate",
	// インスタンス情報（`fetchInstance` と並列 init）
	"meta",
	// 絵文字・カテゴリ（`initializeEmoji` / `emojiLoad`）
	"emojis",
	"emojis/latest",
	"emoji-stats",
	"categories/show",
	// 設定同期の読み取り（壁紙同期・プロファイル一覧など）
	"i/registry/get-all",
	"i/registry/get",
	"i/registry/get-detail",
	"i/registry/get-unsecure",
	"i/registry/keys",
	"i/registry/keys-with-type",
	"i/registry/scopes",
	// UI 用ユーザー解決（アイコン非表示リストの補完）
	"users/show",
]);

export default async (
	endpoint: string,
	user: CacheableLocalUser | null | undefined,
	token: AccessToken | null | undefined,
	data: any,
	ctx?: Koa.Context,
) => {
	const isSecure = user != null && token == null;
	const isModerator = user != null && (user.isModerator || user.isAdmin);

	const ep =
		endpoints.find((e) => e.name === endpoint) ||
		compatibility.find((e) => e.name === endpoint);

	if (ep == null) {
		throw new ApiError({
			message: "そのエンドポイントは存在しません。",
			code: "NO_SUCH_ENDPOINT",
			id: "f8080b67-5f9c-4eb7-8c18-7f1eeae8f709",
			httpStatusCode: 404,
		});
	}

	if (ep.meta.secure && !isSecure) {
		throw new ApiError(accessDenied);
	}

	if (ep.meta.limit) {
		// レートリミットの主体: 認証ユーザは user.id、未認証は IP ハッシュ（proxy: true 時は Koa が X-Forwarded-For を参照）
		let limitActor: string;
		if (user) {
			limitActor = user.id;
		} else {
			limitActor = getIpHash(ctx!.ip);
		}

		const limit = Object.assign({}, ep.meta.limit);

		if (!limit.key) {
			limit.key = ep.name;
		}

		// レートリミット適用
		await limiter(
			limit as IEndpointMeta["limit"] & { key: NonNullable<string> },
			limitActor,
		).catch((e) => {
			throw new ApiError({
				message:
					"レートリミットに到達しました。時間をおいて再度お試しください。",
				code: "RATE_LIMIT_EXCEEDED",
				id: "d5826d14-3982-4d2e-8011-b9e9f02499ef",
				httpStatusCode: 429,
			});
		});
	}

	if (ep.meta.requireCredential && user == null) {
		throw new ApiError({
			message: "認証が必要です。",
			code: "CREDENTIAL_REQUIRED",
			id: "1384574d-a912-4b81-8601-c7b1c4085df1",
			httpStatusCode: 401,
		});
	}

	if (ep.meta.requireCredential && user!.isSuspended) {
		throw new ApiError({
			message: "アカウントが凍結されています。",
			code: "YOUR_ACCOUNT_SUSPENDED",
			id: "a8c724b3-6e9c-4b46-b1a8-bc3ed6258370",
			httpStatusCode: 403,
		});
	}

	if (ep.meta.requireCredential && user!.isUsagePaused) {
		throw new ApiError({
			message: "アカウントの利用が一時停止されています。",
			code: "YOUR_ACCOUNT_USAGE_PAUSED",
			id: "c9a4e2b1-7f3d-4a2e-9e1c-0d5b8a4e6f2a",
			httpStatusCode: 403,
		});
	}

	if (
		user &&
		!MODERATION_WARNING_ACK_ENDPOINT_ALLOWLIST.has(ep.name) &&
		isModerationWarningAckPending(user)
	) {
		throw new ApiError({
			message:
				"警告を確認するまで、この操作はできません。Webにて表示されたダイアログで了解してください。",
			code: "MODERATION_WARNING_ACK_REQUIRED",
			id: "f3a9c2d1-8e4b-4f2a-9c1d-0a7b6e5d4c3b",
			httpStatusCode: 403,
		});
	}

	if (ep.meta.requireAdmin && !user!.isAdmin) {
		throw new ApiError(accessDenied, { reason: "管理者権限がありません。" });
	}

	if (ep.meta.requireModerator && !isModerator) {
		throw new ApiError(accessDenied, {
			reason: "モデレータ権限がありません。",
		});
	}

	// アプリ（アクセストークン）経由のアクセスに対する権限チェック。
	// GHSA-7pxq-6xx9-xpgm (CVE-2023-52139) 対策: 本家 Misskey 2023.12.1 相当。
	// 以下のいずれかに該当する場合は、アプリに必要な権限が無いものとして拒否する。
	//   1. エンドポイントに `kind`（権限）が設定されており、トークンがその権限を持たない。
	//   2. エンドポイントに `kind` が無いが、認証/モデレータ/管理者を要求する。
	//      （kind が無い＝アプリ向けに開放されていないため、管理 API 等を
	//        アプリトークンで叩いて SMTP パスワードやオブジェクトストレージ鍵を
	//        窃取される事態を防ぐ）
	if (
		token &&
		((ep.meta.kind && !token.permission.some((p) => p === ep.meta.kind)) ||
			(!ep.meta.kind &&
				(ep.meta.requireCredential ||
					ep.meta.requireModerator ||
					ep.meta.requireAdmin)))
	) {
		throw new ApiError({
			message:
				"このトークンには、このエンドポイントを使用するために必要な権限がありません。",
			code: "PERMISSION_DENIED",
			id: "1370e5b7-d4eb-4566-bb1d-7748ee6a1838",
		});
	}

	// プライベートモード時
	const meta = await fetchMeta();
	if (
		meta.privateMode &&
		ep.meta.requireCredentialPrivateMode &&
		user == null
	) {
		throw new ApiError({
			message: "認証が必要です。",
			code: "CREDENTIAL_REQUIRED",
			id: "1384574d-a912-4b81-8601-c7b1c4085df1",
			httpStatusCode: 401,
		});
	}

	// 非 JSON 入力をキャスト
	if ((ep.meta.requireFile || ctx?.method === "GET") && ep.params.properties) {
		for (const k of Object.keys(ep.params.properties)) {
			const param = ep.params.properties![k];
			if (
				["boolean", "number", "integer"].includes(param.type ?? "") &&
				typeof data[k] === "string"
			) {
				try {
					data[k] = JSON.parse(data[k]);
				} catch (e) {
					throw new ApiError(
						{
							message: "パラメータが不正です。",
							code: "INVALID_PARAM",
							id: "0b5f1631-7c1a-41a6-b399-cce335f34d85",
						},
						{
							param: k,
							reason: `cannot cast to ${param.type}`,
						},
					);
				}
			}
		}
	}

	// API invoking（同時実行数・応答時間の集計用。admin 系は集計対象外）
	const isAdminEndpoint = ep.name.startsWith("admin/");
	if (!isAdminEndpoint) {
		ev.emit("apiRequestStart");
	}
	const before = performance.now();
	return await ep
		.exec(data, user, token, ctx?.file, ctx?.ip, ctx?.headers)
		.catch((e: Error) => {
			if (e instanceof ApiError) {
				apiLogger.error(`Api Error in ${ep.name}: ${e.message}`, {
					ep: ep.name,
					ps: data,
					e: {
						message: e.message,
						code: e.name,
						stack: e.stack,
					},
				});
				throw e;
			}
			apiLogger.error(`Internal error occurred in ${ep.name}: ${e.message}`, {
				ep: ep.name,
				ps: data,
				e: {
					message: e.message,
					code: e.name,
					stack: e.stack,
				},
			});
			throw new ApiError(null, {
				e: {
					message: e.message,
					code: e.name,
					stack: e.stack,
				},
			});
		})
		.finally(() => {
			if (!isAdminEndpoint) {
				ev.emit("apiRequestEnd");
			}
			const after = performance.now();
			const time = after - before;
			if (!isAdminEndpoint) {
				ev.emit("apiLatency", {
					at: Date.now(),
					responseMs: time,
					endpoint: ep.name,
				});
			}
			if (time > 10000) {
				apiLogger.warn(
					`SLOW API CALL DETECTED: ${ep.name} (${time.toFixed(0)}ms)`,
				);
			}
		});
};
