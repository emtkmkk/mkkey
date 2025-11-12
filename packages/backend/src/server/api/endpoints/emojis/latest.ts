import { Emojis } from "@/models/index.js";
import define from "../../define.js";

export const meta = {
        tags: ["meta"],
        requireCredential: false,
        requireCredentialPrivateMode: true,
        allowGet: true,
        res: {
                type: "object",
                optional: false,
                nullable: false,
                properties: {
                        emojiUpdatedAt: {
                                type: "string",
                                optional: true,
                                nullable: true,
                        },
                },
        },
} as const;

export const paramDef = {
        type: "object",
        properties: {},
        required: [],
} as const;

export default define(meta, paramDef, async () => {
        const latestEmoji = await Emojis.createQueryBuilder("emoji")
                .select("MAX(COALESCE(emoji.updatedAt, emoji.createdAt))", "updatedAt")
                .where("emoji.oldEmoji = :oldEmoji", { oldEmoji: false })
                .andWhere("emoji.host IS NULL")
                .getRawOne<{ updatedAt: Date | string | null }>();

        let emojiUpdatedAt: string | null = null;

        if (latestEmoji?.updatedAt != null) {
                const timestamp = new Date(latestEmoji.updatedAt).valueOf();
                if (!Number.isNaN(timestamp)) {
                        emojiUpdatedAt = new Date(timestamp).toISOString();
                }
        }

        return {
                emojiUpdatedAt,
        };
});

