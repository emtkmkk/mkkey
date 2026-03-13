/**
 * @packageDocumentation
 *
 * 認証ユーザーのアクセストークンを再生成する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/regenerate-token`（POST `/api/i/regenerate-token` で呼び出し）
 * - 認証必須。パスワード確認後、新しいアクセストークンを発行し、旧トークンを無効化する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import {
	publishInternalEvent,
	publishMainStream,
	publishUserEvent,
} from "@/services/stream.js";
import generateUserToken from "../../common/generate-native-user-token.js";
import define from "../../define.js";
import { Users, UserProfiles } from "@/models/index.js";
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
	const freshUser = await Users.findOneByOrFail({ id: user.id });
	const oldToken = freshUser.token;

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	// パスワードを照合する
	const same = await comparePassword(ps.password, profile.password!);

	if (!same) {
		throw new Error("incorrect password");
	}

	const newToken = generateUserToken();

	await Users.update(user.id, {
		token: newToken,
	});

	// イベントを発行する
	publishInternalEvent("userTokenRegenerated", {
		id: user.id,
		oldToken,
		newToken,
	});
	publishMainStream(user.id, "myTokenRegenerated");

	// ストリーミングを終了する
	setTimeout(() => {
		publishUserEvent(user.id, "terminate", {});
	}, 5000);
});
