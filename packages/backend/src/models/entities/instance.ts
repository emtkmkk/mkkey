/**
 * @packageDocumentation
 *
 * 連合先サーバ（インスタンス）1 件の情報と、配信の停止状態。
 *
 * @remarks
 * 停止状態の書き換えは `services/instance-health/state.ts` に集めている。直接 update しないこと。
 *
 * @internal
 */
import { Entity, PrimaryColumn, Index, Column } from "typeorm";
import { id } from "../id.js";
import type { User } from "./user.js";

/**
 * 配信の停止状態の値の一覧。
 *
 * @remarks
 * DB の enum（`instance_suspensionstate_enum`）と同じ。値を足すときはマイグレーションも要る。
 *
 * @public
 */
export const instanceSuspensionStates = [
	"none",
	"manuallySuspended",
	"goneSuspended",
	"autoSuspendedForNotResponding",
] as const;

/**
 * 配信の停止状態。
 *
 * @public
 */
export type InstanceSuspensionState = (typeof instanceSuspensionStates)[number];

@Entity()
export class Instance {
	@PrimaryColumn(id())
	public id: string;

	/**
	 * このインスタンスを捕捉した日時
	 */
	@Index()
	@Column('timestamp with time zone', {
		comment: 'The caught date of the Instance.',
	})
	public caughtAt: Date;

	/**
	 * ホスト
	 */
	@Index({ unique: true })
	@Column('varchar', {
		length: 128,
		comment: 'The host of the Instance.',
	})
	public host: string;

	/**
	 * インスタンスのユーザー数
	 */
	@Column('integer', {
		default: 0,
		comment: 'The count of the users of the Instance.',
	})
	public usersCount: number;

	/**
	 * インスタンスの投稿数
	 */
	@Column('integer', {
		default: 0,
		comment: 'The count of the notes of the Instance.',
	})
	public notesCount: number;

	/**
	 * このインスタンスのユーザーからフォローされている、自インスタンスのユーザーの数
	 */
	@Column('integer', {
		default: 0,
	})
	public followingCount: number;

	/**
	 * このインスタンスのユーザーをフォローしている、自インスタンスのユーザーの数
	 */
	@Column('integer', {
		default: 0,
	})
	public followersCount: number;

	/**
	 * 直近のリクエスト送信日時
	 */
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public latestRequestSentAt: Date | null;

	/**
	 * 直近のリクエスト送信時のHTTPステータスコード
	 */
	@Column('integer', {
		nullable: true,
	})
	public latestStatus: number | null;

	/**
	 * 直近のリクエスト受信日時
	 */
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public latestRequestReceivedAt: Date | null;

	/**
	 * このインスタンスと最後にやり取りした日時
	 */
	@Column('timestamp with time zone')
	public lastCommunicatedAt: Date;

	/**
	 * このインスタンスと不通かどうか
	 *
	 * @remarks
	 * {@link notRespondingSince} と同時に書き換える（`isNotResponding = notRespondingSince IS NOT NULL`）。
	 * 読む側が多いので残している。
	 */
	@Column('boolean', {
		default: false,
	})
	public isNotResponding: boolean;

	/**
	 * このインスタンスへの配信を停止するか
	 *
	 * @remarks
	 * {@link suspensionState} と同時に書き換える（`isSuspended = suspensionState <> 'none'`）。
	 * 書き換えは `services/instance-health/state.ts` だけで行う。
	 */
	@Index()
	@Column('boolean', {
		default: false,
	})
	public isSuspended: boolean;

	/**
	 * 配信の停止状態と、その理由の種類
	 *
	 * @remarks
	 * - `none`: 停止していない
	 * - `manuallySuspended`: 管理者が停止した。自動では解除しない
	 * - `goneSuspended`: サーバ自体が 410 を返した（閉鎖）。生存確認はしないが、相手から配送が届けば解除する
	 * - `autoSuspendedForNotResponding`: 不通が続いたので自動で停止した。生存確認と受信で解除する
	 *
	 * 値の名前は本家 Misskey に合わせている。
	 */
	@Index()
	@Column('enum', {
		enum: instanceSuspensionStates,
		default: 'none',
	})
	public suspensionState: InstanceSuspensionState;

	/**
	 * 停止した日時
	 */
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public suspendedAt: Date | null;

	/**
	 * 停止の理由（自動なら最後のエラー、手動なら管理者のメモ）
	 */
	@Column('varchar', {
		length: 512, nullable: true,
	})
	public suspendedReason: string | null;

	/**
	 * 手動で停止した管理者
	 */
	@Column({
		...id(),
		nullable: true,
	})
	public suspendedById: User['id'] | null;

	/**
	 * 不通になった時刻。通じていれば null
	 */
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public notRespondingSince: Date | null;

	/**
	 * 次に生存確認をする日時（自動停止中だけ使う）
	 */
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public nextProbeAt: Date | null;

	/**
	 * 生存確認の連続失敗回数（確認の間隔を延ばすのに使う）
	 */
	@Column('integer', {
		default: 0,
	})
	public probeFailures: number;

	@Column('varchar', {
		length: 64, nullable: true,
		comment: 'The software of the Instance.',
	})
	public softwareName: string | null;

	@Column('varchar', {
		length: 64, nullable: true,
	})
	public softwareVersion: string | null;

	@Column('boolean', {
		nullable: true,
	})
	public openRegistrations: boolean | null;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public name: string | null;

	@Column('varchar', {
		length: 4096, nullable: true,
	})
	public description: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public maintainerName: string | null;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public maintainerEmail: string | null;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public iconUrl: string | null;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public faviconUrl: string | null;

	@Column('varchar', {
		length: 64, nullable: true,
	})
	public themeColor: string | null;

	/**
	 * このインスタンスが１アカウントで行える最大リアクション数
	 */
	@Column('integer', {
		default: 1,
	})
	public maxReactionsPerAccount: number;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public infoUpdatedAt: Date | null;
}
