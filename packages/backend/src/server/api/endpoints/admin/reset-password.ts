/**
 * @packageDocumentation
 *
 * 管理者が指定ユーザーのパスワードをリセットする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `admin/reset-password`（POST `/api/admin/reset-password` で呼び出し）
 * - 認証必須・モデレーター権限必須。userId で指定したユーザーのパスワードを新ランダム値に変更し、レスポンスで返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
// import bcrypt from "bcryptjs";
import rndstr from "rndstr";
import { Users, UserProfiles } from "@/models/index.js";
import { hashPassword } from "@/misc/password.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:reset-password",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			password: {
				type: "string",
				optional: false,
				nullable: false,
				minLength: 8,
				maxLength: 8,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error("user not found");
	}

	if (user.isAdmin) {
		throw new Error("cannot reset password of admin");
	}

	const passwd = rndstr("a-zA-Z0-9", 8);

	// パスワードのハッシュを生成する
	// const hash = bcrypt.hashSync(passwd);
	const hash = await hashPassword(passwd);

	await UserProfiles.update(
		{
			userId: user.id,
		},
		{
			password: hash,
		},
	);

	return {
		password: passwd,
	};
});
