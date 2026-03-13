/**
 * @packageDocumentation
 *
 * ActivityPub の Flag アクティビティを処理する。通報として AbuseUserReports に記録する。
 *
 * @remarks
 * - **役割**: inbox で Flag を受信した際に、通報内容を AbuseUserReports に保存する。
 *
 * @see {@link models/entities/abuse-user-report} 通報エンティティ
 * @internal
 */
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import config from "@/config/index.js";
import type { IFlag } from "../../type.js";
import { getApIds } from "../../type.js";
import { AbuseUserReports, Users } from "@/models/index.js";
import { In } from "typeorm";
import { genId } from "@/misc/gen-id.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IFlag,
): Promise<string> => {
	// オブジェクトは `(User | Note) | (User | Note) []` だが DB スキーマの全パターンと一致させられないため、
	// 対象ユーザーは先頭のユーザーとし、それ以外はコメントとして保存する
	const uris = getApIds(activity.object);

	const userIds = uris
		.filter((uri) => uri.startsWith(`${config.url}/users/`))
		.map((uri) => uri.split("/").pop()!);
	const users = await Users.findBy({
		id: In(userIds),
	});
	if (users.length < 1) return "skip";

	await AbuseUserReports.insert({
		id: genId(),
		createdAt: new Date(),
		targetUserId: users[0].id,
		targetUserHost: users[0].host,
		reporterId: actor.id,
		reporterHost: actor.host,
		comment: `${activity.content}\n${JSON.stringify(uris, null, 2)}`,
	});

	return "ok";
};
