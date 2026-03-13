/**
 * @packageDocumentation
 *
 * サインイン成功時のレスポンス処理。Cookie 設定・リダイレクト・サインイン履歴の記録を行う。
 *
 * @remarks
 * - **役割**: サインイン・サインアップ完了後に呼ばれ、Cookie 設定・mainStream 通知・サインイン履歴保存を行う。
 *
 * @see {@link signup} サインアップ
 * @see {@link private/signin} サインインルート
 * @internal
 */
import type Koa from "koa";

import config from "@/config/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { Signins } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { publishMainStream } from "@/services/stream.js";
import { warmMeDetailedCache } from "@/services/me-detailed-cache.js";

export default function (ctx: Koa.Context, user: ILocalUser, redirect = false) {
	if (redirect) {
		//#region クッキー
		ctx.cookies.set("igi", user.token!, {
			path: "/",
			// SEE: https://github.com/koajs/koa/issues/974
			// SSL プロキシ利用時は "X-Forwarded-Proto: https" ヘッダを付与するよう設定すること
			secure: config.url.startsWith("https"),
			httpOnly: false,
			sameSite: "lax",
		});
		//#endregion

		ctx.redirect(config.url);
	} else {
		ctx.body = {
			id: user.id,
			i: user.token,
		};
		ctx.status = 200;
	}

	(async () => {
		// サインイン履歴を追加
		const record = await Signins.insert({
			id: genId(),
			createdAt: new Date(),
			userId: user.id,
			ip: ctx.ip,
			headers: ctx.headers,
			success: true,
		}).then((x) => Signins.findOneByOrFail(x.identifiers[0]));

		// Publish signin event
		publishMainStream(user.id, "signin", await Signins.pack(record));

		// /i の Redis キャッシュをウォームアップ（続くクライアントの /i でヒットしやすくする）
		warmMeDetailedCache(user, true).catch(() => {});
	})();
}
