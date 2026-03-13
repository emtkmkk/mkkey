/**
 * @packageDocumentation
 *
 * ファイルサーバ。ドライブファイル配信・ダミー画像等のルートを提供する。
 *
 * @remarks
 * - **役割**: Koa アプリで `/app-default.jpg` と `/:key`（ドライブファイル）を提供。メインサーバから mount される。
 * - `/:key` は send-drive-file で accessKey からファイルを解決して配信する。
 *
 * @see {@link send-drive-file} ドライブファイル配信
 * @see {@link server/index} マウント元
 * @internal
 */
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import sendDriveFile from "./send-drive-file.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

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

router.get("/app-default.jpg", (ctx) => {
	const file = fs.createReadStream(`${_dirname}/assets/dummy.png`);
	ctx.body = file;
	ctx.set("Content-Type", "image/jpeg");
	ctx.set("Cache-Control", "max-age=31536000, immutable");
});

router.get("/:key", sendDriveFile);
router.get("/:key/(.*)", sendDriveFile);

// ルーター登録
app.use(router.routes());

export default app;
