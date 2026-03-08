/**
 * @packageDocumentation
 *
 * 絵文字インポート申請エンティティ。
 * ユーザーがリモート絵文字のインポートを申請し、管理者が承認/否認するためのレコード。
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

@Entity()
export class EmojiImportRequest {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column("timestamp with time zone", {
		nullable: false,
	})
	public createdAt: Date;

	@Index()
	@Column("varchar", { length: 128 })
	public emojiName: string;

	@Column("varchar", { length: 128 })
	public emojiHost: string;

	@Index()
	@Column(id())
	public requesterId: User["id"];

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn()
	public requester: User | null;

	@Index()
	@Column("varchar", { length: 16 })
	public status: "pending" | "approved" | "rejected";

	@Column("text", { nullable: true })
	public reason: string | null;

	@Column(id(), { nullable: true })
	public processedById: User["id"] | null;

	@ManyToOne(() => User, { onDelete: "SET NULL" })
	@JoinColumn()
	public processedBy: User | null;

	@Column(id(), { nullable: true })
	public importedEmojiId: string | null;

	@Column("timestamp with time zone", { nullable: true })
	public processedAt: Date | null;
}
