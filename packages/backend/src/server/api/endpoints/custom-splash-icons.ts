/**
 * @packageDocumentation
 *
 * カスタムスプラッシュアイコン一覧を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `custom-splash-icons`（GET `/api/custom-splash-icons` で呼び出し）
 * - 認証不要。インスタンス設定のスプラッシュアイコン URL 配列を返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
// import { IsNull } from 'typeorm';
import { fetchMeta } from "@/misc/fetch-meta.js";
import define from "../define.js";

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "string",
			optional: false,
			nullable: false,
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	const meta = await fetchMeta();
	const icons = await Promise.all(meta.customSplashIcons.map((x) => x));
	return icons;
});
