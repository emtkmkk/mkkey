/**
 * @packageDocumentation
 *
 * プッシュ通知ミュートエンティティ。
 *
 * @remarks
 * 対象ユーザからの Web Push のみを抑止する（アプリ内通知・タイムラインはそのまま）。
 *
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
import { id } from "../id.js";
import { User } from "./user.js";

@Entity()
@Index(["muterId", "muteeId"], { unique: true })
export class PushMuting {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column("timestamp with time zone", {
		comment: "The created date of the PushMuting.",
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: "The mutee user ID.",
	})
	public muteeId: User["id"];

	@ManyToOne(() => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public mutee: User | null;

	@Index()
	@Column({
		...id(),
		comment: "The muter user ID.",
	})
	public muterId: User["id"];

	@ManyToOne(() => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public muter: User | null;
}
