/**
 * @packageDocumentation
 *
 * お知らせを既読にする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/read-announcement`（POST `/api/i/read-announcement` で呼び出し）
 * - 認証必須。announcementId で指定したお知らせを既読として記録する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { genId } from "@/misc/gen-id.js";
import { AnnouncementReads, Announcements, Users } from "@/models/index.js";
import { publishMainStream } from "@/services/stream.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:account",

	errors: {
		noSuchAnnouncement: {
			message: "そのお知らせは存在しません。",
			code: "NO_SUCH_ANNOUNCEMENT",
			id: "184663db-df88-4bc2-8b52-fb85f0681939",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		announcementId: { type: "string", format: "misskey:id" },
	},
	required: ["announcementId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// お知らせの存在を確認する
	const announcement = await Announcements.findOneBy({ id: ps.announcementId });

	if (announcement == null) {
		throw new ApiError(meta.errors.noSuchAnnouncement);
	}

	// 既読か確認する
	const read = await AnnouncementReads.findOneBy({
		announcementId: ps.announcementId,
		userId: user.id,
	});

	if (read != null) {
		return;
	}

	// 既読を作成する
	await AnnouncementReads.insert({
		id: genId(),
		createdAt: new Date(),
		announcementId: ps.announcementId,
		userId: user.id,
	});

	if (!(await Users.getHasUnreadAnnouncement(user.id))) {
		publishMainStream(user.id, "readAllAnnouncements");
	}
});
