/**
 * @packageDocumentation
 *
 * 指定した他鯖絵文字のうち、まだこのサーバーが知っているものを返す API（`emojis/remote-exists`）。
 *
 * @remarks
 * - 端末に他鯖絵文字の辞書が無いとき、絵文字デッキ・カテゴリ編集で「この他鯖絵文字はもう無いので、
 *   同名のローカル絵文字に変換できる」と判断するために使う。辞書があるときは端末で判断するので呼ばれない。
 * - 「知っている」の範囲は絵文字一覧（emojis の allEmojis、all モード）と同じ。禁止ホスト・コピー拒否・
 *   長すぎる名前とホストは「無い」扱いにする。
 * - 受け取る形は `name@host`。前後の `:` は付いていてもよい。返す形は `name@host`（`:` なし）。
 *
 * @public
 */
import { db } from "@/db/postgre.js";
import { MINUTE } from "@/const.js";
import { toPuny } from "@/misc/convert-host.js";
import { EMOJI_COPY_DENIED_HOSTS } from "@/misc/emoji-copy-policy.js";
import define from "../../define.js";

export const meta = {
	tags: ["meta"],

	requireCredential: true,

	description:
		"指定した他鯖絵文字（name@host）のうち、サーバーが知っているものを返す。",

	limit: {
		duration: MINUTE,
		max: 60,
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			exists: {
				type: "array",
				optional: false,
				nullable: false,
				items: { type: "string", optional: false, nullable: false },
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		emojis: {
			type: "array",
			minItems: 1,
			maxItems: 1000,
			items: { type: "string", minLength: 3, maxLength: 260 },
		},
	},
	required: ["emojis"],
} as const;

export default define(meta, paramDef, async (ps) => {
	const names: string[] = [];
	const hosts: string[] = [];
	for (const raw of ps.emojis) {
		const match = raw.replace(/^:|:$/g, "").match(/^(\w+)@([\w.-]+)$/);
		if (!match) continue;
		names.push(match[1]);
		hosts.push(toPuny(match[2]));
	}
	if (names.length === 0) return { exists: [] };

	const rows = (await db.query(
		`SELECT e."name", e."host" FROM "emoji" e
		JOIN unnest($1::varchar[], $2::varchar[]) AS q("name", "host")
			ON e."name" = q."name" AND e."host" = q."host"
		WHERE e."oldEmoji" = false
			AND (e."copyPermission" IS NULL OR e."copyPermission" <> 'd')
			AND NOT (e."host" = ANY($3::varchar[]))
			AND length(e."host") < 50
			AND length(e."name") < 100`,
		[names, hosts, [...EMOJI_COPY_DENIED_HOSTS]],
	)) as { name: string; host: string }[];

	return { exists: rows.map((r) => `${r.name}@${r.host}`) };
});
