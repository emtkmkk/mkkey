/**
 * @packageDocumentation
 *
 * リモート親投稿の参照一覧を閲覧者別にキャッシュするエンティティ。
 *
 * @remarks
 * - lazy API（`GET /api/notes/references`）専用。ローカル投稿では使わない。
 * - `(noteId, userId)` でユニーク。origin 署名付き再取得の結果を保持する。
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
import type { Note } from "./note.js";
import type { User } from "./user.js";

@Entity()
@Index(["noteId", "userId"], { unique: true })
export class NoteReferenceCache {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: "親投稿（リモート）の ID",
	})
	public noteId: Note["id"];

	@ManyToOne("Note", { onDelete: "CASCADE" })
	@JoinColumn()
	public note: Note | null;

	@Index()
	@Column({
		...id(),
		comment: "閲覧者（ローカルユーザー）の ID",
	})
	public userId: User["id"];

	@ManyToOne("User", { onDelete: "CASCADE" })
	@JoinColumn()
	public user: User | null;

	@Column({
		...id(),
		array: true,
		default: "{}",
		comment: "閲覧者から見えている参照先ノート ID",
	})
	public referenceIds: Note["id"][];

	@Column("timestamp with time zone", {
		comment: "origin から取得した日時",
	})
	public fetchedAt: Date;
}
