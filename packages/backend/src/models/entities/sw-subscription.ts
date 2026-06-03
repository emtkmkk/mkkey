/**
 * @packageDocumentation
 *
 * Web Push 購読（Service Worker）エンティティ。
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
import { User } from "./user.js";
import { id } from "../id.js";

@Entity()
export class SwSubscription {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Index()
	@Column(id())
	public userId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('varchar', {
		length: 512,
	})
	public endpoint: string;

	@Column('varchar', {
		length: 256,
	})
	public auth: string;

	@Column('varchar', {
		length: 128,
	})
	public publickey: string;

	/**
	 * @remarks
	 * TEMP: 互換のため残存。push 既読同期は廃止済み。列削除は docs/TODO-push-sendreadmessage-column.md 参照。
	 */
	@Column("boolean", {
		default: false,
	})
	public sendReadMessage: boolean;
}
