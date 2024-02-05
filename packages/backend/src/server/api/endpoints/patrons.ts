import define from "../define.js";
import { redisClient } from "@/db/redis.js";

export const meta = {
	tags: ["meta"],
	description: "Get list of FireFish patrons",

	requireCredential: false,
	requireCredentialPrivateMode: false,
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	let patrons;
	const cachedPatrons = await redisClient.get("patrons");
	if (!ps.forceUpdate && cachedPatrons) {
		patrons = JSON.parse(cachedPatrons);
	} else {
		patrons = await fetch(
			"https://git.joinfirefish.org/firefish/firefish/-/raw/develop/patrons.json",
		).then((response) => response.json());
		await redisClient.set("patrons", JSON.stringify(patrons), "EX", 3600);
	}
	return {
		patrons: patrons["patrons"],
		sponsors: patrons["sponsors"],
	};
});
