/**
 * @packageDocumentation
 *
 * 登録済み Service Worker のプッシュ購読情報を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `sw/show-registration`（GET `/api/sw/show-registration` で呼び出し）
 * - 認証必須。現在のユーザーに紐づくプッシュ購読情報を返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { SwSubscriptions } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	description: "Check push notification registration exists.",

	res: {
		type: "object",
		optional: false,
		nullable: true,
		properties: {
			userId: {
				type: "string",
				optional: false,
				nullable: false,
			},
			endpoint: {
				type: "string",
				optional: false,
				nullable: false,
			},
			sendReadMessage: {
				type: "boolean",
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		endpoint: { type: "string" },
	},
	required: ["endpoint"],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, me) => {
	const exist = await SwSubscriptions.findOneBy({
		userId: me.id,
		endpoint: ps.endpoint,
	});

	if (exist != null) {
		return {
			userId: exist.userId,
			endpoint: exist.endpoint,
			sendReadMessage: exist.sendReadMessage,
		};
	}

	return null;
});
