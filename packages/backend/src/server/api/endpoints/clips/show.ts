/**
 * @packageDocumentation
 *
 * クリップの詳細を 1 件取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `clips/show`（GET `/api/clips/show` で呼び出し）
 * - 認証不要（プライベートモード時は必須）。clipId で指定したクリップを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { Clips } from "@/models/index.js";

export const meta = {
	tags: ["clips", "account"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	kind: "read:account",

	description:
		"指定した ID のクリップ 1 件の詳細を取得する。クリップに含まれる投稿一覧は clips/notes。",

	errors: {
		noSuchClip: {
			message: "そのclipは存在しません。",
			code: "NO_SUCH_CLIP",
			id: "c3c5fe33-d62c-44d2-9ea5-d997703f5c20",
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
	},
	required: ["clipId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// クリップを取得する
	const clip = await Clips.findOneBy({
		id: ps.clipId,
	});

	if (clip == null) {
		throw new ApiError(meta.errors.noSuchClip);
	}

	if (!clip.isPublic && (me == null || clip.userId !== me.id)) {
		throw new ApiError(meta.errors.noSuchClip);
	}

	return await Clips.pack(clip);
});
