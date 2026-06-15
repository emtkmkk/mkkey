/**
 * @packageDocumentation
 *
 * プッシュ通知ミュートを解除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `push-mute/delete`（POST `/api/push-mute/delete` で呼び出し）
 * - 認証必須。userId で指定したユーザのプッシュ通知ミュートを解除する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { PushMutings } from "@/models/index.js";
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
			id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
		},

		notMuting: {
			message: "あなたはそのユーザのプッシュ通知をオフにしていない様です。",
			code: "NOT_MUTING",
			id: "d4e5f6a7-b8c9-0123-def0-234567890123",
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
	const muter = user;

	const mutee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	const exist = await PushMutings.findOneBy({
		muterId: muter.id,
		muteeId: mutee.id,
	});

	if (exist == null) {
		throw new ApiError(meta.errors.notMuting);
	}

	await PushMutings.delete({
		id: exist.id,
	});
});
