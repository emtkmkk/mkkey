import { IsNull, MoreThan, LessThan } from "typeorm";
import { USER_HALFONLINE_THRESHOLD, USER_ACTIVE2_THRESHOLD, USER_HALFSLEEP_THRESHOLD, USER_SUPERSLEEP_THRESHOLD, SEC, DAY } from "@/const.js";
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
	const activeCount = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - USER_ACTIVE2_THRESHOLD)),
		isBot: false,
		isDeleted: false,
	}) - onlineCount;
	const offlineCount = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - USER_HALFSLEEP_THRESHOLD)),
		isBot: false,
		isDeleted: false,
	}) - onlineCount - activeCount;
	const sleepCount = await Users.countBy({
		host: IsNull(),
		lastActiveDate: LessThan(new Date(Date.now() - USER_HALFSLEEP_THRESHOLD)),
		isBot: false,
		isDeleted: false,
		notesCount: MoreThan(50),
	});
	/*const o150s = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 150 * SEC)),
		isBot: false,
	});
	const o5m = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 300 * SEC)),
		isBot: false,
	}) - o150s;
	const o10m = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 600 * SEC)),
		isBot: false,
	}) - o150s - o5m;
	const o30m = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 1800 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m;
	const o60m = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 3600 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m;
	const o2h = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 7200 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m;
	const o3h = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 10800 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h;
	const o6h = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 21600 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h;
	const o12h = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 43200 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h;
	const o24h = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 86400 * SEC)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h;
	const o2d = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 2 * DAY)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h;
	const o3d = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 3 * DAY)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h - o2d;
	const o4d = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 4 * DAY)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h - o2d - o3d;
	const o7d = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 7 * DAY)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h - o2d - o3d - o4d;
	const o14d = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 14 * DAY)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h - o2d - o3d - o4d - o7d;
	const o30d = await Users.countBy({
		host: IsNull(),
		lastActiveDate: MoreThan(new Date(Date.now() - 30 * DAY)),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h - o2d - o3d - o4d - o7d - o14d;
	const omore = await Users.countBy({
		host: IsNull(),
		lastActiveDate: LessThan(new Date(Date.now())),
		isBot: false,
	}) - o150s - o5m - o10m - o30m - o60m - o2h - o3h - o6h - o12h - o24h - o2d - o3d - o4d - o7d - o14d - o30d;*/
	return {
		onlineCount,activeCount,offlineCount,sleepCount//,o150s,o5m,o10m,o30m,o60m,o2h,o3h,o6h,o12h,o24h,o2d,o3d,o4d,o7d,o14d,o30d,omore
	};
});
