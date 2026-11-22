/**
 * @packageDocumentation
 *
 * 配送（deliver）の失敗を、「サーバ全体の不調か」「この配送の内容の問題か」で分類する。
 *
 * @remarks
 * - **役割**: サーキットブレーカー（{@link ./circuit.ts}）が数えてよい失敗かどうかを決める。
 * - 方針: リクエストの中身が相手のアプリに届く前に起きた失敗（DNS・接続・TLS・前段のゲートウェイ）だけを
 *   `hostDown` にする。これらは送った内容に関係なく起きるので、別の配送でも同じ結果になる。
 *   500 や「送った後の応答待ちタイムアウト」は内容が原因のこともあるので `ambiguous` にし、数えない。
 * - 計画: `plans/instance-delivery-health-plan.md` の「設計方針 1」。
 * - NOTE: テストから config を読まずに使えるよう、`@/misc/fetch.js`（config に依存）を import しない。
 *   `StatusError` は `name` と `statusCode` で見分ける。
 *
 * @internal
 */

//#region 型

/**
 * 配送結果の分類。
 *
 * @remarks
 * - `success`: 2xx。
 * - `hostDown`: 内容に関係なく起きる失敗。ブレーカーで数える。
 * - `ambiguous`: 内容が原因かもしれない失敗。数えない（ジョブ単位の再送に任せる）。
 * - `rateLimited`: 429。数えないが、`Retry-After` の間はそのサーバを待たせる。
 * - `recipientError`: 4xx（相手のアプリは応答している）。数えず、ジョブも再送しない。
 * - `gone`: shared inbox の 410。サーバ自体の閉鎖。
 *
 * 値を追加・削除すると、ブレーカーと履歴の解釈が変わるので注意する。
 *
 * @internal
 */
export type DeliverOutcomeKind =
	| "success"
	| "hostDown"
	| "ambiguous"
	| "rateLimited"
	| "recipientError"
	| "gone";

/**
 * 分類の結果。
 *
 * @internal
 */
export type DeliverOutcome = {
	/** 分類 */
	kind: DeliverOutcomeKind;
	/** ログや履歴に出す短い説明（例: `ECONNREFUSED`、`521`、`timeout`） */
	label: string;
	/** HTTP ステータス。HTTP の応答が無い失敗では undefined */
	statusCode?: number;
	/** 429 の `Retry-After`（ミリ秒）。無い・読めない場合は undefined */
	retryAfterMs?: number;
	/**
	 * 応答待ちのタイムアウトで、接続段階で止まったのかが分からない場合に true。
	 *
	 * @remarks
	 * 呼び出し側は TCP の接続確認（{@link ./connect-check.ts}）を行い、
	 * 接続できなければ {@link toHostDownAfterConnectCheck} で `hostDown` に直す。
	 */
	needsConnectCheck?: boolean;
};

//#endregion 型

//#region 定数

/**
 * 接続より前（DNS・TCP 接続）で失敗したことを示すエラーコード。
 *
 * @remarks
 * `ENETUNREACH` / `EHOSTUNREACH` は、こちら側のネットワーク障害でも出る。
 * その場合は全サーバのブレーカーが開くが、復帰の確認で最長 1 時間以内に戻るので許容する。
 *
 * @internal
 */
const connectPhaseErrorCodes = new Set([
	"ECONNREFUSED",
	"ENOTFOUND",
	"ESERVFAIL",
	"EAI_AGAIN",
	"EAI_NONAME",
	"EHOSTUNREACH",
	"ENETUNREACH",
	"EHOSTDOWN",
]);

/**
 * TLS のハンドシェイク・証明書の失敗を示すエラーコード。リクエスト本文を送る前に起きる。
 *
 * @internal
 */
const tlsErrorCodes = new Set([
	"EPROTO",
	"CERT_HAS_EXPIRED",
	"CERT_NOT_YET_VALID",
	"ERR_TLS_CERT_ALTNAME_INVALID",
	"DEPTH_ZERO_SELF_SIGNED_CERT",
	"SELF_SIGNED_CERT_IN_CHAIN",
	"UNABLE_TO_VERIFY_LEAF_SIGNATURE",
	"UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
	"ERR_SSL_WRONG_VERSION_NUMBER",
]);

