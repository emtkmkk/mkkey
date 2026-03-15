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

/** タグ名 → 日本語説明（Scalar 等の API ドキュメント表示用） */
const TAG_DESCRIPTIONS: Record<string, string> = {
	account: "アカウント設定・ブロック・ミュート・フォロー blocking 等",
	admin: "管理者向け操作",
	antennas: "アンテナ",
	app: "アプリケーション登録・管理",
	auth: "認証・セッション・MiAuth",
	categories: "カテゴリ（ページ用）",
	channels: "チャンネル",
	charts: "チャート・統計",
	clips: "クリップ",
	drive: "ドライブ（ファイル・フォルダ）",
	emoji: "絵文字（モチーフ等）",
	"emoji-import-request": "絵文字インポート申請",
	endpoints: "エンドポイント一覧",
	favorites: "お気に入り（ノート）",
	federation: "Federation（リモートインスタンス）",
	following: "フォロー・フォローリクエスト",
	gallery: "ギャラリー投稿",
	groups: "ユーザーグループ",
	hashtags: "ハッシュタグ",
	lists: "ユーザーリスト",
	messaging: "メッセージ（DM）",
	meta: "インスタンス情報・お知らせ・絵文字一覧等",
	"non-productive": "非本番用（開発・テスト）",
	notes: "ノート（投稿）の取得・作成・削除・タイムライン等",
	notifications: "通知",
	pages: "ページ",
	reactions: "リアクション",
	"reset password": "パスワードリセット",
	webhooks: "ウェブフック",
	users: "ユーザー情報・検索・フォロー等",
};

export function genOpenapiSpec() {
	const tagNames = new Set<string>();
	for (const ep of endpoints) {
		if (ep.meta.tags) {
			for (const t of ep.meta.tags) {
				tagNames.add(t);
			}
		}
	}

	const spec = {
		openapi: "3.0.0",

		info: {
			version: "v1",
			title: "Cluckey API",
			description: [
				"**Cluckey API** は、このインスタンス用の REST API です。",
				"",
				"### 認証",
				"- 多くのエンドポイントでは **認証が不要** です（メタ情報の取得、ノートの閲覧など）。",
				"- 認証が必要な操作では、リクエストボディに **API キー `i`** を渡すか、**Bearer トークン**（Authorization ヘッダー）を使用してください。",
				"",
				"### 利用上の注意",
				"- ベース URL はこのインスタンスの API URL です。",
				"- 一部のエンドポイントではレートリミットが適用されます。",
			].join("\n"),
			"x-logo": { url: "/static-assets/api-doc.png" },
		},

		externalDocs: {
			description: "リポジトリ",
			url: "https://github.com/emtkmkk/mkkey",
		},

		tags: [...tagNames].sort().map((name) => ({
			name,
			description: TAG_DESCRIPTIONS[name] ?? name,
		})),

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
				description: "ソースコード",
				url: `https://github.com/emtkmkk/mkkey/blob/develop/packages/backend/src/server/api/endpoints/${endpoint.name}.ts`,
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
			responses: (() => {
				const res: Record<string, any> = {
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
				};
				// 認証必須エンドポイントのみ 401 を返しうる（call.ts: requireCredential && user == null）
				if (endpoint.meta.requireCredential) {
					res["401"] = {
						description: "認証エラー",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: basicErrors["401"],
							},
						},
					};
				}
				// 認証・権限系エンドポイントのみ 403 を返しうる（凍結・管理者・モデレータ・secure）
				if (
					endpoint.meta.requireCredential ||
					endpoint.meta.requireAdmin ||
					endpoint.meta.requireModerator ||
					endpoint.meta.secure
				) {
					res["403"] = {
						description: "禁止エラー",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: basicErrors["403"],
							},
						},
					};
				}
				if (endpoint.meta.limit) {
					res["429"] = {
						description: "リクエスト過多",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/Error",
								},
								examples: basicErrors["429"],
							},
						},
					};
				}
				res["500"] = {
					description: "サーバー内部エラー",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							examples: basicErrors["500"],
						},
					},
				};
				return res;
			})(),
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
