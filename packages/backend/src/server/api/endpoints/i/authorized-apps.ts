/**
 * @packageDocumentation
 *
 * 認証ユーザーが許可したアプリ（アクセストークン）一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/authorized-apps`（GET `/api/i/authorized-apps` で呼び出し）
 * - 認証必須。自分が発行したアクセストークンと紐づくアプリの一覧を返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { AccessTokens, Apps } from "@/models/index.js";

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		offset: { type: "integer", default: 0 },
		sort: { type: "string", enum: ["desc", "asc"], default: "desc" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// トークンを取得する
	const tokens = await AccessTokens.find({
		where: {
			userId: user.id,
		},
		take: ps.limit,
		skip: ps.offset,
		order: {
			id: ps.sort === "asc" ? 1 : -1,
		},
	});

	return await Promise.all(
		tokens.map((token) =>
			Apps.pack(token.appId, user, {
				detail: true,
			}),
		),
	);
});
