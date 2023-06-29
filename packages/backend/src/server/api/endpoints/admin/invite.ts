import rndstr from "rndstr";
import { ApiError } from "../../error.js";
import define from "../../define.js";
import { RegistrationTickets } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: false,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			code: {
				type: "string",
				optional: false,
				nullable: false,
				example: "2ERUA5VR",
				maxLength: 8,
				minLength: 8,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (me.isSilenced || (Date.now() - new Date(me.createdAt).valueOf()) <= 7 * 24 * 60 * 60 * 1000) {
		throw new ApiError();
	}
	
	const code = rndstr({
		length: 8,
		chars: "2-9A-HJ-NP-Z", // [0-9A-Z] w/o [01IO] (32 patterns)
	});

	await RegistrationTickets.insert({
		id: genId(),
		createdAt: new Date(),
		code,
		createUserId: me.id,
	});

	return {
		code,
	};
});
