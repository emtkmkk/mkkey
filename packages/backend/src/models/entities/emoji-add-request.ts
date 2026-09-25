/**
 * @packageDocumentation
 *
 * 絵文字の追加申請エンティティ。
 * ユーザーが新しい絵文字の画像と情報を申請し、管理者が審査するためのレコード。
 *
 * @remarks
 * - 1 行 = 絵文字 1 個。複数申請（まとめ申請）のための groupId は第 2 段階で足す。
 * - 申請者の入力は個別の列に持つ。承認するまで emoji テーブルには触れない。
 * - 画像は申請時にサーバー側（userId が null のドライブ）へ複製した fileId を持つ。申請者が自分のドライブから消しても承認できるようにするため。
 * - コピー可否は DB の 4 値（allow / deny / conditional / none）で持つ。申請画面の「許可の後、コピー可」は
 *   copyPermission = conditional ＋ askContact（許可を取る連絡先）で表し、承認時に使用情報の先頭へ前置きを付ける。
 * - 管理者の「修正のお願い」は proposal（修正案。変えた項目だけ）と reviewComment に入れ、status を changesRequested にする。
 * - やりとりの経緯は history に追記していく（誰が・いつ・何をしたか）。
 * - 過去の Google フォームの回答を取り込んだ行は source = legacy。申請者が分からなければ requesterId は null。
 *
 * @public
 */
import {
	Entity,
	Index,
	Column,
	PrimaryColumn,
	ManyToOne,
	JoinColumn,
} from "typeorm";
import { id } from "../id.js";
import { User } from "./user.js";
import { DriveFile } from "./drive-file.js";

// #region 型

/**
 * 申請の状態。
 *
 * @remarks
 * - pending: 審査待ち
 * - changesRequested: 管理者が修正をお願いしていて、申請者の対応待ち（自動では取り下げない）
 * - approved: 承認済み（approvedEmojiId に登録した絵文字）
 * - rejected: 却下
 * - withdrawn: 申請者が取り下げた
 */
export type EmojiAddRequestStatus =
	| "pending"
	| "changesRequested"
	| "approved"
	| "rejected"
	| "withdrawn";

/** 申請がどこから来たか */
export type EmojiAddRequestSource = "form" | "megamoji" | "legacy";

/**
 * 管理者の修正案で直せる項目。
 *
 * @remarks
 * 申請の列と同じ名前。修正案には変えた項目だけを入れる。
 */
export type EmojiAddRequestEditableFields = {
	name: string;
	alternateName: string | null;
	ruby: string | null;
	description: string | null;
	category: string | null;
	aliases: string[];
	sensitive: boolean;
	isTextOnly: boolean;
	motifSelf: boolean | null;
	motifUserMode: "any" | "follow" | "owner" | null;
	copyPermission: "allow" | "deny" | "conditional" | "none";
	askContact: string | null;
	licenseName: string | null;
	creator: string | null;
	usageInfo: string | null;
	copyrightNotice: string | null;
	creditText: string | null;
	relatedLinks: string[];
	fileId: string;
};

/** 修正案（変えた項目だけ） */
export type EmojiAddRequestProposal = Partial<EmojiAddRequestEditableFields>;

/** 経緯の 1 件 */
export type EmojiAddRequestHistoryEntry = {
	/** ISO 8601 の日時 */
	at: string;
	/** 操作した人のユーザー ID（過去の取り込みなどで分からなければ null） */
	by: string | null;
	action:
		| "created"
		| "changesRequested"
		| "resubmitted"
		| "approved"
		| "approvedWithChanges"
		| "rejected"
		| "withdrawn";
	/** 管理者のコメントや却下理由 */
	comment?: string | null;
	/** その操作で変わった項目（修正案・直して承認のとき） */
	changes?: EmojiAddRequestProposal;
};

// #endregion

@Entity()
export class EmojiAddRequest {
	// #region 基本情報

	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column("timestamp with time zone")
	public createdAt: Date;

	@Column("timestamp with time zone")
	public updatedAt: Date;

	@Index()
	@Column("varchar", { length: 24 })
	public status: EmojiAddRequestStatus;

