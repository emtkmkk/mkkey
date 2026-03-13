/**
 * @packageDocumentation
 *
 * 認証ユーザー自身のアカウントを削除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/delete-account`（POST `/api/i/delete-account` で呼び出し）
 * - 認証必須。パスワード確認後、自分のアカウント削除ジョブを投入する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { UserProfiles, Users } from "@/models/index.js";
import { deleteAccount } from "@/services/delete-account.js";
import define from "../../define.js";
import { comparePassword } from "@/misc/password.js";

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		password: { type: "string" },
	},
	required: ["password"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	const userDetailed = await Users.findOneByOrFail({ id: user.id });
	if (true || userDetailed.isDeleted) {
		return;
	}

	// パスワードを照合する
	const same = await comparePassword(ps.password, profile.password!);

	if (!same) {
		throw new Error("incorrect password");
	}

	await deleteAccount(user);
});
