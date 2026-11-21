/**
 * @packageDocumentation
 *
 * 配送先サーバの状態の変化の履歴（1 行 = 1 回の変化）。
 *
 * @remarks
 * - 自動の判断（一時停止・自動停止・閉鎖・解除）も、管理者の手動操作も、同じ表に残す。
 *   「いつ・どのサーバが・何をきっかけに・どうなったか」を後から追えるようにするため。
 * - 書くのは `services/instance-health/` だけ。状態が変わったときだけ書き、配送 1 件ごとには書かない。
 * - 保存期間は無期限（計画の決定事項 Q12）。量は 1 日数十件程度の見込み。
 * - `detail` に入れるのは、ステータス・エラーの分類・件数・日時・URL だけ。Activity やレスポンスの本文は入れない。
 *
 * @internal
 */
import { Entity, PrimaryColumn, Index, Column } from "typeorm";
import { id } from "../id.js";
import type { Instance, InstanceSuspensionState } from "./instance.js";
import type { User } from "./user.js";

/**
 * 履歴のできごとの種類。
 *
 * @remarks
 * - `circuitOpened` / `circuitClosed`: 一時停止（サーキットブレーカー）が開いた / 閉じた。長期の状態は変わらない
 * - `autoSuspended`: 不通が続いたので自動停止した
 * - `gone`: サーバ自体が 410 を返したので閉鎖停止した
 * - `unsuspendedByProbe` / `unsuspendedByInbox`: 生存確認 / 相手からの受信で停止を解除した
 * - `manualSuspended` / `manualUnsuspended`: 管理者が停止 / 解除した
 * - `migrated`: マイグレーションで状態を変えた
 *
 * 値は DB では文字列で持つので、足すのにマイグレーションは要らない。
 *
 * @public
 */
export type InstanceHealthEvent =
	| "circuitOpened"
	| "circuitClosed"
	| "autoSuspended"
	| "gone"
	| "unsuspendedByProbe"
	| "unsuspendedByInbox"
	| "manualSuspended"
	| "manualUnsuspended"
	| "migrated";

/**
 * 変化のきっかけ。
 *
 * @public
 */
export type InstanceHealthSource =
	| "deliver"
	| "inbox"
	| "probe"
	| "admin"
	| "migration";

@Entity()
@Index(["instanceId", "createdAt"])
export class InstanceHealthLog {
	@PrimaryColumn(id())
	public id: string;

	/** 記録した日時 */
	@Index()
	@Column("timestamp with time zone")
	public createdAt: Date;

	/** 対象のサーバ。行が消えたら null */
	@Column({
		...id(),
		nullable: true,
	})
	public instanceId: Instance["id"] | null;

	/** 対象のサーバのホスト（行が消えても読めるように持つ） */
	@Index()
	@Column("varchar", { length: 128 })
	public host: string;

	/** 何が起きたか */
	@Column("varchar", { length: 64 })
	public event: InstanceHealthEvent;

	/** 長期の状態の変化前（変わらないできごとでは null） */
	@Column("varchar", { length: 64, nullable: true })
	public fromState: InstanceSuspensionState | null;

	/** 長期の状態の変化後（変わらないできごとでは null） */
	@Column("varchar", { length: 64, nullable: true })
	public toState: InstanceSuspensionState | null;

	/** きっかけ */
	@Column("varchar", { length: 32 })
	public source: InstanceHealthSource;

	/** 手動操作をした管理者。自動なら null */
	@Column({
		...id(),
		nullable: true,
	})
	public actorId: User["id"] | null;

	/** 人が読む説明。手動なら管理者のメモ */
	@Column("varchar", { length: 512, nullable: true })
	public reason: string | null;

	/** 判断の根拠（ステータス・エラーの分類・件数・日時など） */
	@Column("jsonb", { default: {} })
	public detail: Record<string, any>;
}
