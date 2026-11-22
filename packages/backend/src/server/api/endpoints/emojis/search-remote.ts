/**
 * @packageDocumentation
 *
 * 他鯖絵文字をサーバーで検索する API（`emojis/search-remote`）。
 *
 * @remarks
 * - 端末に他鯖絵文字の辞書が無いとき（設定でオフ・まだ取れていない・保存できなかった）に、
 *   絵文字ピッカーの `@` 検索から呼ばれる。辞書があるときは端末で検索するので呼ばれない。
 * - 名前は `mk_emoji_search_key()`（クライアントの formatRoomaji と同じ変換）どうしで比べる。
 *   クライアントは検索語を formatRoomaji 済みで送る。関数とインデックスはマイグレーション
 *   `1795760000000-remote-emoji-search-index.js` で作る。
 * - 返すのは「前方一致（またはエイリアスの完全一致）」と「部分一致」の両方。各要素の `prefix` で区別する。
 *   キーワードが 2 つ以上（AND 検索）のときは部分一致だけ。
 * - 検索語が 3 文字未満のときは前方一致だけを探す。trigram の索引が使えず、全件に変換関数をかけることになるため。
 * - 同じ名前の絵文字が多くのサーバーにあると結果がそれで埋まるので、名前ごとに `perName` 件まで返す。
 *   名前の並びは「名前の前方一致 → エイリアスの完全一致 → 部分一致」、それぞれの中は検索用の名前が短い順 → 名前順。サーバーは最近更新されたものを先にする。
 * - 絵文字一覧（emojis の allEmojis）と同じく、禁止ホスト・コピー拒否・長すぎる名前とホストは除く。
 * - ローカル絵文字と同じ名前のものは除かない（利用者ごとに見えるローカル絵文字が違うため、クライアントで除く）。
 *
 * @public
 */
import { db } from "@/db/postgre.js";
import { MINUTE } from "@/const.js";
import { EMOJI_COPY_DENIED_HOSTS } from "@/misc/emoji-copy-policy.js";
import define from "../../define.js";

