/**
 * @packageDocumentation
 *
 * ギャラリー投稿にいいねする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `gallery/posts/like`（POST `/api/gallery/posts/like` で呼び出し）
 * - 認証必須。postId で指定したギャラリー投稿にいいねを付ける。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { GalleryPosts, GalleryLikes } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";

export const meta = {
	tags: ["gallery"],

	requireCredential: true,

	kind: "write:gallery-likes",

	errors: {
		noSuchPost: {
			message: "そのpostは存在しません。",
			code: "NO_SUCH_POST",
			id: "56c06af3-1287-442f-9701-c93f7c4a62ff",
		},

		alreadyLiked: {
			message: "The post has already been liked.",
			code: "ALREADY_LIKED",
			id: "40e9ed56-a59c-473a-bf3f-f289c54fb5a7",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		postId: { type: "string", format: "misskey:id" },
	},
	required: ["postId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const post = await GalleryPosts.findOneBy({ id: ps.postId });
	if (post == null) {
		throw new ApiError(meta.errors.noSuchPost);
	}

	// 既にいいね済みの場合
	const exist = await GalleryLikes.findOneBy({
		postId: post.id,
		userId: user.id,
	});

	if (exist != null) {
		throw new ApiError(meta.errors.alreadyLiked);
	}

	// いいねを作成する
	await GalleryLikes.insert({
		id: genId(),
		createdAt: new Date(),
		postId: post.id,
		userId: user.id,
	});

	await GalleryPosts.increment({ id: post.id }, "likedCount", 1);
});
