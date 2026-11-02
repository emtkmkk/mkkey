import acceptAll from "@/services/following/requests/accept-all.js";
import define from "../../define.js";
import { Antennas } from "@/models/index.js";

export const meta = {
	tags: ["antennas", "account"],

	requireCredential: true,

	kind: "read:account",

	description:
		"自分が作成したアンテナ一覧を取得する。アンテナはキーワード等で投稿を絞り込む仕組み。",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			ref: "Antenna",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		mkkey: {
			type: "boolean",
			description:
				"true のとき mkkey 独自の src（home / all / users / users_blacklist 以外）をそのまま返す。省略時は互換性のため all に丸める。",
		},
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const antennas = await Antennas.findBy({
		userId: me.id,
	});

	if (!ps.mkkey) {
		antennas.forEach((x) => {
			// 互換性
			if (
				x.src &&
				!["home", "all", "users", "users_blacklist"].includes(x.src)
			) {
				x.src = "all";
			}
		});
	}

	return await Promise.all(antennas.map((x) => Antennas.pack(x)));
});
