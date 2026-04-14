/**
 * @packageDocumentation
 *
 * リリース情報を返す API エンドポイント。
 *
 * @remarks
 * NOTE: 以前は外部 URL から取得していたが、外部依存を減らすため現在は固定で空オブジェクトを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../define.js";

export const meta = {
	tags: ["meta"],
	description: "固定の空リリース情報を返します。",

	requireCredential: false,
	requireCredentialPrivateMode: false,
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	return {};
});
