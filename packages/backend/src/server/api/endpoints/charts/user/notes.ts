import { getJsonSchema } from "@/services/chart/core.js";
import { perUserNotesChart } from "@/services/chart/index.js";
import define from "../../../define.js";
import { Users } from "@/models/index.js";

export const meta = {
	tags: ["charts", "users", "notes"],
	requireCredentialPrivateMode: true,

	res: getJsonSchema(perUserNotesChart.schema),

	allowGet: true,
	cacheSec: 60 * 60,
} as const;

export const paramDef = {
	type: "object",
	properties: {
		span: { type: "string", enum: ["day", "hour"] },
		limit: { type: "integer", minimum: 1, maximum: 500, default: 30 },
		offset: { type: "integer", nullable: true, default: null },
		userId: { type: "string", format: "misskey:id" },
		/** 同一ユーザー名の他インスタンス分のチャートを add で付与する。件数は MAX_ADDINFO_USERS で制限。 */
		addInfo: { type: "boolean", optional: true, default: false },
	},
	required: ["span", "userId"],
} as const;

/** addInfo 有効時の他ユーザー取得上限（N+1 と長時間クエリを防ぐ）。50 を超える件数は保証しない。 */
const MAX_ADDINFO_USERS = 50;

export default define(meta, paramDef, async (ps) => {
	if (ps.addInfo) {
		const user = await Users.findOneByOrFail({ id: ps.userId });
		const getUserChart = async () => {
			return perUserNotesChart.getChart(
				ps.span,
				ps.limit,
				ps.offset ? new Date(ps.offset) : null,
				ps.userId,
			);
		};

		const users = await Users.findBy({
			usernameLower: user.username?.toLowerCase(),
		});
		const filteredUsers = users
			.filter((x) => x.id !== ps.userId)
			.slice(0, MAX_ADDINFO_USERS);

		const getAddInfo = async () => {
			const promises = filteredUsers.map(async (x) => ({
				id: x.id,
				host: x.host,
				...(await perUserNotesChart.getChart(
					ps.span,
					ps.limit,
					ps.offset ? new Date(ps.offset) : null,
					x.id,
				)),
			}));
			return Promise.all(promises);
		};

		const [userChart, addInfo] = await Promise.all([
			getUserChart(),
			getAddInfo(),
		]);
		return { ...userChart, add: addInfo };
	}
	return await perUserNotesChart.getChart(
		ps.span,
		ps.limit,
		ps.offset ? new Date(ps.offset) : null,
		ps.userId,
	);
});
