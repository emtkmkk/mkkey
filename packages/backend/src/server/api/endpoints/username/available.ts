/**
 * @packageDocumentation
 *
 * ユーザー名の空きを確認する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `username/available`（GET `/api/username/available` で呼び出し）
 * - 認証不要。username で指定したユーザー名が登録可能かどうかを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { IsNull } from "typeorm";
import { Users, UsedUsernames } from "@/models/index.js";
import config from "@/config/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["users"],

	requireCredential: false,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			available: {
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
		username: Users.localUsernameSchema,
	},
	required: ["username"],
} as const;

export default define(meta, paramDef, async (ps) => {
	// 存在確認する
	const exist = await Users.countBy({
		host: IsNull(),
		usernameLower: ps.username.toLowerCase(),
	});

	const exist2 = await UsedUsernames.countBy({
		username: ps.username.toLowerCase(),
	});

	const reserved = config.reservedUsernames?.includes(
		ps.username.toLowerCase(),
	);

	return {
		available: exist === 0 && exist2 === 0 && !reserved,
	};
});
