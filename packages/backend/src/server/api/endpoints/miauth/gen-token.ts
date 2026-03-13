/**
 * @packageDocumentation
 *
 * MiAuth 用のトークンを発行する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `miauth/gen-token`（POST `/api/miauth/gen-token` で呼び出し）
 * - 認証不要。name・permission・callback などを指定し、MiAuth 認証フロー用のセッション ID を返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { AccessTokens } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { secureRndstr } from "@/misc/secure-rndstr.js";

export const meta = {
	tags: ["auth"],

	requireCredential: true,

	secure: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			token: {
				type: "string",
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		session: { type: "string", nullable: true },
		name: { type: "string", nullable: true },
		description: { type: "string", nullable: true },
		iconUrl: { type: "string", nullable: true },
		permission: {
			type: "array",
			uniqueItems: true,
			items: {
				type: "string",
			},
		},
	},
	required: ["session", "permission"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// アクセストークンを生成する
	const accessToken = secureRndstr(32, true);

	const now = new Date();

	// Insert access token doc
	await AccessTokens.insert({
		id: genId(),
		createdAt: now,
		lastUsedAt: now,
		session: ps.session,
		userId: user.id,
		token: accessToken,
		hash: accessToken,
		name: ps.name,
		description: ps.description,
		iconUrl: ps.iconUrl,
		permission: ps.permission,
	});

	return {
		token: accessToken,
	};
});
