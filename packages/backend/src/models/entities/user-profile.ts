import {
	Entity,
	Column,
	Index,
	OneToOne,
	JoinColumn,
	PrimaryColumn,
} from "typeorm";
import { ffVisibility, notificationTypes } from "@/types.js";
import { id } from "../id.js";
import { User } from "./user.js";
import { Page } from "./page.js";

/**
 * @packageDocumentation
 *
 * ユーザープロフィールエンティティ。自己紹介・場所・誕生日・カスタムフィールド等を保持する。
 *
 * @remarks
 * TODO: このテーブルで管理している情報をすべてレジストリで管理する案もあるが、
 * 「emailVerified が true のユーザーを find する」ようなクエリが書けなくなる。
 *
 * @internal
 */
@Entity()
export class UserProfile {
	@PrimaryColumn(id())
	public userId: User["id"];

	@OneToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'ユーザーの場所',
	})
	public location: string | null;

	@Column('char', {
		length: 10, nullable: true,
		comment: 'ユーザーの誕生日 (YYYY-MM-DD)',
	})
	public birthday: string | null;

	@Column('smallint', {
		nullable: true,
		comment: 'ユーザーが固定した年齢（6-122の範囲外や未設定はnull）',
	})
	public pinnedAge: number | null;

	@Column('varchar', {
		length: 2048, nullable: true,
		comment: 'ユーザーの自己紹介（bio）',
	})
	public description: string | null;

        @Column('jsonb', {
                default: [],
        })
        public fields: {
                name: string;
                value: string;
        }[];

        @Column('varchar', {
                array: true,
                default: '{}',
        })
        public verifiedLinks: string[];

        @Column('varchar', {
                length: 32, nullable: true,
        })
        public lang: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'ユーザーのリモート URL',
	})
	public url: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'ユーザーのメールアドレス',
	})
	public email: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public emailVerifyCode: string | null;

	@Column('boolean', {
		default: false,
	})
	public emailVerified: boolean;

	@Column('jsonb', {
		default: ['follow', 'receiveFollowRequest', 'groupInvited'],
	})
	public emailNotificationTypes: string[];

	@Column('boolean', {
		default: false,
	})
	public publicReactions: boolean;

	@Column('enum', {
		enum: ffVisibility,
		default: 'public',
	})
	public ffVisibility: typeof ffVisibility[number];

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public twoFactorTempSecret: string | null;

	@Column('varchar', {
		length: 128, nullable: true,
	})
	public twoFactorSecret: string | null;

	@Column('boolean', {
		default: false,
	})
	public twoFactorEnabled: boolean;

	@Column('boolean', {
		default: false,
	})
	public securityKeysAvailable: boolean;

	@Column('boolean', {
		default: false,
	})
	public usePasswordLessLogin: boolean;

	@Column('boolean', {
		default: false,
	})
	public showDonateBadges: boolean;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: 'The password hash of the User. It will be null if the origin of the user is local.',
	})
	public password: string | null;

	@Column('varchar', {
		length: 8192, default: '',
	})
	public moderationNote: string | null;

	// TODO: そのうち消す
	@Column('jsonb', {
		default: {},
		comment: 'The client-specific data of the User.',
	})
	public clientData: Record<string, any>;

	// TODO: そのうち消す
	@Column('jsonb', {
		default: {},
		comment: 'The room data of the User.',
	})
	public room: Record<string, any>;

	@Column('boolean', {
		default: false,
	})
	public autoAcceptFollowed: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether reject index by crawler.',
	})
	public noCrawle: boolean;

	@Column('boolean', {
		default: true,
	})
	public preventAiLearning: boolean;

	@Column('boolean', {
		default: false,
	})
	public alwaysMarkNsfw: boolean;

	@Column('boolean', {
		default: false,
	})
	public autoSensitive: boolean;

	@Column('boolean', {
		default: false,
	})
	public carefulBot: boolean;

	@Column('boolean', {
		default: true,
	})
	public injectFeaturedNote: boolean;

	@Column('boolean', {
		default: true,
	})
	public receiveAnnouncementEmail: boolean;

	@Column({
		...id(),
		nullable: true,
	})
	public pinnedPageId: Page["id"] | null;

	@OneToOne(type => Page, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public pinnedPage: Page | null;

	@Column('jsonb', {
		default: {},
	})
	public integrations: Record<string, any>;

	@Index()
	@Column('boolean', {
		default: false, select: false,
	})
	public enableWordMute: boolean;

	@Column('jsonb', {
		default: [],
	})
	public mutedWords: string[][];

	@Index()
	@Column('boolean', {
		default: false, select: false,
	})
	public enableReactionMute: boolean;

	@Column('jsonb', {
		default: [],
	})
	public reactionMutedWords: string[][];

	@Index()
	@Column('boolean', {
		default: false,
	})
	public rejectMuteReaction: boolean;

	/**
	 * 閲覧者として、公開TL系で警告ユーザのノートを含めるか（既定 false）。
	 *
	 * @remarks
	 * 未ログインTLでは常に除外扱い。ソーシャルTLでは閲覧者が投稿者をフォロー済みなら除外しない。
	 */
	@Column('boolean', {
		default: false,
	})
	public showWarnedUsersInPublicTimeline: boolean;

	/**
	 * 投稿者として、フォローしていない警告ユーザからのリアクションを受け入れるか（既定 false）。
	 *
	 * @remarks
	 * ローカル投稿者のプロフィールのみ。リモート投稿者は常に OFF 相当。
	 */
	@Column('boolean', {
		default: false,
	})
	public receiveReactionsFromNonFollowedWarnedUsers: boolean;

	@Column('jsonb', {
		default: [],
		comment: 'List of instances muted by the user.',
	})
	public mutedInstances: string[];

	@Column('enum', {
		enum: notificationTypes,
		array: true,
		default: [],
	})
	public mutingNotificationTypes: typeof notificationTypes[number][];

	// フォローされた際のメッセージ
	@Column('varchar', {
		length: 256, nullable: true,
	})
	public followedMessage: string | null;

	//#region 非正規化フィールド
	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public userHost: string | null;
	//#endregion 非正規化フィールド

	constructor(data: Partial<UserProfile>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}
