/**
 * 指定した絵文字名と同名のリモート絵文字一覧を返す（ライセンス情報付き）。
 * 同名が複数ある場合にどれを申請するか選ぶための API。
 *
 * @public
 */
import { IsNull, Not } from "typeorm";
import define from "../../define.js";
import { Emojis } from "@/models/index.js";
import { toPuny } from "@/misc/convert-host.js";

export const meta = {
	tags: ["emoji-import-request"],
	requireCredential: true,
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			emojis: {
				type: "array",
				items: {
					type: "object",
					properties: {
						id: { type: "string" },
						name: { type: "string" },
						host: { type: "string", nullable: true },
						url: { type: "string" },
						license: { type: "string", nullable: true },
						copyPermission: { type: "string", nullable: true },
						licenseName: { type: "string", nullable: true },
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		emojiName: { type: "string", minLength: 1, maxLength: 128 },
	},
	required: ["emojiName"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const emojiName = ps.emojiName.trim();
	const emojis = await Emojis.find({
		where: {
			name: emojiName,
			host: Not(IsNull()),
		},
		order: { id: "ASC" },
	});

	const items = emojis.map((e) => ({
		id: e.id,
		name: e.name,
		host: e.host,
		url: e.originalUrl ?? e.publicUrl,
		license: e.license,
		copyPermission: e.copyPermission,
		licenseName: e.licenseName,
	}));

	return { emojis: items };
});
