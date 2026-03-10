import { IsNull, MoreThan } from "typeorm";
import { USER_HALFONLINE_THRESHOLD } from "@/const.js";
import { getStatsDataSource } from "@/db/postgre.js";
import { User } from "@/models/entities/user.js";
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
	const UsersRepo = getStatsDataSource().getRepository(User);
	const count = await UsersRepo.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - USER_HALFONLINE_THRESHOLD)),
		isBot: false,
		isDeleted: false,
	});

	return {
		count,
	};
});
