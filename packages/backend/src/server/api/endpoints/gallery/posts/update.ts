/**
 * @packageDocumentation
 *
 * ギャラリー投稿を更新する API エンドポイント。
 *
 * @remarks
 * - 所有者チェック後に更新し、pack した投稿を返す
 *
 * @internal
 */
import define from "../../../define.js";
import { DriveFiles, GalleryPosts } from "@/models/index.js";
import { ApiError } from "../../../error.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { HOUR } from "@/const.js";

export const meta = {
	tags: ["gallery"],

	requireCredential: true,

	kind: "write:gallery",

	limit: {
		duration: HOUR,
		max: 300,
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "GalleryPost",
	},

	errors: {
		noSuchPost: {
			message: "そのpostは存在しません。",
			code: "NO_SUCH_POST",
			id: "b9e4d3f2-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
		},
		noSuchFile: {
			message: "そのファイルは存在しません。",
			code: "NO_SUCH_FILE",
			id: "c0f5e4d3-6d7e-8f9a-0b1c-2d3e4f5a6b7c",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		postId: { type: "string", format: "misskey:id" },
		title: { type: "string", minLength: 1 },
		description: { type: "string", nullable: true },
		fileIds: {
			type: "array",
			uniqueItems: true,
			minItems: 1,
			maxItems: 32,
			items: {
				type: "string",
				format: "misskey:id",
			},
		},
		isSensitive: { type: "boolean", default: false },
	},
	required: ["postId", "title", "fileIds"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const post = await GalleryPosts.findOneBy({
		id: ps.postId,
		userId: user.id,
	});

	if (post == null) {
		throw new ApiError(meta.errors.noSuchPost);
	}

	const files = (
		await Promise.all(
			ps.fileIds.map((fileId) =>
				DriveFiles.findOneBy({
					id: fileId,
					userId: user.id,
				}),
			),
		)
	).filter((file): file is DriveFile => file != null);

	if (files.length === 0) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	await GalleryPosts.update(post.id, {
		updatedAt: new Date(),
		title: ps.title,
		description: ps.description,
		isSensitive: ps.isSensitive,
		fileIds: files.map((file) => file.id),
	});

	const updated = await GalleryPosts.findOneByOrFail({ id: post.id });

	return await GalleryPosts.pack(updated, user);
});
