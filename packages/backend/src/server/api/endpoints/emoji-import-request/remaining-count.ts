/**
 * 本日の残り絵文字インポート申請回数を返す（UTC 0:00 リセット）。
 *
 * @public
 */
import { MoreThanOrEqual } from "typeorm";
import define from "../../define.js";
import { EmojiImportRequests } from "@/models/index.js";

const DAILY_LIMIT = 10;

function getStartOfTodayUTC(): Date {
	const now = new Date();
	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			0,
			0,
			0,
			0,
		),
	);
}

export const meta = {
	tags: ["emoji-import-request"],
	requireCredential: true,
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			remaining: { type: "number" },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const startOfToday = getStartOfTodayUTC();
	const todayCount = await EmojiImportRequests.countBy({
		requesterId: me.id,
		createdAt: MoreThanOrEqual(startOfToday),
	});
	const remaining = Math.max(0, DAILY_LIMIT - todayCount);
	return { remaining };
});
