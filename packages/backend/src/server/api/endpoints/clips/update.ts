/**
 * @packageDocumentation
 *
 * クリップを更新する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `clips/update`（POST `/api/clips/update` で呼び出し）
 * - 認証必須。clipId で指定したクリップの名前・説明・公開範囲等を更新する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { Clips } from "@/models/index.js";

export const meta = {
	tags: ["clips"],

	requireCredential: true,

	kind: "write:account",

	errors: {
		noSuchClip: {
			message: "そのclipは存在しません。",
			code: "NO_SUCH_CLIP",
			id: "b4d92d70-b216-46fa-9a3f-a8c811699257",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Clip",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		clipId: { type: "string", format: "misskey:id" },
		name: { type: "string", minLength: 1, maxLength: 100 },
		isPublic: { type: "boolean" },
		description: {
			type: "string",
			nullable: true,
			minLength: 1,
			maxLength: 2048,
		},
	},
	required: ["clipId", "name"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// クリップを取得する
	const clip = await Clips.findOneBy({
		id: ps.clipId,
		userId: user.id,
	});

	if (clip == null) {
		throw new ApiError(meta.errors.noSuchClip);
	}

	await Clips.update(clip.id, {
		name: ps.name,
		description: ps.description,
		isPublic: ps.isPublic,
	});

	return await Clips.pack(clip.id);
});
