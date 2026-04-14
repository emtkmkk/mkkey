/**
 * @packageDocumentation
 *
 * 最新バージョン情報を返す API エンドポイント。
 *
 * @remarks
 * NOTE: 以前は外部リリース API を参照していたが、外部依存を減らすため現在は実行中バージョンを固定で返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import config from "@/config/index.js";
import define from "../define.js";

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	requireCredentialPrivateMode: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	return {
		tag_name: config.version,
	};
});
