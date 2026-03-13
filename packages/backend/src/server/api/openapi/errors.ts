/**
 * @packageDocumentation
 *
 * OpenAPI 仕様に載せる API エラー定義（HTTP ステータス別・コード別）。
 *
 * @remarks
 * - **役割**: エンドポイントの `errors` や共通エラーを OpenAPI の responses 用に定義する。
 * - 400 INVALID_PARAM、401 CREDENTIAL_REQUIRED、403 AUTHENTICATION_FAILED、429 RATE_LIMIT_EXCEEDED、500 INTERNAL_ERROR 等。
 *
 * @see {@link gen-spec} 仕様生成で参照
 * @internal
 */
export const errors = {
	"400": {
		INVALID_PARAM: {
			value: {
				error: {
					message: "パラメータが正しくありません。",
					code: "INVALID_PARAM",
					id: "3d81ceae-475f-4600-b2a8-2bc116157532",
				},
			},
		},
	},
	"401": {
		CREDENTIAL_REQUIRED: {
			value: {
				error: {
					message: "認証が必要です。",
					code: "CREDENTIAL_REQUIRED",
					id: "1384574d-a912-4b81-8601-c7b1c4085df1",
				},
			},
		},
	},
	"403": {
		AUTHENTICATION_FAILED: {
			value: {
				error: {
					message:
						"認証に失敗しました。トークンが正しいことを確認してください。",
					code: "AUTHENTICATION_FAILED",
					id: "b0a7f5f8-dc2f-4171-b91f-de88ad238e14",
				},
			},
		},
	},
	"418": {
		I_AM_CALC: {
			value: {
				error: {
					message:
						"You sent a request to Calc, Calckey's resident stoner furry, instead of the server.",
					code: "I_AM_CALC",
					id: "60c46cd1-f23a-46b1-bebe-5d2b73951a84",
				},
			},
		},
	},
	"429": {
		RATE_LIMIT_EXCEEDED: {
			value: {
				error: {
					message:
						"レートリミットに到達しました。時間をおいて再度お試しください。",
					code: "RATE_LIMIT_EXCEEDED",
					id: "d5826d14-3982-4d2e-8011-b9e9f02499ef",
				},
			},
		},
	},
	"500": {
		INTERNAL_ERROR: {
			value: {
				error: {
					message:
						"サーバ側でなにかエラーが発生しました。連続で出る場合はご連絡ください。",
					code: "INTERNAL_ERROR",
					id: "5d37dbcb-891e-41ca-a3d6-e690c97775ac",
				},
			},
		},
	},
};
