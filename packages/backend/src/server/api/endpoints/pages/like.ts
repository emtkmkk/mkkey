/**
 * @packageDocumentation
 *
 * ページにいいねする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `pages/like`（POST `/api/pages/like` で呼び出し）
 * - 認証必須。pageId で指定したページにいいねを付ける。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Pages, PageLikes } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
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
			id: "cc98a8a2-0dc3-4123-b198-62c71df18ed3",
		},

		alreadyLiked: {
			message: "The page has already been liked.",
			code: "ALREADY_LIKED",
			id: "cc98a8a2-0dc3-4123-b198-62c71df18ed3",
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

	// 既にいいね済みの場合
	const exist = await PageLikes.findOneBy({
		pageId: page.id,
		userId: user.id,
	});

	if (exist != null) {
		throw new ApiError(meta.errors.alreadyLiked);
	}

	// いいねを作成する
	await PageLikes.insert({
		id: genId(),
		createdAt: new Date(),
		pageId: page.id,
		userId: user.id,
	});

	Pages.increment({ id: page.id }, "likedCount", 1);
});
