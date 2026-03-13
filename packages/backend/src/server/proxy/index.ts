/**
 * @packageDocumentation
 *
 * メディアプロキシサーバ。外部 URL の画像・メディアをプロキシして配信する。
 *
 * @remarks
 * - **役割**: Koa アプリで `/:url*` を提供。メインサーバから mount され、クエリの url を proxy-media に渡して取得・変換・配信する。
 *
 * @see {@link proxy-media} プロキシ処理
 * @see {@link server/index} マウント元
 * @internal
 */
import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import { proxyMedia } from "./proxy-media.js";

// アプリ初期化
const app = new Koa();
app.use(cors());
app.use(async (ctx, next) => {
	ctx.set(
		"Content-Security-Policy",
		`default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'`,
	);
	await next();
});

// ルーター初期化
const router = new Router();

router.get("/:url*", proxyMedia);

// ルーター登録
app.use(router.routes());

export default app;
