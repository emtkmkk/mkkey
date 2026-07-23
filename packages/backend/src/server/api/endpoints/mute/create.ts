/**
 * @packageDocumentation
 *
 * ユーザーをミュートする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `mute/create`（POST `/api/mute/create` で呼び出し）
 * - 認証必須。userId で指定したユーザーをミュートリストに追加する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { Mutings, NoteWatchings } from "@/models/index.js";
import { publishUserEvent } from "@/services/stream.js";
import {
	hasMuteScope,
	MUTE_SCOPE_BITS,
	muteTypes,
	type MuteType,
} from "@/misc/mute-scope.js";
import { replaceMutingScopes } from "@/services/muting.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:mutes",

	description:
		"指定したユーザーをミュートする。ミュートすると相手の投稿がTLに表示されない（ブロックより穏やか）。有効期限の指定が可能。解除は mute/delete。",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "6fef56f3-e765-4957-88e5-c6f65329b8a5",
		},

		muteeIsYourself: {
			message: "自分をMuteeに指定する事は出来ません。",
			code: "MUTEE_IS_YOURSELF",
			id: "a4619cb2-5f23-484b-9301-94c903074e10",
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
		userId: {
			type: "string",
			format: "misskey:id",
			description: "ミュートするユーザーの ID。",
		},
		expiresAt: {
			type: "integer",
			nullable: true,
			description:
				"ミュート解除日時（Unix ミリ秒）。null のとき無期限。",
		},
		types: {
			type: "array",
			minItems: 1,
			uniqueItems: true,
			items: {
				type: "string",
				enum: muteTypes,
			},
			description:
				"ミュート範囲。省略時は従来互換の all。all は他の指定より優先される。",
		},
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const muter = user;

	// 自分自身
	if (user.id === ps.userId) {
		throw new ApiError(meta.errors.muteeIsYourself);
	}

	// ミュート対象を取得する
	const mutee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// 管理人はミュートできるが、永続が指定されている場合ミニサイレンス状態になる
	if (!muter.host && !muter.isAdmin && mutee.isAdmin && !ps.expiresAt) {
		throw new ApiError();
	}

	const requestedTypes = (ps.types ?? ["all"]) as MuteType[];

	// 同じ範囲が既に設定済みの場合は従来どおり重複エラーにする。
	const exist = await Mutings.findOneBy({
		muterId: muter.id,
		muteeId: mutee.id,
	});

	if (
		exist != null &&
		requestedTypes.every((type) =>
			type === "all"
				? (exist.scope & MUTE_SCOPE_BITS.all) !== 0
				: hasMuteScope(exist.scope, type),
		)
	) {
		throw new ApiError(meta.errors.alreadyMuting);
	}

	if (ps.expiresAt && ps.expiresAt <= Date.now()) {
		return;
	}

	// create は新規関係を作る入口。既存の個別範囲がある場合は指定範囲へ置換する。
	await replaceMutingScopes(
		muter.id,
		mutee.id,
		requestedTypes,
		ps.expiresAt ? new Date(ps.expiresAt) : null,
	);

	publishUserEvent(user.id, "mute", mutee);

	if (requestedTypes.includes("all") || requestedTypes.includes("note")) {
		NoteWatchings.delete({
			userId: muter.id,
			noteUserId: mutee.id,
		});
	}
});
