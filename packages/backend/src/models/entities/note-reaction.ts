/**
 * @packageDocumentation
 *
 * ノートへのリアクションエンティティ。ユーザー・ノート・リアクション文字列を保持する。
 *
 * @remarks
 * - **役割**: ノートへのリアクションを DB に保持し、API のリアクション一覧・配信で利用する。
 *
 * @see {@link models/repositories/note-reaction} ノートリアクションリポジトリ
 * @internal
 */
import {
	PrimaryColumn,
	Entity,
	Index,
	JoinColumn,
	Column,
	ManyToOne,
} from "typeorm";
import { User } from "./user.js";
import { Note } from "./note.js";
import { id } from "../id.js";

@Entity()
@Index(['userId', 'noteId', 'reaction'], { unique: true })
export class NoteReaction {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'リアクションの作成日時',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public userId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user?: User | null;

	@Index()
	@Column(id())
	public noteId: Note["id"];

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note?: Note | null;

	// TODO: 対象noteのuserIdを非正規化したい(「受け取ったリアクション一覧」のようなものを(JOIN無しで)実装したいため)

	@Index()
	@Column('varchar', {
		length: 260,
	})
	public reaction: string;
}