/**
 * 接続段階を示すシステムコール名（node-fetch の `FetchError.erroredSysCall`）。
 *
 * @remarks
 * `cacheableLookup` は、{@link ../../misc/fetch.ts} が使う DNS キャッシュ（cacheable-lookup）経由の名前解決。
 * 本番では baraag.net の `queryA ESERVFAIL` や `cacheableLookup ENOTFOUND` が出ている。
 *
 * @internal
 */
const connectPhaseSysCalls = new Set([
	"connect",
	"getaddrinfo",
	"queryA",
	"queryAaaa",
	"cacheableLookup",
]);

/**
 * 前段（リバースプロキシ・CDN）が「本体に届かない」と返すステータス。
 *
 * @remarks
 * - 520（本体が不正な応答）と 524（本体に接続後、応答が遅い）は、内容が原因のこともあるので含めない。
 * - 503 はメンテナンス中など、サーバ全体の状態を表すので含める。
 *
 * @internal
 */
const hostDownStatusCodes = new Set([502, 503, 504, 521, 522, 523, 525, 526, 527, 530]);

//#endregion 定数

//#region 公開関数

/**
 * 配送で投げられた例外を分類する。
 *
 * @param error - `request()` が投げた例外
 * @param opts - 配送先の情報
 * @param opts.isSharedInbox - 宛先が shared inbox か（410 をサーバの閉鎖とみなすかの判断に使う）
 * @returns 分類の結果
 * @internal
 */
export function classifyDeliverError(
	error: unknown,
	opts: { isSharedInbox: boolean },
): DeliverOutcome {
	if (typeof error !== "object" || error == null) {
		return { kind: "ambiguous", label: String(error) };
	}

	const e = error as {
		name?: unknown;
		code?: unknown;
		erroredSysCall?: unknown;
		statusCode?: unknown;
		retryAfter?: unknown;
		location?: unknown;
		redirectedToOtherSite?: unknown;
	};

	// HTTP の応答があった場合（StatusError）
	if (e.name === "StatusError" && typeof e.statusCode === "number") {
		// 転送（3xx。配送と生存確認では追わない）
		if (e.statusCode >= 300 && e.statusCode < 400) {
			return classifyRedirect(e.statusCode, e.location, e.redirectedToOtherSite === true);
		}
		return classifyStatus(e.statusCode, opts, e.retryAfter);
	}

	// こちらで打ち切ったタイムアウト（AbortController）や、ソケットのタイムアウト。
	// 接続段階で止まったのか、送った後に止まったのかがここでは分からない
	if (e.name === "AbortError" || e.name === "TimeoutError") {
		return { kind: "ambiguous", label: "timeout", needsConnectCheck: true };
	}

	const code = typeof e.code === "string" ? e.code : undefined;
	const sysCall =
		typeof e.erroredSysCall === "string" ? e.erroredSysCall : undefined;

	if (code != null && tlsErrorCodes.has(code)) {
		return { kind: "hostDown", label: code };
	}

	if (code != null && connectPhaseErrorCodes.has(code)) {
		return { kind: "hostDown", label: code };
	}

	// 接続のシステムコールで失敗したもの（例: connect の ETIMEDOUT）
	if (sysCall != null && connectPhaseSysCalls.has(sysCall)) {
		return { kind: "hostDown", label: code ? `${code}(${sysCall})` : sysCall };
	}

	if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
		return { kind: "ambiguous", label: code, needsConnectCheck: true };
	}

	// ECONNRESET・socket hang up など、送信中・応答待ちの切断は内容が原因のこともある
	return {
		kind: "ambiguous",
		label: code ?? (typeof e.name === "string" ? e.name : "unknown"),
	};
}

/**
 * 接続確認に失敗した場合に、あいまいなタイムアウトを `hostDown` に直す。
 *
 * @param outcome - {@link classifyDeliverError} の結果（`needsConnectCheck` が true のもの）
 * @returns `hostDown` に直した結果
 * @internal
 */
export function toHostDownAfterConnectCheck(
	outcome: DeliverOutcome,
): DeliverOutcome {
	return {
		kind: "hostDown",
		label: `${outcome.label}+connect-failed`,
		statusCode: outcome.statusCode,
	};
}

