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
import { genId } from "@/misc/gen-id.js";
import { Users, Mutings, NoteWatchings } from "@/models/index.js";
import type { Muting } from "@/models/entities/muting.js";
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
		userId: { type: "string", format: "misskey:id" },
		expiresAt: {
			type: "integer",
			nullable: true,
			description:
				"A Unix Epoch timestamp that must lie in the future. `null` means an indefinite mute.",
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

	// 既にミュート中か確認する
	const exist = await Mutings.findOneBy({
		muterId: muter.id,
		muteeId: mutee.id,
	});

	if (exist != null) {
		throw new ApiError(meta.errors.alreadyMuting);
	}

	if (ps.expiresAt && ps.expiresAt <= Date.now()) {
		return;
	}

	// ミュートを作成する
	await Mutings.insert({
		id: genId(),
		createdAt: new Date(),
		expiresAt: ps.expiresAt ? new Date(ps.expiresAt) : null,
		muterId: muter.id,
		muteeId: mutee.id,
	} as Muting);

	publishUserEvent(user.id, "mute", mutee);

	NoteWatchings.delete({
		userId: muter.id,
		noteUserId: mutee.id,
	});
});
