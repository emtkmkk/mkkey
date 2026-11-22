/**
 * 指定した絵文字名と同名のリモート絵文字一覧を返す（ライセンス情報付き）。
 * 同名が複数ある場合にどれを申請するか選ぶための API。
 *
 * @remarks
 * - 申請できない絵文字（禁止ホスト・コピー拒否）と、画像が変わる前の控え（oldEmoji）は返さない。
 *   返すと選んだ後で申請が断られるため。結果が空なら、クライアントは「申請できません」と表示する。
 * - copyPermission は DB の短い形（a/d/c/n）ではなく、API 共通の完全形（allow など）で返す。
 *
 * @public
 */
import { IsNull, Not } from "typeorm";
import define from "../../define.js";
import { Emojis } from "@/models/index.js";
import { toPuny } from "@/misc/convert-host.js";
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import { isRemoteEmojiCopyDenied } from "@/misc/emoji-copy-policy.js";

export const meta = {
	tags: ["emoji-import-request"],
	requireCredential: true,
	kind: "read:account",
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
						aliasCount: { type: "integer" },
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
			oldEmoji: false,
		},
		order: { id: "ASC" },
	});

	const items = emojis
		.filter((e) => !isRemoteEmojiCopyDenied(e))
		.map((e) => ({
			id: e.id,
			name: e.name,
			host: e.host,
			url: e.originalUrl ?? e.publicUrl,
			license: e.license,
			copyPermission: fromStoredCopyPermission(e.copyPermission),
			licenseName: e.licenseName,
			aliasCount: (e.aliases ?? []).length,
		}));

	return { emojis: items };
});
