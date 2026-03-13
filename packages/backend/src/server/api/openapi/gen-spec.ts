/**
 * @packageDocumentation
 *
 * OpenAPI 3.0 仕様（API ドキュメント用）をエンドポイント定義から生成する。
 *
 * @remarks
 * - **役割**: `endpoints.ts` のエンドポイント一覧を走査し、OpenAPI 3.0 の JSON 仕様を組み立てる。
 * - 生成仕様は API ドキュメント表示（例: Swagger UI）やクライアント生成に利用される。
 *
 * @see {@link endpoints} エンドポイント一覧
 * @see {@link schemas} スキーマ変換
 * @internal
 */
import endpoints from "../endpoints.js";
import config from "@/config/index.js";
import { errors as basicErrors } from "./errors.js";
import { schemas, convertSchemaToOpenApiSchema } from "./schemas.js";

export function genOpenapiSpec() {
	const spec = {
		openapi: "3.0.0",

		info: {
			version: "v1",
			title: "Cluckey API",
			"x-logo": { url: "/static-assets/api-doc.png" },
		},

		externalDocs: {
			description: "Repository",
			url: "https://code.naskya.net/emtkmkk/mkkey",
		},

		servers: [
			{
				url: config.apiUrl,
			},
		],

		paths: {} as any,

		components: {
			schemas: schemas,

			securitySchemes: {
				ApiKeyAuth: {
					type: "apiKey",
					in: "body",
					name: "i",
				},
				// TODO: 残りの OAuth 対応ができたら oauth2 に変更する
				Bearer: {
					type: "http",
					scheme: "bearer",
				},
			},
		},
	};

	for (const endpoint of endpoints.filter((ep) => !ep.meta.secure)) {
		const errors = {} as any;

		if (endpoint.meta.errors) {
			for (const e of Object.values(endpoint.meta.errors)) {
				errors[e.code] = {
					value: {
						error: e,
					},
				};
			}
		}

		const resSchema = endpoint.meta.res
			? convertSchemaToOpenApiSchema(endpoint.meta.res)
			: {};

		let desc = `${
			endpoint.meta.description
				? endpoint.meta.description
				: "説明なし。"
		}\n\n`;
		desc += `**Credential required**: *${
			endpoint.meta.requireCredential ? "Yes" : "No"
		}*`;
		if (endpoint.meta.kind) {
			const kind = endpoint.meta.kind;
			desc += ` / **Permission**: *${kind}*`;
		}

		const requestType = endpoint.meta.requireFile
			? "multipart/form-data"
			: "application/json";
		const schema = endpoint.params;

		if (endpoint.meta.requireFile) {
			schema.properties.file = {
				type: "string",
				format: "binary",
				description: "ファイル内容。",
			};
			schema.required.push("file");
		}

		const security = [
			{
				ApiKeyAuth: [],
			},
			{
				Bearer: [],
			},
		];
		if (!endpoint.meta.requireCredential) {
			// 認証を任意にするため追加
			security.push({});
		}

		const info = {
			operationId: endpoint.name,
			summary: endpoint.name,
			description: desc,
			externalDocs: {
				description: "Source code",
				url: `https://code.naskya.net/emtkmkk/mkkey/src/branch/beta/packages/backend/src/server/api/endpoints/${endpoint.name}.ts`,
			},
			tags: endpoint.meta.tags || undefined,
			security,
			requestBody: {
				required: true,
				content: {
					[requestType]: {
						schema,
					},
				},
			},
			responses: {
				...(endpoint.meta.res
					? {
							"200": {
								description: "OK（結果あり）",
								content: {
									"application/json": {
										schema: resSchema,
									},
								},
							},
					  }
					: {
							"204": {
								description: "OK（結果なし）",
							},
					  }),
				"400": {
					description: "クライアントエラー",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: { ...errors, ...basicErrors["400"] },
						},
					},
				},
				"401": {
					description: "認証エラー",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: basicErrors["401"],
						},
					},
				},
				"403": {
					description: "禁止エラー",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: basicErrors["403"],
						},
					},
				},
				"418": {
					description: "I'm Calc",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: basicErrors["418"],
						},
					},
				},
				...(endpoint.meta.limit
					? {
								"429": {
								description: "リクエスト過多",
								content: {
									"application/json": {
										schema: {
											$ref: "#/components/schemas/Error",
										},
										examples: basicErrors["429"],
									},
								},
							},
					  }
					: {}),
				"500": {
					description: "サーバー内部エラー",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: basicErrors["500"],
						},
					},
				},
			},
		};

		const path = {
			post: info,
		};
		if (endpoint.meta.allowGet) {
			path.get = { ...info };
			// GET リクエストでは API Key 認証は許可しない
			path.get.security = path.get.security.filter(
				(elem) => !Object.prototype.hasOwnProperty.call(elem, "ApiKeyAuth"),
			);
		}

		spec.paths[`/${endpoint.name}`] = path;
	}

	return spec;
}
