/**
 * @packageDocumentation
 *
 * 休眠アカウント向けの自動削除予告メールを日次で送る system ジョブ。
 *
 * @remarks
 * - 対象: ローカル・未削除・未停止・投稿数 1000 以下・3ヶ月以上未活動・検証済みメールあり・
 *   お知らせメール受信 ON（`receiveAnnouncementEmail`）・この休眠サイクル未送信。
 * - 送信成功後に `user.inactiveDeletionWarnedAt` をセットし、同一サイクルでの再送を防ぐ。
 * - 本文は案内調で、最終活動日+4ヶ月の日付を期限として案内する。
 * - 深夜にメールが届かないよう、JST の許可時間帯（8時〜21時）以外は送信せずスキップする。
 * - 1通ごとに待ち時間（既定3分）を空けて逐次送信し（{@link runEmailBatch}）、
 *   送信中に時間帯を外れたら残りは翌日に持ち越す。
 * - メールフッタの配信停止リンクと RFC 8058 ワンクリック配信停止（List-Unsubscribe）に対応する
 *   （sendEmail の `unsubscribeToken` オプションで自動付与）。
 * - 4ヶ月での自動削除自体はこのジョブでは行わない（運用案内のみ）。
 *
 * @see {@link INACTIVE_DELETION_WARN_AFTER_MONTHS}
 * @see {@link INACTIVE_DELETION_ELIGIBLE_AFTER_MONTHS}
 * @internal
 */
import type Bull from "bull";
import { Brackets } from "typeorm";
import {
	INACTIVE_DELETION_ELIGIBLE_AFTER_MONTHS,
	INACTIVE_DELETION_WARN_AFTER_MONTHS,
	INACTIVE_DELETION_WARN_MAX_NOTES,
	INACTIVE_DELETION_WARN_SEND_HOUR_END,
	INACTIVE_DELETION_WARN_SEND_HOUR_START,
} from "@/const.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { secureRndstr } from "@/misc/secure-rndstr.js";
import { UserProfiles, Users } from "@/models/index.js";
import {
	buildGuidanceEmail,
	runEmailBatch,
	sendEmail,
} from "@/services/send-email.js";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("warn-inactive-deletion");

/**
 * 現在時刻が警告メールを送信してよい JST 時間帯かを返す。
 *
 * @remarks
 * JST は UTC+9 固定・DST なしのため、UTC 時からの単純加算で判定できる。
 *
 * @internal
 */
function isWithinJstSendWindow(): boolean {
	const jstHour = (new Date().getUTCHours() + 9) % 24;
	return (
		jstHour >= INACTIVE_DELETION_WARN_SEND_HOUR_START &&
		jstHour < INACTIVE_DELETION_WARN_SEND_HOUR_END
	);
}

// #region 日付ヘルパー
/**
 * 基準日から暦月を加算した日時を返す。
 *
 * @param base - 基準日時
 * @param months - 加算する月数（負数で減算）
 * @returns 加算後の Date
 * @internal
 */
function addCalendarMonths(base: Date, months: number): Date {
	const d = new Date(base.getTime());
	d.setMonth(d.getMonth() + months);
	return d;
}

/**
 * メール本文用に年月日を日本語表記する。
 *
 * @param date - 表示する日付
 * @returns 例: `2026年8月13日`
 * @internal
 */