export const meta = {
	tags: ["meta"],

	requireCredential: true,

	description:
		"他鯖絵文字を名前とエイリアスで検索する。端末に他鯖絵文字の辞書が無いときの絵文字ピッカー用。",

	limit: {
		duration: MINUTE,
		max: 120,
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			emojis: {
				type: "array",
				optional: false,
				nullable: false,
				items: {
					type: "object",
					optional: false,
					nullable: false,
					properties: {
						name: { type: "string", optional: false, nullable: false },
						host: { type: "string", optional: false, nullable: false },
						sensitive: { type: "boolean", optional: true, nullable: false },
						/** 前方一致（またはエイリアスの完全一致）なら true、部分一致なら false */
						prefix: { type: "boolean", optional: false, nullable: false },
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		/** formatRoomaji 済みの検索語。2 つ以上なら AND 検索 */
		keywords: {
			type: "array",
			minItems: 1,
			maxItems: 5,
			items: { type: "string", minLength: 1, maxLength: 64 },
		},
		/** エイリアスと完全一致で比べる語（入力そのまま・ひらがなにしたもの など） */
		aliasQueries: {
			type: "array",
			maxItems: 4,
			items: { type: "string", minLength: 1, maxLength: 64 },
		},
		/** ホスト名の一部。指定するとそのホストの絵文字だけを探す */
		host: { type: "string", minLength: 1, maxLength: 128 },
		/** 返す名前の数 */
		limit: { type: "integer", minimum: 1, maximum: 50, default: 33 },
		/** 1 つの名前につき返すサーバーの数 */
		perName: { type: "integer", minimum: 1, maximum: 10, default: 3 },
	},
	required: ["keywords"],
} as const;

/** 部分一致を探すのに必要な検索語の長さ（trigram の索引が効く長さ） */
const MIN_PARTIAL_LENGTH = 3;

/**
 * LIKE の特殊文字（% _ \）を文字として扱うように逃がす
 *
 * @param value - 検索語
 * @returns 逃がした文字列
 * @internal
 */
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export default define(meta, paramDef, async (ps) => {
	const keywords = ps.keywords
		.map((k) => k.toLowerCase().trim())
		.filter((k) => k !== "");
	if (keywords.length === 0) return { emojis: [] };
	const aliasQueries = (ps.aliasQueries ?? [])
		.map((x) => x.trim())
		.filter((x) => x !== "");
	const limit = ps.limit ?? 33;
	const perName = ps.perName ?? 3;
	const single = keywords.length === 1;
	// 3 文字未満の 1 語は前方一致だけ。AND 検索は各語が 3 文字以上のときだけ
	const allowPartial = keywords.every((k) => k.length >= MIN_PARTIAL_LENGTH);
	if (!single && !allowPartial) return { emojis: [] };

	const params: unknown[] = [];
	const p = (value: unknown) => {
		params.push(value);
		return `$${params.length}`;
	};

	// #region 共通の絞り込み（emojis の allEmojis と同じ）
	const baseWhere = [
		`"host" IS NOT NULL`,
		`"oldEmoji" = false`,
		`("copyPermission" IS NULL OR "copyPermission" <> 'd')`,
		`NOT ("host" = ANY(${p([...EMOJI_COPY_DENIED_HOSTS])}::varchar[]))`,
		`length("host") < 50`,
		`length("name") < 100`,
	];
	if (ps.host) {
		baseWhere.push(`"host" LIKE ${p(`%${escapeLike(ps.host.toLowerCase())}%`)}`);
	}
	// #endregion

	// #region 名前を選ぶ
	const key = `mk_emoji_search_key("name")`;
	const prefixPattern = single ? p(`${escapeLike(keywords[0])}%`) : null;
	const aliasParam =
		single && aliasQueries.length > 0 ? p(aliasQueries) : null;
	const aliasCond = aliasParam ? `"aliases" && ${aliasParam}::varchar[]` : null;

	let matchCond: string;
	if (single) {
		const nameCond = allowPartial
			? `${key} LIKE ${p(`%${escapeLike(keywords[0])}%`)}`
			: `${key} LIKE ${prefixPattern}`;
		matchCond = aliasCond ? `(${nameCond} OR ${aliasCond})` : nameCond;
	} else {
		matchCond = keywords
			.map((k) => `${key} LIKE ${p(`%${escapeLike(k)}%`)}`)
			.join(" AND ");
	}
	// 名前の前方一致を先に、次にエイリアスの完全一致を出す（短い名前のエイリアス一致が名前の一致より前に来ないように）
	const namePrefixExpr = single ? `bool_or(${key} LIKE ${prefixPattern})` : "false";
	const prefixExpr = aliasCond
		? `(${namePrefixExpr} OR bool_or(${aliasCond}))`
		: namePrefixExpr;

	const names = (await db.query(
		`SELECT "name", ${namePrefixExpr} AS "namePrefix", ${prefixExpr} AS "prefix", min(length(${key})) AS "len"
		FROM "emoji"
		WHERE ${[...baseWhere, matchCond].join(" AND ")}
		GROUP BY "name"
		ORDER BY "namePrefix" DESC, "prefix" DESC, "len" ASC, "name" ASC
		LIMIT ${p(limit)}`,
		params,
	)) as { name: string; prefix: boolean }[];
	// #endregion

	if (names.length === 0) return { emojis: [] };

	// #region 名前ごとにサーバーを選ぶ
	const hostParams: unknown[] = [];
	const hp = (value: unknown) => {
		hostParams.push(value);
		return `$${hostParams.length}`;
	};
	const hostWhere = [
		`"host" IS NOT NULL`,
		`"oldEmoji" = false`,
		`("copyPermission" IS NULL OR "copyPermission" <> 'd')`,
		`NOT ("host" = ANY(${hp([...EMOJI_COPY_DENIED_HOSTS])}::varchar[]))`,
		`length("host") < 50`,
		`"name" = ANY(${hp(names.map((x) => x.name))}::varchar[])`,
	];
	if (ps.host) {
		hostWhere.push(`"host" LIKE ${hp(`%${escapeLike(ps.host.toLowerCase())}%`)}`);
	}
	const rows = (await db.query(
		`SELECT "name", "host", "sensitive" FROM "emoji"
		WHERE ${hostWhere.join(" AND ")}
		ORDER BY "name", "updatedAt" DESC NULLS LAST, "host"`,
		hostParams,
	)) as { name: string; host: string; sensitive: boolean }[];

	const hostsByName = new Map<string, { host: string; sensitive: boolean }[]>();
	for (const row of rows) {
		const list = hostsByName.get(row.name) ?? [];
		if (list.length < perName) list.push(row);
		hostsByName.set(row.name, list);
	}
	// #endregion

	return {
		emojis: names.flatMap((n) =>
			(hostsByName.get(n.name) ?? []).map((h) => ({
				name: n.name,
				host: h.host,
				...(h.sensitive ? { sensitive: true } : {}),
				prefix: n.prefix === true,
			})),
		),
	};
});
