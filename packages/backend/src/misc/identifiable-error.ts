/**
 * @packageDocumentation
 *
 * 識別子付きエラー。API 等でエラー ID を返すために用いる。
 *
 * @remarks
 * - **役割**: id・message・isRetryable を持つエラー。ApiError やエンドポイントで throw し、クライアントに id 付きで返す。
 *
 * @see {@link api/error} ApiError
 * @internal
 */
export class IdentifiableError extends Error {
	public message: string;
	public id: string;
	public isRetryable: boolean;

	/**
	 * @param id - エラー識別子
	 * @param message - メッセージ（省略可）
	 * @param isRetryable - リトライ可能か（既定 true）
	 * @internal
	 */
	constructor(id: string, message?: string, isRetryable = true) {
		super(message);
		this.message = message || "";
		this.id = id;
		this.isRetryable = isRetryable;
	}
}
