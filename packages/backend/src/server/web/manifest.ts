/**
 * @packageDocumentation
 *
 * PWA 用 Web App Manifest のハンドラ。インスタンス名・テーマ色を埋め込んで返す。
 *
 * @remarks
 * - **役割**: Web サーバから manifest ルートで呼ばれ、manifest.json をベースに fetchMeta でインスタンス名・themeColor を埋めて返す。
 *
 * @see {@link web/index} Web サーバ
 * @internal
 */
import { createRequire } from "node:module";
import type Koa from "koa";
import { fetchMeta } from "@/misc/fetch-meta.js";

// JSON の import assertion は tsconfig の module 設定（es2020）では型チェックできないため、
// createRequire で読み込む。swc は -D（copy-files）で manifest.json を built 側にも複製するので、
// 実行時は従来と同じく隣の manifest.json が読まれる
const require = createRequire(import.meta.url);
/** manifest.json の内容。ハンドラ内で複製してから書き換える */
const manifest: Record<string, unknown> = require("./manifest.json");

export const manifestHandler = async (ctx: Koa.Context) => {
	// TODO
	//const res = structuredClone(manifest);
	const res = JSON.parse(JSON.stringify(manifest));

	const instance = await fetchMeta(true);

	res.short_name = instance.name || "Cluckey";
	res.name = instance.name || "Cluckey";
	if (instance.themeColor) res.theme_color = instance.themeColor;

	ctx.set("Cache-Control", "max-age=300");
	ctx.body = res;
};
