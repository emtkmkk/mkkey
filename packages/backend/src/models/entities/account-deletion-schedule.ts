import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";
import { id } from "../id.js";
import { User } from "./user.js";

/**
 * @packageDocumentation
 *
 * ローカルのアカウント削除の予約。
 *
 * @remarks
 * - 本人が削除を予約すると行ができ、日本時間 2:00 の定期ジョブが予定日時を過ぎたものを削除する
 *   （queue/processors/system/execute-scheduled-account-deletions.ts）。
 * - 行ができるのは一度でも予約したローカルのユーザーだけ。`user` / `user_profile` に列を足さないのは、
 *   どちらもリモートのユーザーの分を含めて数十万行あり、予約はローカルだけの話だから。
 * - 取り消しても行は消さない（`canceledAt` で再予約できる日時を決めるため）。
 *
 * @see {@link misc/account-deletion-schedule} 日時の決め方
 * @see {@link services/account-deletion-schedule} 予約・取り消し
 * @internal
 */
@Entity()
export class AccountDeletionSchedule {
	/** 予約したユーザー（主キー。1 人 1 行） */
	@PrimaryColumn(id())
	public userId: User["id"];

	@OneToOne(() => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	/** 最後に予約した日時 */
	@Column("timestamp with time zone")
	public requestedAt: Date;

	/**
	 * 削除の予定日時。空でなければ予約中。
	 *
	 * @remarks
	 * 取り消したとき、ジョブが削除を始めたときに空にする。
	 */
	@Index({ where: `"scheduledAt" IS NOT NULL` })
	@Column("timestamp with time zone", { nullable: true })
	public scheduledAt: Date | null;

	/** 最後に取り消した日時（再予約できる日時の判定に使う） */
	@Column("timestamp with time zone", { nullable: true })
	public canceledAt: Date | null;

	/** ジョブが削除を始めた日時 */
	@Column("timestamp with time zone", { nullable: true })
	public executedAt: Date | null;
}