function formatJapaneseDate(date: Date): string {
	return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
// #endregion

/**
 * 活動が戻っているユーザーの警告フラグをクリアする。
 *
 * @remarks
 * API 認証以外（ストリーミング等）で `lastActiveDate` だけ更新されたケース向け。
 * 警告閾値（3ヶ月）より新しい活動があれば「休眠サイクル終了」とみなす。
 *
 * @param warnThreshold - これより新しい活動ならクリア対象
 * @internal
 */
async function clearWarnedAtForReactivatedUsers(
	warnThreshold: Date,
): Promise<number> {
	const result = await Users.createQueryBuilder()
		.update()
		.set({ inactiveDeletionWarnedAt: null })
		.where('"inactiveDeletionWarnedAt" IS NOT NULL')
		.andWhere("host IS NULL")
		.andWhere(
			new Brackets((qb) => {
				qb.where(
					'"lastActiveDate" IS NOT NULL AND "lastActiveDate" > :warnThreshold',
					{ warnThreshold },
				).orWhere(
					'"lastActiveDate" IS NULL AND "createdAt" > :warnThreshold',
					{ warnThreshold },
				);
			}),
		)
		.execute();

	return result.affected ?? 0;
}

/**
 * 警告メール送信対象のローカルユーザーを取得する。
 *
 * @param warnThreshold - この日時以前の最終活動（または作成）が対象
 * @returns id / username / 活動基準日 / 検証済みメール / 配信停止トークン
 * @internal
 */
async function findWarnTargets(warnThreshold: Date): Promise<
	{
		id: string;
		username: string;
		activityBase: Date;
		email: string;
		emailUnsubscribeToken: string | null;
	}[]
> {
	const rows = await Users.createQueryBuilder("user")
		.innerJoin("user_profile", "profile", 'profile."userId" = user.id')
		.where("user.host IS NULL")
		.andWhere("user.isDeleted = false")
		.andWhere("user.isSuspended = false")
		.andWhere("user.notesCount <= :maxNotes", {
			maxNotes: INACTIVE_DELETION_WARN_MAX_NOTES,
		})
		.andWhere("user.inactiveDeletionWarnedAt IS NULL")
		.andWhere("profile.email IS NOT NULL")
		.andWhere('profile."emailVerified" = true')
		.andWhere('profile."receiveAnnouncementEmail" = true')
		.andWhere(
			new Brackets((qb) => {
				qb.where(
					"user.lastActiveDate IS NOT NULL AND user.lastActiveDate <= :warnThreshold",
					{ warnThreshold },
				).orWhere(
					"user.lastActiveDate IS NULL AND user.createdAt <= :warnThreshold",
					{ warnThreshold },
				);
			}),
		)
		.select("user.id", "id")
		.addSelect("user.username", "username")
		.addSelect("user.lastActiveDate", "lastActiveDate")
		.addSelect("user.createdAt", "createdAt")
		.addSelect("profile.email", "email")
		.addSelect('profile."emailUnsubscribeToken"', "emailUnsubscribeToken")
		.getRawMany<{
			id: string;
			username: string;
			lastActiveDate: Date | string | null;
			createdAt: Date | string;
			email: string;
			emailUnsubscribeToken: string | null;
		}>();

	return rows.map((row) => {
		const lastActive =
			row.lastActiveDate == null
				? null
				: row.lastActiveDate instanceof Date
					? row.lastActiveDate
					: new Date(row.lastActiveDate);
		const createdAt =
			row.createdAt instanceof Date
				? row.createdAt
				: new Date(row.createdAt);

		return {
			id: row.id,
			username: row.username,
			activityBase: lastActive ?? createdAt,
			email: row.email,
			emailUnsubscribeToken: row.emailUnsubscribeToken,
		};
	});
}

/**
 * 1ユーザー向けの警告メール（件名・本文）を組み立てる。
 *
 * @remarks
 * 期限（最終活動日+4ヶ月）が未来なら「{期限日}までにログインを」、
 * すでに過去なら「現在削除対象になりうる状態のため、継続希望なら一度ログインを」と案内を分ける。
 * 過去の日付を期限として見せると、もう間に合わないように読めてしまうため。
 *
 * 配信停止リンク・List-Unsubscribe ヘッダは sendEmail の `unsubscribeToken` オプションで付くため、
 * ここでは本文に含めない。
 *
 * @param username - 宛先ユーザー名（表示用）
 * @param deadline - 予告無し削除の対象になりうる日時（最終活動日+4ヶ月）
 * @returns 件名 / HTML / text 本文
 * @internal
 */
async function buildWarnEmail(
	username: string,
	deadline: Date,
): Promise<{
	subject: string;
	html: string;
	text: string;
}> {
	const loginRequest =
		deadline.getTime() > Date.now()
			? `お手数ですが、${formatJapaneseDate(
					deadline,
				)}までに一度ログインいただきますと、予告なしのアカウント削除の対象外となります。`
			: "ご利用のアカウントは、現在、予告なしで削除される可能性がある状態です。利用の継続をご希望の場合は、お手数ですが一度ログインをお願いいたします。";

	return await buildGuidanceEmail({
		subjectBody: "アカウントの取り扱いに関するご案内",
		recipientUsername: username,
		paragraphs: [
			"本メールは、一定期間ログインのないアカウントをお持ちの方にお送りしております。",
			`サーバールールにより、投稿数が${INACTIVE_DELETION_WARN_MAX_NOTES.toLocaleString(
				"ja-JP",
			)}以下で、かつ長期間ログインのないアカウントは、予告なく削除される場合がございます。`,
			loginRequest,
			"なお、ログイン後に再び長期間ログインがない場合は、改めて対象となる可能性がございますので、ご了承ください。",
		],
	});
}

/**
 * 休眠アカウントへ自動削除予告メールを送る。
 *
 * @param job - Bull ジョブ
 * @param done - 完了コールバック
 * @returns Promise
 * @remarks
 * NOTE: 送信失敗時は `inactiveDeletionWarnedAt` を立てず、翌日のジョブで再試行する。
 * @internal
 */
export async function warnInactiveDeletion(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Checking inactive local users for deletion warning...");
	job.log("info - Checking inactive local users for deletion warning...");

	const meta = await fetchMeta(true);
	if (!meta.enableEmail) {
		logger.info("Email is disabled; skip warn-inactive-deletion");
		job.log("info - Email is disabled; skip");
		done();
		return;
	}

	// #region 夜間送信ガード
	// cron は JST 18時発火だが、リトライ遅延・手動実行・サーバ TZ 誤設定への保険。
	// スキップしても warnedAt は未セットのため、翌日のジョブで改めて送信される。
	if (!isWithinJstSendWindow()) {
		logger.info("Skip: outside allowed send window (JST)");
		job.log("info - Skip: outside allowed send window (JST)");
		done();
		return;
	}
	// #endregion

	const now = new Date();
	const warnThreshold = addCalendarMonths(
		now,
		-INACTIVE_DELETION_WARN_AFTER_MONTHS,
	);

	// #region 再活動ユーザーのフラグ掃除
	const cleared = await clearWarnedAtForReactivatedUsers(warnThreshold);
	if (cleared > 0) {
		logger.info(`Cleared inactiveDeletionWarnedAt for ${cleared} users`);
		job.log(`info - Cleared warnedAt for ${cleared} users`);
	}
	// #endregion

	// #region 対象抽出と送信
	const targets = await findWarnTargets(warnThreshold);
	logger.info(`Found ${targets.length} users to warn`);
	job.log(`info - Found ${targets.length} users to warn`);

	// 1通ごとに待ち時間（既定3分）を空けて逐次送信する。
	// 待っている間に送信可能時間帯を外れたら残りは送らず、翌日のジョブに持ち越す。
	const result = await runEmailBatch(
		targets,
		async (target) => {
			const deadline = addCalendarMonths(
				target.activityBase,
				INACTIVE_DELETION_ELIGIBLE_AFTER_MONTHS,
			);

			// 配信停止トークンが未発行なら発行して保存する（ユーザー単位で固定）
			let unsubscribeToken = target.emailUnsubscribeToken;
			if (unsubscribeToken == null) {
				unsubscribeToken = secureRndstr(64);
				await UserProfiles.update(
					{ userId: target.id },
					{ emailUnsubscribeToken: unsubscribeToken },
				);
			}

			const { subject, html, text } = await buildWarnEmail(
				target.username,
				deadline,
			);

			await sendEmail(target.email, subject, html, text, {
				unsubscribeToken,
			});
			await Users.update(target.id, {
				inactiveDeletionWarnedAt: new Date(),
			});
			logger.succ(`Warned @${target.username} (${target.id})`);
			job.log(`succ - Warned @${target.username}`);
		},
		{
			shouldContinue: isWithinJstSendWindow,
			onError: (target, err) => {
				logger.error(`Failed to warn @${target.username} (${target.id})`);
				logger.error(err as Error);
				job.log(`error - Failed @${target.username}: ${String(err)}`);
			},
		},
	);
	// #endregion

	if (result.remaining > 0) {
		logger.info(
			`Send window closed; ${result.remaining} users are left for the next run`,
		);
		job.log(`info - Send window closed; remaining=${result.remaining}`);
	}

	logger.info(
		`warn-inactive-deletion done: sent=${result.sent} failed=${result.failed} remaining=${result.remaining}`,
	);
	job.log(
		`info - done: sent=${result.sent} failed=${result.failed} remaining=${result.remaining}`,
	);
	done();
}
