/**
 * @packageDocumentation
 *
 * ActivityPub Activity の実行。performActivity のラッパー。リモートユーザー情報の更新も行う。
 *
 * @remarks
 * - **役割**: inbox ジョブから呼ばれ、Activity 種別に応じて kernel のハンドラを実行する。
 *
 * @see {@link queue/processors/inbox} Inbox ジョブ
 * @internal
 */
import type { IObject } from "./type.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { performActivity } from "./kernel/index.js";
import { updatePerson } from "./models/person.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IObject,
	userId: string,
): Promise<void> => {
	await performActivity(actor, activity, userId);

	// リモートユーザー情報が古い場合は更新する
	if (actor.uri) {
		const lastFetchedAtTime = actor.lastFetchedAt
			? new Date(actor.lastFetchedAt).getTime()
			: null;

		if (
			lastFetchedAtTime == null ||
			Number.isNaN(lastFetchedAtTime) ||
			Date.now() - lastFetchedAtTime > 1000 * 60 * 60 * 24
		) {
			setImmediate(() => {
				updatePerson(actor.uri!);
			});
		}
	}
};
