/**
 * @packageDocumentation
 *
 * ローカルのアカウント削除の予約（予約中の人の一覧・予約・取り消し）。
 *
 * @remarks
 * - 予約中の人は、予約の取り消し以外の API を使えず、ストリーミングにもつながれない
 *   （server/api/call.ts・server/api/streaming.ts が {@link isAccountDeletionScheduled} で確かめる）。
 * - すべての API 呼び出しで確かめるので、予約中の人の ID を各プロセスのメモリに持つ（ふつう数人）。
 *   予約・取り消し・削除のたびに内部イベント `accountDeletionScheduleUpdated` を流し、
 *   受け取ったプロセスは一覧を捨てて、次に使うときに DB から読み直す。
 * - 日時の決め方は misc/account-deletion-schedule.ts にまとめてある。
 *
 * @see {@link models/entities/account-deletion-schedule} 予約の表
 * @internal
 */
import { IsNull, Not } from "typeorm";
import {
	AccountDeletionSchedules,
	UserProfiles,
	Users,
} from "@/models/index.js";
import type { ILocalUser, User } from "@/models/entities/user.js";
import { subscriber } from "@/db/redis.js";
import { publishInternalEvent } from "@/services/stream.js";
import Logger from "@/services/logger.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import {
	computeAccountDeletionReRequestableAt,
	computeAccountDeletionScheduledAt,
	formatJstDateTime,
} from "@/misc/account-deletion-schedule.js";
import { createNotification } from "@/services/create-notification.js";
import { buildGuidanceEmail, sendEmail } from "@/services/send-email.js";

const logger = new Logger("account-deletion-schedule");

// #region 予約中の人の一覧（メモリ）

/**
 * 予約中の人の ID。null なら未読み込み（次に使うときに DB から読む）。
 *
 * @remarks
 * 内部イベントを受け取ると null に戻す。読み込み中に重ねて読まないよう、読み込みの Promise も持つ。
 *
 * @internal
 */
let scheduledUserIds: Set<User["id"]> | null = null;
let loading: Promise<Set<User["id"]>> | null = null;

/**
 * 予約中の人の ID を DB から読む。
 *
 * @returns 予約中の人の ID
 * @internal
 */
async function loadScheduledUserIds(): Promise<Set<User["id"]>> {
	const rows = await AccountDeletionSchedules.find({
		select: ["userId"],
		where: { scheduledAt: Not(IsNull()) },
	});
	return new Set(rows.map((row) => row.userId));
}

/**
 * そのユーザーがアカウント削除を予約中か。
 *
 * @param userId - ユーザー ID
 * @returns 予約中なら true
 *
 * @remarks
 * NOTE: DB から読めなかったときは false（止めない）にする。ここで失敗するとすべての API が使えなくなるため。
 * 予約中の人が一時的に操作できてしまうだけで、削除そのもの（ジョブ）は DB の予約を見て行う。
 *
 * @internal
 */
export async function isAccountDeletionScheduled(
	userId: User["id"],
): Promise<boolean> {
	if (scheduledUserIds == null) {
		loading ??= loadScheduledUserIds().finally(() => {
			loading = null;
		});
		try {
			scheduledUserIds = await loading;
		} catch (err) {
			logger.warn(`Failed to load account deletion schedules: ${err}`);
			return false;
		}
	}
	return scheduledUserIds.has(userId);
}

/**
 * 予約の状態が変わったことを全プロセスに知らせる（予約・取り消し・削除のあとに呼ぶ）。
 *
 * @internal
 */
export function publishAccountDeletionScheduleUpdated(): void {
	scheduledUserIds = null;
	publishInternalEvent("accountDeletionScheduleUpdated", {});
}

/**
 * 予約の状態が変わったあとの後始末（全プロセスへの知らせと、自分の情報のキャッシュの破棄）。
 *
 * @param userId - 状態が変わったユーザー
 * @returns 終わった時点で解決する Promise
 *
 * @remarks
 * 自分の情報（`i`）は Redis にキャッシュされていて、予約の予定日時もそこに入る。
 * 消さないと、予約・取り消しのあとも画面が古い状態を見てしまう。
 *
 * @internal
 */
export async function afterAccountDeletionScheduleChanged(
	userId: User["id"],
): Promise<void> {
	publishAccountDeletionScheduleUpdated();
	await Users.invalidateMeDetailedBaseCache(userId);
}

