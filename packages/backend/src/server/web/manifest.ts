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
import type Koa from "koa";
import { fetchMeta } from "@/misc/fetch-meta.js";
import manifest from "./manifest.json" assert { type: "json" };

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
