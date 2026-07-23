/**
 * @packageDocumentation
 *
 * プッシュ通知ミュートを追加する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `push-mute/create`（POST `/api/push-mute/create` で呼び出し）
 * - 認証必須。userId で指定したユーザからの Web Push のみを抑止する。
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
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		},

		alreadyMuting: {
			message: "既にこのユーザのプッシュ通知をオフにしています。",
			code: "ALREADY_MUTING",
			id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
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

	const exist = await Mutings.findOneBy({
		muterId: muter.id,
		muteeId: mutee.id,
	});

	if (exist != null && hasMuteScope(exist.scope, "push")) {
		throw new ApiError(meta.errors.alreadyMuting);
	}

	await addMutingScope(muter.id, mutee.id, "push", null);
	publishUserEvent(user.id, "mute", mutee);
});
