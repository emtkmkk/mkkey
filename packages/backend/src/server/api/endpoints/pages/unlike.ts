/**
 * @packageDocumentation
 *
 * ページのいいねを解除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `pages/unlike`（POST `/api/pages/unlike` で呼び出し）
 * - 認証必須。pageId で指定したページのいいねを外す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Pages, PageLikes } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["pages"],

	requireCredential: true,

	kind: "write:page-likes",

	errors: {
		noSuchPage: {
			message: "そのpageは存在しません。",
			code: "NO_SUCH_PAGE",
			id: "a0d41e20-1993-40bd-890e-f6e560ae648e",
		},

		notLiked: {
			message: "You have not liked that page.",
			code: "NOT_LIKED",
			id: "f5e586b0-ce93-4050-b0e3-7f31af5259ee",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		pageId: { type: "string", format: "misskey:id" },
	},
	required: ["pageId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const page = await Pages.findOneBy({ id: ps.pageId });
	if (page == null) {
		throw new ApiError(meta.errors.noSuchPage);
	}

	const exist = await PageLikes.findOneBy({
		pageId: page.id,
		userId: user.id,
	});

	if (exist == null) {
		throw new ApiError(meta.errors.notLiked);
	}

	// いいねを削除する
	await PageLikes.delete(exist.id);

	Pages.decrement({ id: page.id }, "likedCount", 1);
});
