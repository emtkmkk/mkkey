/**
 * @packageDocumentation
 *
 * プッシュをオンにしている全ユーザーへ告知をプッシュ配信する管理 API。
 *
 * @remarks
 * - **API パス**: `admin/push-notice`
 * - **プッシュ専用**。Notification 行もストリームイベントも作らないため、
 *   アプリ内には何も残らない。プッシュ通知自体の不調を知らせる用途を想定している。
 * - 端末側では「オンライン時は通知を表示しない」設定を無視して必ず表示する。
 * - 実配信はキューに委譲する（対象が多いとリクエスト内で完結しないため）。
 *
 * @internal
 */
import define from "../../define.js";
import { SwSubscriptions } from "@/models/index.js";
import { createBroadcastPushNoticeJob } from "@/queue/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:push-notice",

	description:
		"プッシュ通知を有効にしている全ユーザーへ、プッシュ専用の告知を配信する。アプリ内通知は作られない。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			enqueued: { type: "boolean", optional: false, nullable: false },
			targetUserCount: { type: "number", optional: false, nullable: false },
			subscriptionCount: { type: "number", optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		title: { type: "string", minLength: 1, maxLength: 100 },
		body: { type: "string", minLength: 1, maxLength: 300 },
		/** タップ時に開くパス。同一オリジンの相対パスのみ受け付ける */
		url: { type: "string", nullable: true },
		/** 同じ告知を重ねて表示させないためのタグ */
		tag: { type: "string", nullable: true, maxLength: 64 },
		/** true のときは配信せず対象数だけ返す */
		dryRun: { type: "boolean", default: false },
	},
	required: ["title", "body"],
} as const;

/**
 * 告知のリンク先として安全なパスか。
 *
 * @remarks
 * 外部サイトや `javascript:` へ飛ばせないよう、同一オリジンの相対パスに限定する。
 *
 * @internal
 */
export function isSafeNoticePath(url: string): boolean {
	// "//example.com" は protocol-relative URL なので弾く
	return url.startsWith("/") && !url.startsWith("//");
}

export default define(meta, paramDef, async (ps, me) => {
	const rows = await SwSubscriptions.createQueryBuilder("s")
		.select("s.userId", "userId")
		.distinct(true)
		.getRawMany<{ userId: string }>();

	const targetUserCount = rows.length;
	const subscriptionCount = await SwSubscriptions.count();

	if (ps.dryRun) {
		return { enqueued: false, targetUserCount, subscriptionCount };
	}

	const url =
		typeof ps.url === "string" && ps.url !== "" && isSafeNoticePath(ps.url)
			? ps.url
			: undefined;

	await createBroadcastPushNoticeJob({
		title: ps.title,
		body: ps.body,
		...(url != null ? { url } : {}),
		...(typeof ps.tag === "string" && ps.tag !== "" ? { tag: ps.tag } : {}),
	});

	await insertModerationLog(me, "pushNotice", {
		title: ps.title,
		body: ps.body,
		targetUserCount,
	});

	return { enqueued: true, targetUserCount, subscriptionCount };
});
