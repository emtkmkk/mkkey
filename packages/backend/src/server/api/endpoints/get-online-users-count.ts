import { IsNull,MoreThan } from "typeorm";
import { USER_HALFONLINE_THRESHOLD } from "@/const.js";
import { Users } from "@/models/index.js";
import define from "../define.js";

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	requireCredentialPrivateMode: true,
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	const count = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - USER_HALFONLINE_THRESHOLD)),
		isBot: false,
		isDeleted: false,
	});

	return {
		count,
	};
});
