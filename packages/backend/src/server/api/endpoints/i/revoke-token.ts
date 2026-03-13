/**
 * @packageDocumentation
 *
 * 指定したアクセストークンを無効化する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/revoke-token`（POST `/api/i/revoke-token` で呼び出し）
 * - 認証必須。token で指定したアクセストークンを削除し、そのトークンでは以降認証できないようにする。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { AccessTokens } from "@/models/index.js";
import { publishUserEvent } from "@/services/stream.js";

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		tokenId: { type: "string", format: "misskey:id" },
	},
	required: ["tokenId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const token = await AccessTokens.findOneBy({ id: ps.tokenId });

	if (token) {
		await AccessTokens.delete({
			id: ps.tokenId,
			userId: user.id,
		});

		// ストリーミングを終了する
		publishUserEvent(user.id, "terminate");
	}
});
