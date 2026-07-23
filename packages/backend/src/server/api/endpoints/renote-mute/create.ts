/**
 * @packageDocumentation
 *
 * リノートミュートを追加する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `renote-mute/create`（POST `/api/renote-mute/create` で呼び出し）
 * - 認証必須。userId で指定したユーザーのリノートをタイムラインで非表示にする。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { hasMuteScope } from "@/misc/mute-scope.js";
import { Mutings } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
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

		alreadyMuting: {
			message: "既にこのユーザをmutingしています。",
			code: "ALREADY_MUTING",
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
	const muter = user;

	// ミュート対象を取得する
	const mutee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// 既にミュート中か確認する
	const exist = await Mutings.findOneBy({
		muterId: muter.id,
		muteeId: mutee.id,
	});

	if (exist != null && hasMuteScope(exist.scope, "renote")) {
		throw new ApiError(meta.errors.alreadyMuting);
	}

	// 旧APIは無期限のRT範囲を追加する互換口として維持する。
	await addMutingScope(muter.id, mutee.id, "renote", null);
	publishUserEvent(user.id, "mute", mutee);
});
