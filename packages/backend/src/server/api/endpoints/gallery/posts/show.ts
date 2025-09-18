import { DAY } from "@/const.js";
import { GalleryPosts } from "@/models/index.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";

export const meta = {
	tags: ["gallery"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	errors: {
		noSuchPost: {
			message: "そのpostは存在しません。",
			code: "NO_SUCH_POST",
			id: "1137bf14-c5b0-4604-85bb-5b5371b1cd45",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "GalleryPost",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		postId: { type: "string", format: "misskey:id" },
	},
	required: ["postId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
        const post = await GalleryPosts.findOne({
                where: { id: ps.postId },
                relations: { user: true },
        });

        if (post == null) {
                throw new ApiError(meta.errors.noSuchPost);
        }

        const activeThreshold = new Date(Date.now() - 60 * DAY);
        const author = post.user;

        if (
                author == null ||
                author.isDeleted ||
                (author.updatedAt != null && author.updatedAt < activeThreshold)
        ) {
                throw new ApiError(meta.errors.noSuchPost);
        }

        return await GalleryPosts.pack(post, me);
});
