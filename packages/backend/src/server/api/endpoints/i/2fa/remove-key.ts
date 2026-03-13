/**
 * @packageDocumentation
 *
 * 2FA パスキー（セキュリティキー）を削除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/2fa/remove-key`（POST `/api/i/2fa/remove-key` で呼び出し）
 * - 認証必須。パスワード確認後、指定した keyId のセキュリティキーを登録解除する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { comparePassword } from "@/misc/password.js";
import define from "../../../define.js";
import { UserProfiles, UserSecurityKeys, Users } from "@/models/index.js";
import { publishMainStream } from "@/services/stream.js";

export const meta = {
	requireCredential: true,

	secure: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		password: { type: "string" },
		credentialId: { type: "string" },
	},
	required: ["password", "credentialId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	// パスワードを照合する
	const same = await comparePassword(ps.password, profile.password!);

	if (!same) {
		throw new Error("incorrect password");
	}

	// Make sure we only delete the user's own creds
	await UserSecurityKeys.delete({
		userId: user.id,
		id: ps.credentialId,
	});

	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);

	// meUpdated イベントを発行する
	publishMainStream(
		user.id,
		"meUpdated",
		await Users.pack(user.id, user, {
			detail: true,
			includeSecrets: true,
		}),
	);

	return {};
});
