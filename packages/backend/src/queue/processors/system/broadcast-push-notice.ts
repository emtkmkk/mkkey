/**
 * @packageDocumentation
 *
 * 管理者からの一斉プッシュ告知を配信するジョブ。
 *
 * @remarks
 * - **プッシュ専用**。Notification 行もストリームイベントも作らない。
 *   「プッシュ通知が届いていない」ことを知らせる用途があるため、
 *   アプリ内に痕跡を残さずプッシュだけで伝える経路として分離している。
 * - 対象は `sw_subscription` を 1 件以上持つユーザー（＝プッシュをオンにしている人）。
 * - API リクエスト内で回すと配信中に応答が返せないため、キューに載せている。
 *
 * @see {@link services/push-notification} 送信本体
 * @internal
 */
import type Bull from "bull";
import { SwSubscriptions } from "@/models/index.js";
import { pushNotification } from "@/services/push-notification.js";
import type { PushNoticePayload } from "@/misc/push-notification-types.js";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("broadcast-push-notice");

/** 同時に送る宛先数。web-push の並列数を抑えて送信先サービスへの瞬間負荷を避ける */
const CHUNK_SIZE = 20;

export async function broadcastPushNotice(
	job: Bull.Job<Record<string, unknown>>,
	done: () => void,
): Promise<void> {
	const payload = job.data.payload as PushNoticePayload | undefined;

	if (
		payload == null ||
		typeof payload.title !== "string" ||
		typeof payload.body !== "string"
	) {
		logger.error("payload が不正なため配信を中止しました");
		done();
		return;
	}

	// プッシュをオンにしているユーザーのみ（購読の有無で判定）
	const rows = await SwSubscriptions.createQueryBuilder("s")
		.select("s.userId", "userId")
		.distinct(true)
		.getRawMany<{ userId: string }>();

	const userIds = rows.map((r) => r.userId);
	logger.info(`一斉プッシュ告知を開始します (対象 ${userIds.length} ユーザー)`);

	let delivered = 0;
	let failed = 0;

	for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
		const chunk = userIds.slice(i, i + CHUNK_SIZE);
		const reports = await Promise.all(
			chunk.map(async (userId) => {
				try {
					return await pushNotification(userId, "pushNotice", payload);
				} catch (err) {
					logger.error(`配信に失敗しました userId=${userId}`, {
						e: err as Error,
					});
					return null;
				}
			}),
		);

		for (const report of reports) {
			if (report?.ok) {
				delivered++;
			} else {
				failed++;
			}
		}
	}

	logger.info(
		`一斉プッシュ告知が完了しました (成功 ${delivered} / 失敗・未送信 ${failed})`,
	);
	done();
}
