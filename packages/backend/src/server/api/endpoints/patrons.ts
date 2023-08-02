import define from "../define.js";

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

export default define(meta, paramDef, async () => {
	let patrons;
	await fetch(
		"https://git.joinfirefish.org/firefish/firefish/-/raw/develop/patrons.json",
	)
		.then((response) => response.json())
		.then((data) => {
			patrons = data["patrons"];
		});

	return patrons;
});
