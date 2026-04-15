/**
 * @packageDocumentation
 *
 * 認証ユーザーのレジストリにキー・値を設定する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/registry/set`（POST `/api/i/registry/set` で呼び出し）
 * - 認証必須。key と value でレジストリに 1 件設定する。scope でスコープ指定可能。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { publishMainStream } from "@/services/stream.js";
import define from "../../../define.js";
import { RegistryItems } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";

export const meta = {
	requireCredential: true,

	secure: true,

	description:
		"ユーザー用のキー値ストア（レジストリ）に 1 件を保存する。key と value を指定し、scope で名前空間を分けられる。取得は i/registry/get または i/registry/get-all。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		key: {
			type: "string",
			minLength: 1,
			description: "保存するキー名。同じ scope 内で一意。",
		},
		value: {
			description: "保存する値。文字列・数値・真偽値・配列・オブジェクトなど。",
		},
		scope: {
			type: "array",
			default: [],
			items: {
				type: "string",
				pattern: /^[a-zA-Z0-9_]+$/.toString().slice(1, -1),
			},
			description:
				"スコープの配列。キーはこのスコープ配列と組み合わせて一意になる。空ならクライアント用の共通領域。",
		},
	},
	required: ["key", "value"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const query = RegistryItems.createQueryBuilder("item")
		.where("item.domain IS NULL")
		.andWhere("item.userId = :userId", { userId: user.id })
		.andWhere("item.key = :key", { key: ps.key })
		.andWhere("item.scope = :scope", { scope: ps.scope });

	const existingItem = await query.getOne();

	if (existingItem) {
		await RegistryItems.update(existingItem.id, {
			updatedAt: new Date(),
			value: ps.value,
		});
	} else {
		await RegistryItems.insert({
			id: genId(),
			createdAt: new Date(),
			updatedAt: new Date(),
			userId: user.id,
			domain: null,
			scope: ps.scope,
			key: ps.key,
			value: ps.value,
		});
	}

	// TODO: サードパーティアプリが傍受出来てしまうのでどうにかする
	publishMainStream(user.id, "registryUpdated", {
		scope: ps.scope,
		key: ps.key,
		value: ps.value,
	});
});
