import {
	Entity,
	Column,
	Index,
	OneToOne,
	JoinColumn,
	PrimaryColumn,
} from "typeorm";
import { id } from "../id.js";
import { DriveFile } from "./drive-file.js";

@Entity()
@Index(['usernameLower', 'host'], { unique: true })
export class User {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the User.',
	})
	public createdAt: Date;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The updated date of the User.',
	})
	public updatedAt: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastFetchedAt: Date | null;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastActiveDate: Date | null;

	/**
	 * 休眠アカウント自動削除の予告メールを送った時刻。
	 *
	 * @remarks
	 * - 未活動が一定期間続いたローカルユーザーへ警告メールを送ったあとにセットする。
	 * - 再ログイン（`lastActiveDate` 更新）時に `null` へ戻し、再び休眠した場合は再送できる。
	 * - `null` は「この休眠サイクルでは未送信」を表す。
	 *
	 * @see {@link warnInactiveDeletion} 日次送信ジョブ
	 * @internal
	 */
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the inactive-deletion warning email was last sent (null = not yet in this dormant cycle).',
	})
	public inactiveDeletionWarnedAt: Date | null;

	/**
	 * 未読通知サマリーメールの前回集計基準時刻。
	 *
	 * @remarks
	 * - サマリーメール送信成功時に「集計を開始した時刻」をセットする。
	 * - この時刻以降に作成された未読通知が「新しい未読」として次回の集計対象になる。
	 * - `null` は「一度も送っていない」を表し、初回は未読全部が対象。
	 *
	 * @see {@link sendUnreadSummaryEmail} 日次送信ジョブ
	 * @internal
	 */
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the unread-notifications summary email was last sent (aggregation base time).',
	})
	public unreadSummaryEmailSentAt: Date | null;

	@Column('boolean', {
		default: false,
	})
	public hideOnlineStatus: boolean;

	@Column('varchar', {
		length: 128,
		comment: 'The username of the User.',
	})
	public username: string;

	@Index()
	@Column('varchar', {
		length: 128, select: false,
		comment: 'The username (lowercased) of the User.',
	})
	public usernameLower: string;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'The name of the User.',
	})
	public name: string | null;

	@Column('integer', {
		default: 0,
		comment: 'The count of followers.',
	})
	public followersCount: number;

	@Column('integer', {
		default: 0,
		comment: 'The count of following.',
	})
	public followingCount: number;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The URI of the new account of the User',
	})
	public movedToUri: string | null;

	@Column('simple-array', {
		nullable: true,
		comment: 'URIs the user is known as too',
	})
	public alsoKnownAs: string[] | null;

	@Column('integer', {
		default: 0,
		comment: 'The count of notes.',
	})
	public notesCount: number;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of avatar DriveFile.',
	})
	public avatarId: DriveFile["id"] | null;

	@OneToOne(type => DriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public avatar: DriveFile | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of banner DriveFile.',
	})
	public bannerId: DriveFile["id"] | null;

	@OneToOne(type => DriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public banner: DriveFile | null;

	@Index()
	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public tags: string[];

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is suspended.',
	})
	public isSuspended: boolean;

	/** モデレーション警告（ローカル・リモート行に付与可。表示・TL除外等に使用） */
	@Column('boolean', {
		default: false,
	})
	public isModerationWarning: boolean;

	/** 一時利用停止（凍結と別。サインイン・API利用ロックのみ、連合Deleteは出さない） */
	@Column('boolean', {
		default: false,
	})
	public isUsagePaused: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is silenced.',
	})
	public isSilenced: boolean;

	@Column('boolean', {
		default: false,
	})
	public isMiniSilenced: boolean;

	@Column('boolean', {
		default: false,
	})
	public canInvite: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is locked.',
	})
	public isLocked: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a bot.',
	})
	public isBot: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a cat.',
	})
	public isCat: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Whether to speak as a cat if isCat.',
	})
	public speakAsCat: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is the admin.',
	})
	public isAdmin: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the User is a moderator.',
	})
	public isModerator: boolean;

	@Index()
	@Column('boolean', {
		default: true,
		comment: 'Whether the User is explorable.',
	})
	public isExplorable: boolean;

	@Index()
	@Column('boolean', {
		default: true,
	})
	public isRemoteExplorable: boolean;

	// アカウントが削除されたかどうかのフラグだが、完全に削除される際は物理削除なので実質削除されるまでの「削除が進行しているかどうか」のフラグ
	@Column('boolean', {
		default: false,
		comment: 'Whether the User is deleted.',
	})
	public isDeleted: boolean;

	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public emojis: string[];

	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'The host of the User. It will be null if the origin of the user is local.',
	})
	public host: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The inbox URL of the User. It will be null if the origin of the user is local.',
	})
	public inbox: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The sharedInbox URL of the User. It will be null if the origin of the user is local.',
	})
	public sharedInbox: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The featured URL of the User. It will be null if the origin of the user is local.',
	})
	public featured: string | null;

	@Index()
	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The URI of the User. It will be null if the origin of the user is local.',
	})
	public uri: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'The URI of the user Follower Collection. It will be null if the origin of the user is local.',
	})
	public followersUri: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether to show users replying to other users in the timeline.',
	})
	public showTimelineReplies: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Show local Accounts renotes in the public timeline.',
	})
	public localShowRenote: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Show remote Accounts renotes in the public timeline.',
	})
	public remoteShowRenote: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Show remote Accounts renotes in the public timeline.',
	})
	public showSelfRenoteToHome: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Change public post to home post.',
	})
	public blockPostPublic: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Change home post to followers post.',
	})
	public blockPostHome: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Change not localonly post to localonly post.',
	})
	public blockPostNotLocal: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Change not localonly post to localonly post.',
	})
	public blockPostNotLocalPublic: boolean;

	@Column('boolean', {
		default: false,
		comment: 'The key will no longer be displayed.',
	})
	public isSilentLocked: boolean;

	@Column('boolean', {
		default: false,
		comment: 'The key will no longer be displayed.',
	})
	public isRemoteLocked: boolean;

	@Column('boolean', {
		default: true,
	})
	public isPublicLikeList: boolean;

	@Column('boolean', {
		default: true,
	})
	public disableNyaise: boolean;

	@Index({ unique: true })
	@Column('char', {
		length: 16, nullable: true, unique: true,
		comment: 'The native access token of the User. It will be null if the origin of the user is local.',
	})
	public token: string | null;

	@Column('integer', {
		nullable: true,
		comment: 'Overrides user drive capacity limit',
	})
	public driveCapacityOverrideMb: number | null;

	/**
	 * 最後に支援を受けた月（`YYYY-MM`）。
	 *
	 * @remarks
	 * - 「今月の支援者か」の判定に使う。`user_support` の最新行と同じ値を非正規化したもの。
	 * - user のパックは頻繁に走るため、履歴テーブルを引かずに済むようここに持たせている。
	 */
	@Index()
	@Column('varchar', {
		length: 7,
		nullable: true,
		comment: 'The last month (YYYY-MM) the user was a supporter.',
	})
	public lastSupportedMonth: string | null;

	/**
	 * 自作絵文字によるドライブ容量付与を適用した回数。
	 *
	 * @remarks
	 * - 1回あたり `EMOJI_DRIVE_GRANT_MB`、`MAX_EMOJI_DRIVE_GRANTS` 回まで。
	 * - 残り回数は本人向けのパック結果に載る。
	 */
	@Column('integer', {
		default: 0,
		comment: 'How many times the self-made-emoji drive bonus has been granted.',
	})
	public emojiDriveGrantCount: number;

	@Column('varchar', {
		length: 10,
		nullable: true
	})
	public inviteUserId: string;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'The name of the User.',
	})
	public fixedName: string | null;

	@Column('integer', {
		default: 0,
	})
	public maxPower: number;

	@Column('integer', {
		default: 0,
	})
	public maxRankPoint: number;

	/**
	 * 周年バッジ判定用の投稿日数（ログインして1投稿以上した日数）。
	 *
	 * @remarks
	 * `users/stats` の `notesPostDays`（現存ノートからの都度集計）とは独立。
	 * ノート作成時に新しい投稿日を検知するたび +1 する単調増加値で、投稿削除では減らない。
	 * マイグレーションで現存ノートの distinct 日数を初期バックフィルするのみ。
	 */
	@Column('integer', {
		default: 0,
		comment: '周年バッジ用の投稿日数（単調増加、削除では減らない）',
	})
	public notesPostDays: number;

	/** 直近でノートを作成した日時（`notesPostDays` の「新しい日」判定マーカー） */
	@Column('timestamp with time zone', {
		nullable: true,
		comment: '周年バッジ用の投稿日マーカー',
	})
	public lastNotePostedAt: Date | null;

	/** 周年バッジで最後に通知したレベル（年数）。次にこれを超えたら通知する */
	@Column('integer', {
		default: 0,
		comment: '周年バッジで最後に通知したレベル（年数）',
	})
	public notifiedAnniversaryLevel: number;

	constructor(data: Partial<User>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

export interface ILocalUser extends User {
	host: null;

	/**
	 * 認証キャッシュで `moderation_warning_popup_ack` から注入する最終ACK時刻。
	 * `user` テーブル列ではない。Redis 経由の JSON 復元では文字列になり得る。
	 */
	moderationWarningPopupAt?: Date | string | null;
}

export interface IRemoteUser extends User {
	host: string;
}

export type CacheableLocalUser = ILocalUser;

export type CacheableRemoteUser = IRemoteUser;

export type CacheableUser = CacheableLocalUser | CacheableRemoteUser;
