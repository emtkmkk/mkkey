/**
 * @packageDocumentation
 *
 * ユーザーを通報する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `users/report-abuse`（POST `/api/users/report-abuse` で呼び出し）
 * - 認証必須。userId と comment 等で対象ユーザーを通報する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import * as sanitizeHtml from "sanitize-html";
import { publishAdminStream } from "@/services/stream.js";
import { AbuseUserReports, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { sendEmail } from "@/services/send-email.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getUser } from "../../common/getters.js";
import { ApiError } from "../../error.js";
import define from "../../define.js";

export const meta = {
	tags: ["users"],

	requireCredential: true,

	description: "指定ユーザーを通報します。",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "1acefcb5-0959-43fd-9685-b48305736cb5",
		},

		cannotReportYourself: {
			message: "自分を通報する事は出来ません。",
			code: "CANNOT_REPORT_YOURSELF",
			id: "1e13149e-b1e8-43cf-902e-c01dbfcb202f",
		},

		cannotReportAdmin: {
			message: "管理人を通報する事は出来ません。",
			code: "CANNOT_REPORT_THE_ADMIN",
			id: "35e166f5-05fb-4f87-a2d5-adb42676d48f",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
		comment: { type: "string", minLength: 1, maxLength: 2048 },
	},
	required: ["userId", "comment"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// ユーザーを検索する
	const user = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	if (user.id === me.id) {
		throw new ApiError(meta.errors.cannotReportYourself);
	}

	if (user.isAdmin) {
		throw new ApiError(meta.errors.cannotReportAdmin);
	}

	const report = await AbuseUserReports.insert({
		id: genId(),
		createdAt: new Date(),
		targetUserId: user.id,
		targetUserHost: user.host,
		reporterId: me.id,
		reporterHost: null,
		comment: ps.comment,
	}).then((x) => AbuseUserReports.findOneByOrFail(x.identifiers[0]));

	// モデレーターにイベントを発行する
	setImmediate(async () => {
		const moderators = await Users.find({
			where: [
				{
					isAdmin: true,
				},
				{
					isModerator: true,
				},
			],
		});

		for (const moderator of moderators) {
			publishAdminStream(moderator.id, "newAbuseUserReport", {
				id: report.id,
				targetUserId: report.targetUserId,
				reporterId: report.reporterId,
				comment: report.comment,
			});
		}

		const meta = await fetchMeta();
		if (meta.email) {
			sendEmail(
				meta.email,
				"New abuse report",
				sanitizeHtml(ps.comment),
				sanitizeHtml(ps.comment),
			);
		}
	});
});