/**
 * 復帰の確認（nodeinfo の取得）の結果から、相手のサーバが応答しているかを判定する。
 *
 * @remarks
 * 相手のアプリが何かしら応答していれば（4xx・500 を含む）生きているとみなす。
 * nodeinfo を返さないソフトウェアもあるため、ステータスは問わない。
 * 前段のゲートウェイのエラーと、タイムアウトを含む接続の失敗は「生きていない」とする。
 *
 * @param error - 取得で投げられた例外。成功した場合は null
 * @returns 応答していれば true
 * @internal
 */
export function isProbeAlive(error: unknown): boolean {
	if (error == null) return true;

	const outcome = classifyDeliverError(error, { isSharedInbox: false });
	if (outcome.kind === "hostDown") return false;
	if (outcome.needsConnectCheck) return false;
	// HTTP の応答があれば、ゲートウェイ以外は生きている
	return outcome.statusCode != null;
}

//#endregion 公開関数

//#region 非公開ヘルパー

/**
 * 転送（3xx）を分類する。
 *
 * @remarks
 * - 別のサイトへの転送は `hostDown`。そのドメインではもうサーバが動いていない（期限切れでドメイン売買サイトへ転送される、など）。
 *   2026-11-22 に oran.ski / oru.ski（→ expireddomains.com）で、生存確認が転送先の応答を「生きている」と数え、
 *   一時停止と解除を 1 日 270 回繰り返していた。
 * - 同じサイト内の転送（例: `omanke.layp.net` → `layp.net`）は、相手のアプリが応答しているので `recipientError`。
 *
 * @param status - HTTP ステータス
 * @param location - 転送先
 * @param otherSite - 転送先が別のサイトか
 * @returns 分類の結果
 * @internal
 */
function classifyRedirect(
	status: number,
	location: unknown,
	otherSite: boolean,
): DeliverOutcome {
	if (otherSite) {
		let host = "?";
		try {
			host = new URL(String(location)).hostname;
		} catch {
			// 読めない転送先はホスト名を出さない
		}
		return { kind: "hostDown", label: `redirect to ${host}`, statusCode: status };
	}
	return { kind: "recipientError", label: String(status), statusCode: status };
}

/**
 * HTTP ステータスを分類する。
 *
 * @param status - HTTP ステータス
 * @param opts - 配送先の情報
 * @param opts.isSharedInbox - 宛先が shared inbox か
 * @param retryAfter - `Retry-After` ヘッダーの値
 * @returns 分類の結果
 * @internal
 */
function classifyStatus(
	status: number,
	opts: { isSharedInbox: boolean },
	retryAfter: unknown,
): DeliverOutcome {
	const label = String(status);

	if (status >= 200 && status < 300) {
		return { kind: "success", label, statusCode: status };
	}

	if (status === 429) {
		return {
			kind: "rateLimited",
			label,
			statusCode: status,
			retryAfterMs: parseRetryAfterMs(retryAfter),
		};
	}

	if (status === 410 && opts.isSharedInbox) {
		return { kind: "gone", label, statusCode: status };
	}

	if (status >= 400 && status < 500) {
		return { kind: "recipientError", label, statusCode: status };
	}

	if (hostDownStatusCodes.has(status)) {
		return { kind: "hostDown", label, statusCode: status };
	}

	return { kind: "ambiguous", label, statusCode: status };
}

/**
 * `Retry-After` ヘッダー（秒数または HTTP 日付）をミリ秒に変換する。
 *
 * @param value - ヘッダーの値
 * @returns 待つべきミリ秒。読めない・0 以下なら undefined
 * @internal
 */
function parseRetryAfterMs(value: unknown): number | undefined {
	if (typeof value !== "string" || value.trim() === "") return undefined;

	const seconds = Number(value);
	if (!Number.isNaN(seconds)) {
		return seconds > 0 ? seconds * 1000 : undefined;
	}

	const date = Date.parse(value);
	if (Number.isNaN(date)) return undefined;
	const ms = date - Date.now();
	return ms > 0 ? ms : undefined;
}

//#endregion 非公開ヘルパー
