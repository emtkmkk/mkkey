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
@Index(["blockerId", "blockeeId"], { unique: true })
export class FollowBlocking {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column("timestamp with time zone", {
		comment: "The created date of the Muting.",
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The blockee user ID.',
	})
	public blockeeId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public blockee: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The blocker user ID.',
	})
	public blockerId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public blocker: User | null;
}
