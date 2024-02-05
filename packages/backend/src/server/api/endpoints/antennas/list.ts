import acceptAll from "@/services/following/requests/accept-all.js";
import define from "../../define.js";
import { Antennas } from "@/models/index.js";

export const meta = {
	tags: ["antennas", "account"],

	requireCredential: true,

	kind: "read:account",

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
	properties: {},
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
