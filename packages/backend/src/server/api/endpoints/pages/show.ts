import { DAY } from "@/const.js";
import { Pages, Users } from "@/models/index.js";
import { IsNull } from "typeorm";
import type { Page } from "@/models/entities/page.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["pages"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description:
		"ページ 1 件の内容を取得する。pageId または name と username（@username のページ）で指定。公開ページは未認証でも取得可能。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Page",
	},

	errors: {
		noSuchPage: {
			message: "そのpageは存在しません。",
			code: "NO_SUCH_PAGE",
			id: "222120c0-3ead-4528-811b-b96f233388d7",
		},
		inactiveUserPage: {
			message: "そのpageは削除された、または現在非アクティブのユーザが作成した為、非公開に設定されています。",
			code: "INACTIVE_USER_PAGE",
			id: "97f6c408-4947-4100-96d1-67af190aa0c3",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	anyOf: [
		{
			properties: {
				pageId: { type: "string", format: "misskey:id" },
			},
			required: ["pageId"],
		},
		{
			properties: {
				name: { type: "string" },
				username: { type: "string" },
			},
			required: ["name", "username"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let page: Page | null = null;

	if (ps.pageId) {
		page = await Pages.findOneBy({ id: ps.pageId });
	} else if (ps.name && ps.username) {
		const author = await Users.findOneBy({
			host: IsNull(),
			usernameLower: ps.username.toLowerCase(),
		});
		if (author) {
			page = await Pages.findOneBy({
				name: ps.name,
				userId: author.id,
			});
		}
	}

	if (page == null) {
		throw new ApiError(meta.errors.noSuchPage);
	}

	if (!page.isPublic && (user == null || page.userId !== user.id)) {
		throw new ApiError(meta.errors.noSuchPage);
	}

        const activeThreshold = new Date(Date.now() - 60 * DAY);
        const pageAuthor = await Users.findOneBy({ id: page.userId });

        if (
                pageAuthor == null ||
                pageAuthor.isDeleted ||
                (pageAuthor.updatedAt != null && pageAuthor.updatedAt < activeThreshold)
        ) {
                throw new ApiError(meta.errors.inactiveUserPage);
        }

        if (page && user && user.id !== page.userId) {
                if (user) {
                        Pages.createQueryBuilder()
                                .update()
				.set({
					userpv: () => `"userpv" + 1`,
				})
				.where("id = :id", { id: page.id })
				.execute();
		}
	}

	return await Pages.pack(page, user);
});
