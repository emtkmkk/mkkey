/**
 * @packageDocumentation
 *
 * URL プレビュー失敗時のネガティブキャッシュ TTL 計算（`Retry-After` 解析・HTTP ステータス別の秒数）。
 *
 * @remarks
 * - **分離理由**: 単体テストで `config` 初期化（`built/meta.json`）に依存させない。
 * - **利用**: `url-preview-outbound` の `resolveNegativeCacheTtlSec` が本モジュールの `resolveNegativeCacheTtlSecFromOpts` を呼ぶ。
 *
 * @internal
 */

/**
 * ネガティブ TTL のクランプと既定値に使うオプション。
 *
 * @remarks
 * 値は `config.urlPreview` の同名項目と揃える想定。
 */
export type UrlPreviewNegativeTtlOpts = {
	/** 429 等で Retry-After が無いときの既定秒数。 */
	negativeDefaultSec: number;
	/** TTL 下限（秒）。 */
	negativeMinSec: number;
	/** TTL 上限（秒）。 */
	negativeMaxSec: number;
	/** 5xx で Retry-After が無いときの既定秒数。 */
	negative5xxSec: number;
};

/**
 * RFC 9110 の Retry-After（秒数または HTTP-date）を秒数に変換する。
 *
 * @param headerValue - `Retry-After` ヘッダー値
 * @returns 解釈できた場合は 0 以上の秒数、そうでなければ null
 *
 * @internal
 */
export function parseRetryAfterSeconds(headerValue: string | null | undefined): number | null {
	if (headerValue == null || headerValue.trim() === "") return null;
	const trimmed = headerValue.trim();
	const asInt = parseInt(trimmed, 10);
	if (!Number.isNaN(asInt) && String(asInt) === trimmed) {
		return asInt >= 0 ? asInt : null;
	}
	const ms = Date.parse(trimmed);
	if (!Number.isNaN(ms)) {
		const delta = Math.ceil((ms - Date.now()) / 1000);
		return delta > 0 ? delta : null;
	}
	return null;
}

function extractRetryAfterFromError(err: unknown): number | null {
	if (typeof err !== "object" || err === null) return null;
	const e = err as Record<string, unknown>;
	const res = e.response as Record<string, unknown> | undefined;
	if (!res) return null;
	const headers = res.headers as
		| { get?: (n: string) => string | null; "retry-after"?: string }
		| undefined;
	if (!headers) return null;
	const v =
		typeof headers.get === "function"
			? headers.get("retry-after") ?? headers.get("Retry-After")
			: (headers["retry-after"] as string | undefined);
	return parseRetryAfterSeconds(v ?? null);
}

function extractStatusCode(err: unknown): number | null {
	if (typeof err !== "object" || err === null) return null;
	const e = err as Record<string, unknown>;
	// NOTE: `StatusError` は `@/misc/fetch` にあるが import すると config 初期化が走るため、名前で識別する。
	if (e.name === "StatusError" && typeof e.statusCode === "number") {
		return e.statusCode;
	}
	const res = e.response as { statusCode?: number } | undefined;
	if (res?.statusCode != null) return res.statusCode;
	const sc = e.statusCode;
	return typeof sc === "number" ? sc : null;
}

/**
 * 失敗時ネガティブキャッシュの TTL（秒）を決める（設定オブジェクト版・テスト向け）。
 *
 * @param opts - 既定 TTL とクランプ範囲
 * @param err - 外向き取得で投げられたエラーまたは fetch 失敗オブジェクト
 * @returns Redis `EX` 等に渡す正の秒数（クランプ済み）
 *
 * @internal
 */
export function resolveNegativeCacheTtlSecFromOpts(
	opts: UrlPreviewNegativeTtlOpts,
	err: unknown,
): number {
	const minS = opts.negativeMinSec;
	const maxS = opts.negativeMaxSec;
	const clamp = (n: number) => Math.min(maxS, Math.max(minS, n));

	const status = extractStatusCode(err);
	if (status === 429) {
		const ra = extractRetryAfterFromError(err);
		if (ra != null) return clamp(ra);
		return clamp(opts.negativeDefaultSec);
	}
	if (status != null && status >= 500 && status <= 599) {
		const ra = extractRetryAfterFromError(err);
		if (ra != null) return clamp(ra);
		return clamp(opts.negative5xxSec);
	}
	return clamp(opts.negativeDefaultSec);
}
