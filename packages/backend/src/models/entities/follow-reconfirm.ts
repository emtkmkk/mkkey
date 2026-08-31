/**
 * @packageDocumentation
 *
 * フォロー申請拒否・フォロー強制解除後の再フォロー確認用レコード。
 *
 * @remarks
 * - 申請した側（userId）が、相手（targetUserId）から拒否または強制解除されたときに作成する。
 * - Web UI のフォローボタンで再フォローする前に確認ダイアログを出す判定に使う。
 * - ユーザーがダイアログを承認して再フォローしたら削除する。
 *
 * @internal
 */
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
} from "typeorm";
import { id } from "../id.js";
import { User } from "./user.js";

/** 再フォロー確認が必要になった理由 */
export const followReconfirmReasons = [
	"followRequestRejected",
	"wasForciblyUnfollowed",
] as const;

export type FollowReconfirmReason = (typeof followReconfirmReasons)[number];

@Entity()
@Index(["userId", "targetUserId"], { unique: true })
export class FollowReconfirm {
	@PrimaryColumn(id())
	public id: string;

	/** レコード作成日時 */
	@Column("timestamp with time zone", {
		comment: "再フォロー確認レコードの作成日時",
	})
	public createdAt: Date;

	/** 最終更新日時（拒否・強制解除の再発時に更新） */
	@Column("timestamp with time zone", {
		comment: "再フォロー確認レコードの最終更新日時",
	})
	public updatedAt: Date;

	/** 申請した側 / フォローを外された側（ローカルユーザー） */
	@Index()
	@Column({
		...id(),
		comment: "再フォロー確認が必要なユーザー ID",
	})
	public userId: User["id"];

	@ManyToOne(() => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	/** 拒否した側 / 強制解除した側 */
	@Index()
	@Column({
		...id(),
		comment: "再フォロー確認の対象ユーザー ID",
	})
	public targetUserId: User["id"];

	@ManyToOne(() => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public targetUser: User | null;

	/** 確認ダイアログの文面分岐に使う理由 */
	@Column("enum", {
		enum: followReconfirmReasons,
		comment: "再フォロー確認が必要になった理由",
	})
	public reason: FollowReconfirmReason;
}
