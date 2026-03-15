/**
 * @packageDocumentation
 *
 * アンテナの詳細を 1 件取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `antennas/show`（GET `/api/antennas/show` で呼び出し）
 * - 認証必須。antennaId で指定したアンテナを返す。存在しない場合は noSuchAntenna エラー。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { Antennas } from "@/models/index.js";

export const meta = {
	tags: ["antennas", "account"],

	requireCredential: true,

	kind: "read:account",

	description:
		"指定した ID のアンテナ 1 件の詳細を取得する。アンテナの投稿一覧は antennas/notes。",

	errors: {
		noSuchAntenna: {
			message: "そのantennaは存在しません。",
			code: "NO_SUCH_ANTENNA",
			id: "c06569fb-b025-4f23-b22d-1fcd20d2816b",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Antenna",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		antennaId: { type: "string", format: "misskey:id" },
	},
	required: ["antennaId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// アンテナを取得する
	const antenna = await Antennas.findOneBy({
		id: ps.antennaId,
		userId: me.id,
	});

	if (antenna == null) {
		throw new ApiError(meta.errors.noSuchAntenna);
	}

	return await Antennas.pack(antenna);
});
