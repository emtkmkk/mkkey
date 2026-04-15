/**
 * @packageDocumentation
 *
 * 認証ユーザーのレジストリ（キー値ストア）を一括取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/registry/get-all`（GET `/api/i/registry/get-all` で呼び出し）
 * - 認証必須。スコープで絞ったレジストリキー・値をまとめて返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../../define.js";
import { RegistryItems } from "@/models/index.js";

export const meta = {
	requireCredential: true,

	secure: true,

	description:
		"レジストリの指定スコープ内のキー・値をまとめて取得する。scope を空にするとクライアント用の共通領域全体。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		scope: {
			type: "array",
			default: [],
			items: {
				type: "string",
				pattern: /^[a-zA-Z0-9_]+$/.toString().slice(1, -1),
			},
			description:
				"スコープの配列。指定したスコープに一致するキー・値だけを返す。空ならクライアント用の共通領域全体。",
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = RegistryItems.createQueryBuilder("item")
		.where("item.domain IS NULL")
		.andWhere("item.userId = :userId", { userId: user.id })
		.andWhere("item.scope = :scope", { scope: ps.scope });

	const items = await query.getMany();

	const res = {} as Record<string, any>;

	for (const item of items) {
		res[item.key] = item.value;
	}

	return res;
});
