/**
 * @packageDocumentation
 *
 * ノート（投稿）エンティティ。リプライ・リノート・公開範囲・ファイル・リアクション等を保持する。
 *
 * @remarks
 * - **役割**: 投稿データを DB に保持し、API・TL・AP 配信で参照される中核エンティティ。
 *
 * @see {@link models/repositories/note} ノートリポジトリ
 * @internal
 */
import {
	Entity,
	Index,
	JoinColumn,
	Column,
	PrimaryColumn,
	ManyToOne,
} from "typeorm";
import { User } from "./user.js";
import type { DriveFile } from "./drive-file.js";
import { id } from "../id.js";
import { noteVisibilities } from "../../types.js";
import { Channel } from "./channel.js";

@Entity()
@Index('IDX_NOTE_FILE_IDS', { synchronize: false })
@Index('IDX_NOTE_TAGS', { synchronize: false })
@Index('IDX_NOTE_MENTIONS', { synchronize: false })
@Index('IDX_NOTE_VISIBLE_USER_IDS', { synchronize: false })
export class Note {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'ノートの作成日時',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'リプライ先ノートの ID',
	})
	public replyId: Note["id"] | null;

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public reply: Note | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'リノート元ノートの ID',
	})
	public renoteId: Note["id"] | null;

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public renote: Note | null;

	@Index()
	@Column('varchar', {
		length: 256, nullable: true,
	})
	public threadId: string | null;

	@Column('text', {
		nullable: true,
	})
	public text: string | null;

	@Column('varchar', {
		length: 256, nullable: true,
	})
	public name: string | null;

	@Column('text', {
		nullable: true,
	})
	public cw: string | null;

	@Index()
	@Column({
		...id(),
		comment: '投稿者ユーザー ID',
	})
	public userId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('boolean', {
		default: false,
	})
	public localOnly: boolean;

	@Column('smallint', {
		default: 0,
	})
	public renoteCount: number;

	@Column('smallint', {
		default: 0,
	})
	public repliesCount: number;

	@Column('jsonb', {
		default: {},
	})
	public reactions: Record<string, number>;

	/**
	 * public ... 公開
	 * home ... ホームタイムライン（ユーザーページのタイムライン含む）のみに流す
	 * hidden ... プロフィール上のみ表示（配信しない。ローカルのみに近いが AP では home と同様取得可）。現状は投稿インポート用
	 * followers ... フォロワーのみ
	 * specified ... visibleUserIds で指定したユーザーのみ
	 */
	@Column('enum', { enum: noteVisibilities })
	public visibility: typeof noteVisibilities[number];

	@Index({ unique: true })
	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'ノートの URI。ローカルノートの場合は null',
	})
	public uri: string | null;

	@Column('varchar', {
		length: 512, nullable: true,
		comment: 'ノートの人間可読な URL。ローカルノートの場合は null',
	})
	public url: string | null;

	@Column('integer', {
		default: 0,
	})
	public score: number;

        /**
         * ファイル添付の有無を判定するクエリでは、必ず CARDINALITY(note."fileIds") を使用すること。
         * 文字列リテラルの '{}' との比較は禁止（部分インデックスと同条件に揃えるため）。
         */
        @Index()
        @Column({
                ...id(),
                array: true, default: '{}',
        })
        public fileIds: DriveFile["id"][];

	@Index()
	@Column('varchar', {
		length: 256, array: true, default: '{}',
	})
	public attachedFileTypes: string[];

	@Index()
	@Column({
		...id(),
		array: true, default: '{}',
	})
	public visibleUserIds: User["id"][];

	@Index()
	@Column({
		...id(),
		array: true, default: '{}',
	})
	public ccUserIds: User["id"][];

	@Index()
	@Column({
		...id(),
		array: true, default: '{}',
	})
	public mentions: User["id"][];

	@Column('text', {
		default: '[]',
	})
	public mentionedRemoteUsers: string;

	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public emojis: string[];

	@Index()
	@Column('varchar', {
		length: 128, array: true, default: '{}',
	})
	public tags: string[];

	@Column('boolean', {
		default: false,
	})
	public hasPoll: boolean;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: '投稿元チャンネル ID',
	})
	public channelId: Channel["id"] | null;

	@ManyToOne(type => Channel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public channel: Channel | null;

	//#region 非正規化フィールド
	@Index()
	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public userHost: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: '[Denormalized]',
	})
	public replyUserId: User["id"] | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public replyUserHost: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: '[Denormalized]',
	})
	public renoteUserId: User["id"] | null;

	@Column('varchar', {
		length: 128, nullable: true,
		comment: '[Denormalized]',
	})
	public renoteUserHost: string | null;

	@Index()
	@Column({
		...id(),
		array: true, default: '{}',
	})
	public referenceIds: Note["id"][];

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The updated date of the Note.',
	})
	public updatedAt: Date;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The deleted date of the Note.',
	})
	public deletedAt: Date;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public lastSendActivityAt: Date;

	@Column('boolean', {
		default: true,
	})
	public isPublicLikeList: boolean;

	@Column('boolean', {
		default: false,
	})
	public isFirstNote: boolean;
	//#endregion 非正規化フィールド

	constructor(data: Partial<Note>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}

export type IMentionedRemoteUsers = {
	uri: string;
	url?: string;
	username: string;
	host: string;
}[];
