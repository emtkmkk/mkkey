/**
 * 認証トークンの有効性のみを返す軽量エンドポイント
 *
 * クライアント起動時にキャッシュで入ってよいかを判定するために利用する。
 * requireCredential により認証層でトークン検証が行われるため、
 * ハンドラに到達すれば valid: true を返すだけとする。
 *
 * @packageDocumentation
 */

import define from "../../define.js";

export const meta = {
	tags: ["auth"],

	requireCredential: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			valid: {
				type: "boolean",
				optional: false,
				nullable: false,
			},
		},
		required: ["valid"],
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	return { valid: true };
});