	@Column("varchar", { length: 16, default: "form" })
	public source: EmojiAddRequestSource;

	/** 申請者。過去の取り込みで分からなければ null。ユーザーが消えても申請の記録は残す */
	@Index()
	@Column({ ...id(), nullable: true })
	public requesterId: User["id"] | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn()
	public requester: User | null;

	// #endregion

	// #region 画像

	/** 申請時にサーバー側へ複製した画像。消されたら null（承認できなくなる） */
	@Column({ ...id(), nullable: true })
	public fileId: DriveFile["id"] | null;

	@ManyToOne(() => DriveFile, { onDelete: "SET NULL" })
	@JoinColumn()
	public file: DriveFile | null;

	/** 申請画面で余白カット・縮小をしたか */
	@Column("boolean", { default: false })
	public imageProcessed: boolean;

	/** 加工する前の幅・高さ（加工していなければ null） */
	@Column("integer", { nullable: true })
	public originalWidth: number | null;

	@Column("integer", { nullable: true })
	public originalHeight: number | null;

	// #endregion

	// #region 名前とタグ

	@Index()
	@Column("varchar", { length: 128 })
	public name: string;

	@Column("varchar", { length: 512, nullable: true })
	public alternateName: string | null;

	@Column("varchar", { length: 512, nullable: true })
	public ruby: string | null;

	@Column("text", { nullable: true })
	public description: string | null;

	@Column("varchar", { length: 128, nullable: true })
	public category: string | null;

	@Column("varchar", { array: true, length: 128, default: "{}" })
	public aliases: string[];

	@Column("boolean", { default: false })
	public sensitive: boolean;

	// #endregion

	// #region モチーフ・ライセンス

	/** 文字だけの絵文字か。true のときライセンス関係は承認時に固定値になる */
	@Column("boolean", { default: false })
	public isTextOnly: boolean;

	/** 申請者自身がモチーフか（文字だけの絵文字では null） */
	@Column("boolean", { nullable: true })
	public motifSelf: boolean | null;

	/** motifSelf が true のときの利用範囲 */
	@Column("varchar", { length: 16, nullable: true })
	public motifUserMode: "any" | "follow" | "owner" | null;

	@Column("varchar", { length: 16, default: "none" })
	public copyPermission: "allow" | "deny" | "conditional" | "none";

	/** 「許可の後、コピー可」のときの連絡先。承認時に使用情報の先頭へ「コピー前に次のユーザの許可を得る事 : 」と一緒に付ける */
	@Column("varchar", { length: 256, nullable: true })
	public askContact: string | null;

	@Column("text", { nullable: true })
	public licenseName: string | null;

	@Column("varchar", { length: 256, nullable: true })
	public creator: string | null;

	@Column("text", { nullable: true })
	public usageInfo: string | null;

	@Column("text", { nullable: true })
	public copyrightNotice: string | null;

	@Column("text", { nullable: true })
	public creditText: string | null;

	@Column("varchar", { array: true, length: 512, default: "{}" })
	public relatedLinks: string[];

	// #endregion

	// #region やりとり

	/** 申請者から承認者へのメッセージ */
	@Column("text", { nullable: true })
	public message: string | null;

	/** 管理者の修正案（変えた項目だけ）。status が changesRequested のときに使う */
	@Column("jsonb", { nullable: true })
	public proposal: EmojiAddRequestProposal | null;

	/** 管理者のコメント（修正のお願い・直して承認・却下の理由） */
	@Column("text", { nullable: true })
	public reviewComment: string | null;

	@Column({ ...id(), nullable: true })
	public reviewerId: User["id"] | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn()
	public reviewer: User | null;

	/** 承認・却下・取り下げの日時 */
	@Column("timestamp with time zone", { nullable: true })
	public processedAt: Date | null;

	/** 承認して登録した絵文字 */
	@Column({ ...id(), nullable: true })
	public approvedEmojiId: string | null;

	/** 経緯（古い順）。追記だけする */
	@Column("jsonb", { default: [] })
	public history: EmojiAddRequestHistoryEntry[];

	// #endregion
}
