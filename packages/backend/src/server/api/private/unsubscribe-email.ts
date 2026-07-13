/**
 * @packageDocumentation
 *
 * 案内メールの配信停止（ログイン不要）。
 *
 * @remarks
 * - メール本文の配信停止リンク（SPA 経由の JSON POST）と、RFC 8058 の
 *   ワンクリック配信停止（メールプロバイダからの form-urlencoded POST）の両方を受ける。
 * - トークンは `user_profile.emailUnsubscribeToken`（ユーザー単位で固定・恒久有効）。
 * - 照合に成功したら `receiveAnnouncementEmail` を false にする（再開はログイン後の設定画面から）。
 *
 * @internal
 */
import type Koa from "koa";
import { UserProfiles } from "@/models/index.js";

export default async (ctx: Koa.Context) => {
	const bodyToken = (ctx.request.body as Record<string, unknown> | undefined)?.[
		"token"
	];
	const queryToken = ctx.query.token;
	const token =
		typeof bodyToken === "string" && bodyToken !== ""
			? bodyToken
			: typeof queryToken === "string" && queryToken !== ""
				? queryToken
				: null;

	if (token == null) {
		ctx.throw(400, "token required");
		return;
	}

	const profile = await UserProfiles.findOneBy({
		emailUnsubscribeToken: token,
	});

	if (profile == null) {
		ctx.throw(404);
		return;
	}

	await UserProfiles.update(
		{ userId: profile.userId },
		{ receiveAnnouncementEmail: false },
	);

	ctx.status = 204;
};
