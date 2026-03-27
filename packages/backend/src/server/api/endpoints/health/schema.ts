/**
 * @packageDocumentation
 *
 * health エンドポイントで使う共通レスポンススキーマ。
 *
 * @remarks
 * NOTE: OpenAPI 表示で説明が揃うように、共通項目をここで管理する。
 *
 * @internal
 */

/** health 系の共通プロパティ。 */
export const healthCommonProperties = {
	ok: {
		type: "boolean",
		optional: false,
		nullable: false,
		description: "チェック結果。",
	},
	status: {
		type: "number",
		optional: false,
		nullable: false,
		description: "HTTP相当の判定コード（200/503）。",
	},
	cached: {
		type: "boolean",
		optional: false,
		nullable: false,
		description: "キャッシュ応答かどうか。",
	},
	checkedAt: {
		type: "string",
		optional: false,
		nullable: false,
		format: "date-time",
		description: "最終チェック時刻（ISO8601）。",
	},
	latencyMs: {
		type: "number",
		optional: false,
		nullable: false,
		description: "チェック処理時間（ミリ秒）。",
	},
	reason: {
		type: "string",
		optional: false,
		nullable: true,
		description: "失敗時の要約理由（成功時はnull）。",
	},
} as const;
