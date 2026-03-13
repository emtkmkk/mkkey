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

/**
 * @packageDocumentation
 *
 * レジストリ項目エンティティ。ユーザーごとの key/value をスコープ・ドメインで保持する。
 *
 * @remarks
 * TODO: 同じ domain・同じ scope・同じ key のレコードが複数存在しないよう制約を付けたい
 *
 * @internal
 */
@Entity()
export class RegistryItem {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'レジストリ項目の作成日時',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'レジストリ項目の更新日時',
	})
	public updatedAt: Date;

	@Index()
	@Column({
		...id(),
		comment: '所有者ユーザー ID',
	})
	public userId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('varchar', {
		length: 1024,
		comment: 'レジストリのキー',
	})
	public key: string;

	@Column('jsonb', {
		default: {}, nullable: true,
		comment: 'レジストリの値',
	})
	public value: any | null;

	@Index()
	@Column('varchar', {
		length: 1024, array: true, default: '{}',
	})
	public scope: string[];

	// サードパーティアプリに開放するときのためのカラム
	@Index()
	@Column('varchar', {
		length: 512, nullable: true,
	})
	public domain: string | null;
}
