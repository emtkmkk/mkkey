/**
 * @packageDocumentation
 *
 * ActivityPub の Announce（リノート）アクティビティを処理する。
 *
 * @remarks
 * - **役割**: inbox で Announce を受信した際に、元ノートを解決してリノートとしてローカルに作成する。
 *
 * @see {@link services/note/create} ノート作成
 * @internal
 */
import type Resolver from "../../resolver.js";
import post from "@/services/note/create.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { IAnnounce } from "../../type.js";
import { getApId } from "../../type.js";
import { fetchNote, resolveNote } from "../../models/note.js";
import { apLogger } from "../../logger.js";
import { extractDbHost } from "@/misc/convert-host.js";
import { getApLock } from "@/misc/app-lock.js";
import { parseAudience } from "../../audience.js";
import { StatusError } from "@/misc/fetch.js";
import { Notes } from "@/models/index.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";

const logger = apLogger;

/**
 * アナウンス（リノート）アクティビティを処理する
 */
export default async function (
	resolver: Resolver,
	actor: CacheableRemoteUser,
	activity: IAnnounce,
	targetUri: string,
): Promise<void> {
	const uri = getApId(activity);

	if (actor.isSuspended) {
		return;
	}

	// アナウンス先をブロックしている場合は中断
	if (await shouldBlockInstance(extractDbHost(uri))) return;

	const lock = await getApLock(uri);

	try {
		// 同一 URI のものが既に登録されていないか確認
		const exist = await fetchNote(uri);
		if (exist) {
			return;
		}

		// Announce の対象を解決
		let renote;
		try {
			renote = await resolveNote(targetUri);
		} catch (e) {
			// 対象が 4xx の場合はスキップ
			if (e instanceof StatusError) {
				if (!e.isRetryable) {
					logger.warn(`Ignored announce target ${targetUri} - ${e.statusCode}`);
					return;
				}

				logger.warn(
					`Error in announce target ${targetUri} - ${e.statusCode || e}`,
				);
			}
			throw e;
		}

		if (renote != null && !(await Notes.isVisibleForMe(renote, actor.id))) {
			logger.debug("skip: invalid actor for this activity");
			return;
		}
		logger.info(`(Re)Note を作成中: ${uri}`);

		const activityAudience = await parseAudience(
			actor,
			activity.to,
			activity.cc,
		);

		await post(actor, {
			createdAt: activity.published ? new Date(activity.published) : null,
			renote,
			visibility: activityAudience.visibility,
			visibleUsers: activityAudience.visibleUsers,
			uri,
		});
	} finally {
		await lock.release();
	}
}