subscriber.on("message", (_, data) => {
	try {
		const obj = JSON.parse(data);
		if (
			obj.channel === "internal" &&
			obj.message?.type === "accountDeletionScheduleUpdated"
		) {
			scheduledUserIds = null;
		}
	} catch {
		// ほかのチャンネルの、JSON でない値は無視する
	}
});

// #endregion

// #region 予約・取り消し

/**
 * 予約・取り消しで起きるエラーの ID（API が ApiError に置き換える）。
 *
 * @internal
 */
export const ACCOUNT_DELETION_ERRORS = {
	/** もう予約している */
	alreadyScheduled: "9f3c1a2e-4b5d-4e6f-8a7b-1c2d3e4f5a6b",
	/** 取り消したばかりで、まだ予約できない */
	tooSoonAfterCancel: "2a4b6c8d-0e1f-4a3b-9c5d-7e8f9a0b1c2d",
	/** 予約していない */
	notScheduled: "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b",
	/** 予約できないユーザー（凍結中・削除済み・リモート） */
	notAllowed: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
} as const;

/**
 * 予約の状態（本人・管理者向けの表示に使う）。
 *
 * @internal
 */
export type AccountDeletionState = {
	/** 削除の予定日時。予約していなければ null */
	scheduledAt: Date | null;
	/** 最後に予約した日時 */
	requestedAt: Date | null;
	/** 取り消したばかりで予約できないとき、再び予約できる日時。予約できるなら null */
	reRequestableAt: Date | null;
	/** 今予約したら削除される日時（確認の画面に出す） */
	scheduledAtIfRequestedNow: Date;
	/** 予約中のとき、今取り消したら再び予約できる日時（取り消しの確認に出す）。予約していなければ null */
	reRequestableAtIfCanceledNow: Date | null;
};

/**
 * 予約の状態を返す。
 *
 * @param userId - ユーザー ID
 * @param now - 今の日時（テスト用に渡せる）
 * @returns 予約の状態
 * @internal
 */
export async function getAccountDeletionState(
	userId: User["id"],
	now: Date = new Date(),
): Promise<AccountDeletionState> {
	const row = await AccountDeletionSchedules.findOneBy({ userId });
	const scheduledAt = row?.scheduledAt ?? null;
	const reRequestableAt =
		scheduledAt == null && row?.canceledAt != null
			? computeAccountDeletionReRequestableAt(row.canceledAt)
			: null;

	return {
		scheduledAt,
		requestedAt: row?.requestedAt ?? null,
		reRequestableAt:
			reRequestableAt != null && reRequestableAt.getTime() > now.getTime()
				? reRequestableAt
				: null,
		scheduledAtIfRequestedNow: computeAccountDeletionScheduledAt(now),
		reRequestableAtIfCanceledNow:
			scheduledAt != null ? computeAccountDeletionReRequestableAt(now) : null,
	};
}

/**
 * アカウント削除を予約する（本人確認は呼び出し側で済ませておく）。
 *
 * @param user - 予約するローカルユーザー
 * @param now - 今の日時（テスト用に渡せる）
 * @returns 削除の予定日時
 * @throws {@link IdentifiableError} 予約できないとき（{@link ACCOUNT_DELETION_ERRORS}）
 *
 * @remarks
 * - 予約したら、管理者全員に通知し、本人にメールを送る（確認済みのアドレスがある人だけ）。
 * - NB: 同じ人が同時に 2 回予約すると、両方とも通ることがある（あとの方で予定日時が上書きされるだけ）。
 *   画面からは確認のダイアログを挟むので、実際にはまず起きない。
 *
 * @internal
 */
export async function requestAccountDeletion(
	user: ILocalUser,
	now: Date = new Date(),
): Promise<Date> {
	const current = await Users.findOneBy({ id: user.id });
	if (current == null || current.host != null || current.isDeleted || current.isSuspended) {
		throw new IdentifiableError(ACCOUNT_DELETION_ERRORS.notAllowed, "not allowed");
	}

	const state = await getAccountDeletionState(user.id, now);
	if (state.scheduledAt != null) {
		throw new IdentifiableError(ACCOUNT_DELETION_ERRORS.alreadyScheduled, "already scheduled");
	}
	if (state.reRequestableAt != null) {
		throw new IdentifiableError(ACCOUNT_DELETION_ERRORS.tooSoonAfterCancel, "too soon after cancel");
	}

	const scheduledAt = computeAccountDeletionScheduledAt(now);
	await AccountDeletionSchedules.upsert(
		{
			userId: user.id,
			requestedAt: now,
			scheduledAt,
			executedAt: null,
		},
		["userId"],
	);
	await afterAccountDeletionScheduleChanged(user.id);
	logger.info(`Account deletion scheduled: ${user.id} at ${scheduledAt.toISOString()}`);

	notifyAdmins(user.id, "scheduled", scheduledAt);
	sendScheduledEmail(user, scheduledAt).catch((err) =>
		logger.warn(`Failed to send account deletion email: ${err}`),
	);

	return scheduledAt;
}

