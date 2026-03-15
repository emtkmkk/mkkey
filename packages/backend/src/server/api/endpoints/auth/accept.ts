/**
 * @packageDocumentation
 *
 * 認証セッションを承認しアクセストークンを発行する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `auth/accept`（POST `/api/auth/accept` で呼び出し）
 * - 認証必須・secure。appId と token でセッションを特定し、承認するとアクセストークンを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import * as crypto from "node:crypto";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { AuthSessions, AccessTokens, Apps } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { secureRndstr } from "@/misc/secure-rndstr.js";

export const meta = {
	tags: ["auth"],

	requireCredential: true,

	secure: true,

	description:
		"OAuth 認証セッションを承認し、アクセストークンを発行する。auth/session/generate で得た token を渡し、ユーザーがログイン済みの状態で呼ぶ。返却された accessToken で API にアクセスする。",

	errors: {
		noSuchSession: {
			message: "そのsessionは存在しません。",
			code: "NO_SUCH_SESSION",
			id: "9c72d8de-391a-43c1-9d06-08d29efde8df",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		token: { type: "string" },
	},
	required: ["token"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// トークンを取得する
	const session = await AuthSessions.findOneBy({ token: ps.token });

	if (session == null) {
		throw new ApiError(meta.errors.noSuchSession);
	}

	// アクセストークンを生成する
	const accessToken = secureRndstr(32, true);

	// 既存のアクセストークンを取得する
	const exist = await AccessTokens.findOneBy({
		appId: session.appId,
		userId: user.id,
	});

	if (exist == null) {
		// アプリを検索する
		const app = await Apps.findOneByOrFail({ id: session.appId });

		// ハッシュを生成する
		const sha256 = crypto.createHash("sha256");
		sha256.update(accessToken + app.secret);
		const hash = sha256.digest("hex");

		const now = new Date();

		// アクセストークン文書を挿入する
		await AccessTokens.insert({
			id: genId(),
			createdAt: now,
			lastUsedAt: now,
			appId: session.appId,
			userId: user.id,
			token: accessToken,
			hash: hash,
		});
	}

	// セッションを更新する
	await AuthSessions.update(session.id, {
		userId: user.id,
	});
});
