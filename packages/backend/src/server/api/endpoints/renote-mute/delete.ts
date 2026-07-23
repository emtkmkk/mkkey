/**
 * @packageDocumentation
 *
 * リノートミュートを解除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `renote-mute/delete`（POST `/api/renote-mute/delete` で呼び出し）
 * - 認証必須。userId で指定したユーザーのリノートミュートを解除する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { hasMuteScope } from "@/misc/mute-scope.js";
import { Mutings } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { removeMutingScope } from "@/services/muting.js";
import { publishUserEvent } from "@/services/stream.js";

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
			message: "あなたはそのユーザをmutingしていない様です。",
			code: "NOT_MUTING",
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
	const muter = user;

	// ミュート対象を取得する
	const mutee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// ミュートしていないか確認する
	const exist = await Mutings.findOneBy({
		muterId: muter.id,
		muteeId: mutee.id,
	});

	if (exist == null || !hasMuteScope(exist.scope, "renote")) {
		throw new ApiError(meta.errors.notMuting);
	}

	// all はRTを内包するため、旧個別解除APIからは維持される。
	const result = await removeMutingScope(muter.id, mutee.id, "renote");
	publishUserEvent(user.id, result.muting == null ? "unmute" : "mute", mutee);
});