/**
 * アカウント削除の予約を取り消す。
 *
 * @param userId - 取り消すユーザー
 * @param now - 今の日時（テスト用に渡せる）
 * @returns 再び予約できる日時
 * @throws {@link IdentifiableError} 予約していないとき（{@link ACCOUNT_DELETION_ERRORS}）
 *
 * @remarks
 * - 本人が取り消しても管理者が取り消しても、再び予約できるのは次の 20:00 から（同じ決まり）。
 * - 取り消したら、管理者全員に通知する。
 *
 * @internal
 */
export async function cancelAccountDeletion(
	userId: User["id"],
	now: Date = new Date(),
): Promise<Date> {
	const result = await AccountDeletionSchedules.createQueryBuilder()
		.update()
		.set({ scheduledAt: null, canceledAt: now })
		.where('"userId" = :userId AND "scheduledAt" IS NOT NULL', { userId })
		.execute();
	if (!result.affected) {
		throw new IdentifiableError(ACCOUNT_DELETION_ERRORS.notScheduled, "not scheduled");
	}
	await afterAccountDeletionScheduleChanged(userId);
	logger.info(`Account deletion canceled: ${userId}`);

	notifyAdmins(userId, "canceled", null);

	return computeAccountDeletionReRequestableAt(now);
}

// #endregion

// #region 通知とメール

/**
 * 管理者全員（ローカル）に、予約・取り消しを知らせる。
 *
 * @param userId - 予約した本人（通知した人として出す）
 * @param kind - 予約したか取り消したか
 * @param scheduledAt - 削除の予定日時（予約のとき）
 *
 * @remarks
 * - 通知の種類は既存の `app`（見出しと本文を自由に書ける）を使う。新しい種類を足さずに済むため（ユーザーの判断）。
 * - 通知した人（notifierId）を本人にするので、押すとその人のページを開ける。
 * - 予約・取り消しの API を待たせないよう、裏で送る。本人が管理者のときは、本人には送らない（createNotification が弾く）。
 *
 * @internal
 */
function notifyAdmins(
	userId: User["id"],
	kind: "scheduled" | "canceled",
	scheduledAt: Date | null,
): void {
	setImmediate(async () => {
		try {
			const admins = await Users.find({
				where: { isAdmin: true, host: IsNull() },
				select: ["id"],
			});
			for (const admin of admins) {
				await createNotification(admin.id, "app", {
					notifierId: userId,
					customHeader:
						kind === "scheduled"
							? "アカウント削除の予約がありました"
							: "アカウント削除の予約が取り消されました",
					customBody:
						kind === "scheduled" && scheduledAt
							? `${formatJstDateTime(scheduledAt)}（日本時間）に削除されます`
							: "予約は解除されました",
				});
			}
		} catch (err) {
			logger.warn(`Failed to notify admins of account deletion: ${err}`);
		}
	});
}

/**
 * 予約した本人に、予定日時と取り消し方をメールで知らせる。
 *
 * @param user - 予約した本人
 * @param scheduledAt - 削除の予定日時
 * @returns 送り終わった時点で解決する Promise（確認済みのアドレスが無ければ何もしない）
 * @internal
 */
async function sendScheduledEmail(user: ILocalUser, scheduledAt: Date): Promise<void> {
	const profile = await UserProfiles.findOneBy({ userId: user.id });
	if (!profile?.email || !profile.emailVerified) return;

	const mail = await buildGuidanceEmail({
		subjectBody: "アカウント削除の予約を受け付けました",
		recipientUsername: user.username,
		greeting: "plain",
		paragraphs: [
			`ご利用のアカウント（@${user.username}）の削除の予約を受け付けました。`,
			`${formatJstDateTime(scheduledAt)}（日本時間）ごろに削除される予定です。`,
			"削除されるまでの間は、予約の解除のほかは操作できません。",
			"予約を解除する場合は、{serverName}にログインして「予約を解除」を押してください。",
		],
		closing: "お心当たりが無い場合は、すぐにログインして予約を解除し、パスワードを変更してください。",
	});
	await sendEmail(profile.email, mail.subject, mail.html, mail.text);
}

// #endregion
