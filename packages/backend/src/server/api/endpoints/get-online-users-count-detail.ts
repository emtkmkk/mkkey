import { IsNull, MoreThan, LessThan } from "typeorm";
import {
	USER_HALFONLINE_THRESHOLD,
	USER_ACTIVE2_THRESHOLD,
	USER_HALFSLEEP_THRESHOLD,
	USER_SUPERSLEEP_THRESHOLD,
	SEC,
	DAY,
} from "@/const.js";
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
	const onlineCount = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - USER_HALFONLINE_THRESHOLD)),
		isBot: false,
		isDeleted: false,
	});
	const activeCount =
		(await Users.countBy({
			host: IsNull(),
			lastActiveDate: MoreThan(new Date(Date.now() - USER_ACTIVE2_THRESHOLD)),
			isBot: false,
			isDeleted: false,
		})) - onlineCount;
	const offlineCount =
		(await Users.countBy({
			host: IsNull(),
			lastActiveDate: MoreThan(new Date(Date.now() - USER_HALFSLEEP_THRESHOLD)),
			isBot: false,
			isDeleted: false,
		})) -
		onlineCount -
		activeCount;
	const sleepCount = await Users.countBy({
		host: IsNull(),
		lastActiveDate: LessThan(new Date(Date.now() - USER_HALFSLEEP_THRESHOLD)),
		isBot: false,
		isDeleted: false,
		notesCount: MoreThan(50),
	});
	return {
		onlineCount,
		activeCount,
		offlineCount,
		sleepCount, //,o150s,o5m,o10m,o30m,o60m,o2h,o3h,o6h,o12h,o24h,o2d,o3d,o4d,o7d,o14d,o30d,omore
	};
});
