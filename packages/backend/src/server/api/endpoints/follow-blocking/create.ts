/**
 * @packageDocumentation
 *
 * フォロー・ブロック（ユーザーをフォローもブロックもできないようにする）を作成する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `follow-blocking/create`（POST `/api/follow-blocking/create` で呼び出し）
 * - 認証必須。userId で指定したユーザーをフォロー・ブロックリストに追加する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { hasMuteScope } from "@/misc/mute-scope.js";
import { Mutings } from "@/models/index.js";
import { addMutingScope } from "@/services/muting.js";
import { publishUserEvent } from "@/services/stream.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:mutes",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "6fef56f3-e765-4957-88e5-c6f65329b8a5",
		},

		alreadyBlocking: {
			message: "既にこのユーザをblockingしています。",
			code: "ALREADY_BLOCKING",
			id: "7e7359cb-160c-4956-b08f-4d1c653cd007",
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

	// 既にミュート中か確認する
	const exist = await Mutings.findOneBy({
		muterId: blocker.id,
		muteeId: blockee.id,
	});

	if (exist != null && hasMuteScope(exist.scope, "follow")) {
		throw new ApiError(meta.errors.alreadyBlocking);
	}

	await addMutingScope(blocker.id, blockee.id, "follow", null);
	publishUserEvent(user.id, "mute", blockee);
});
