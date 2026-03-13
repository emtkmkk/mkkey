/**
 * @packageDocumentation
 *
 * 通知エンティティ。受信者・送信者・種別・関連 ID を保持する。
 *
 * @remarks
 * - **役割**: リアクション・フォロー・メンション等の通知を DB に保持し、API で一覧・既読管理に利用する。
 *
 * @see {@link models/repositories/notification} 通知リポジトリ
 * @internal
 */
import {
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	Column,
	PrimaryColumn,
} from "typeorm";
import { User } from "./user.js";
import { id } from "../id.js";
import { Note } from "./note.js";
import { FollowRequest } from "./follow-request.js";
import { UserGroupInvitation } from "./user-group-invitation.js";
import { AccessToken } from "./access-token.js";
import { notificationTypes } from "@/types.js";

@Entity()
@Index(["notifieeId", "isRead"])
export class Notification {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: '通知の作成日時',
	})
	public createdAt: Date;

	/** 通知の受信者ユーザー ID */
	@Index()
	@Column({
		...id(),
		comment: '通知の受信者ユーザー ID',
	})
	public notifieeId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public notifiee: User | null;

	/** 通知の送信者（発端者）ユーザー ID */
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: '通知の送信者ユーザー ID',
	})
	public notifierId: User["id"] | null;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public notifier: User | null;

	/**
	 * 通知種別:
	 * follow - フォロー
	 * mention - 投稿でメンションされた
	 * reply - 自分（または Watch 中）の投稿にリプライされた
	 * renote - 自分（または Watch 中）の投稿がリノートされた
	 * quote - 自分（または Watch 中）の投稿が引用リノートされた
	 * reaction - 自分または Watch 中の投稿にリアクションされた
	 * pollVote - 自分が投票したアンケート、または自分/Watch 中の投稿のアンケートに投票された（Watch は投票者を通知しない）
	 * pollEnded - 自分のアンケートまたは自分が投票したアンケートが終了した
	 * receiveFollowRequest - フォローリクエストされた
	 * followRequestAccepted - フォローリクエストが承認された
	 * groupInvited - グループに招待された
	 * app - アプリ通知
	 */
	@Index()
	@Column('enum', {
		enum: notificationTypes,
		comment: '通知の種別',
	})
	public type: typeof notificationTypes[number];

	/** 通知を既読にしたか */
	@Index()
	@Column('boolean', {
		default: false,
		comment: '通知を既読にしたか',
	})
	public isRead: boolean;

	@Column({
		...id(),
		nullable: true,
	})
	public noteId: Note["id"] | null;

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: Note | null;

	@Column({
		...id(),
		nullable: true,
	})
	public followRequestId: FollowRequest["id"] | null;

	@ManyToOne(type => FollowRequest, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public followRequest: FollowRequest | null;

	@Column({
		...id(),
		nullable: true,
	})
	public userGroupInvitationId: UserGroupInvitation["id"] | null;

	@ManyToOne(type => UserGroupInvitation, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public userGroupInvitation: UserGroupInvitation | null;

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public reaction: string | null;

	@Column('integer', {
		nullable: true,
	})
	public choice: number | null;

	/** アプリ通知の本文 */
	@Column('varchar', {
		length: 2048, nullable: true,
	})
	public customBody: string | null;

	/** アプリ通知のヘッダー（省略時はアプリ名で表示される想定） */
	@Column('varchar', {
		length: 256, nullable: true,
	})
	public customHeader: string | null;

	/** アプリ通知のアイコン URL（省略時はアプリアイコンで表示される想定） */
	@Column('varchar', {
		length: 1024, nullable: true,
	})
	public customIcon: string | null;

	/** アプリ通知の対象アプリ（トークン） */
	@Index()
	@Column({
		...id(),
		nullable: true,
	})
	public appAccessTokenId: AccessToken["id"] | null;

	@ManyToOne(type => AccessToken, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public appAccessToken: AccessToken | null;
}
