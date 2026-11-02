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

@Entity()
@Index(["userId", "targetUserId"], { unique: true })
export class UserMemo {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: "The ID of author.",
	})
	public userId: User["id"];

	@ManyToOne(type => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(),
		comment: "The ID of target user.",
	})
	public targetUserId: User["id"];

	@ManyToOne(type => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public targetUser: User | null;

	// NOTE: DB 上は NULL 可（マイグレーション 1683682889963 参照）。memo だけ・customName だけの保存があるため null を許す
	@Column("varchar", {
		length: 256,
		nullable: true,
		comment: "CustomName.",
	})
	public customName: string | null;

	// NOTE: DB 上は NULL 可（マイグレーション 1683682889963 参照）
	@Column("varchar", {
		length: 2048,
		nullable: true,
		comment: "Memo.",
	})
	public memo: string | null;
}
