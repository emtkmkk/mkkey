/**
 * @packageDocumentation
 *
 * フォロー・ブロックを解除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `follow-blocking/delete`（POST `/api/follow-blocking/delete` で呼び出し）
 * - 認証必須。userId で指定したユーザーをフォロー・ブロックリストから削除する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { FollowBlockings } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:mutes",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "b851d00b-8ab1-4a56-8b1b-e24187cb48ef",
		},

		notMuting: {
			message: "あなたはそのユーザをblockingしていない様です。",
			code: "NOT_BLOCKING",
			id: "5467d020-daa9-4553-81e1-135c0c35a96d",
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

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	const blocker = user;

	// ブロック対象を取得する
	const blockee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// ミュートしていないか確認する
	const exist = await FollowBlockings.findOneBy({
		blockerId: blocker.id,
		blockeeId: blockee.id,
	});

	if (exist == null) {
		throw new ApiError(meta.errors.notMuting);
	}

	// ミュートを削除する
	await FollowBlockings.delete({
		id: exist.id,
	});
});
