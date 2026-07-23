/**
 * @packageDocumentation
 *
 * ユーザー間の範囲付きミュートを保持するエンティティ。
 *
 * @remarks
 * 利用者ペアごとに1行だけ保持し、対象範囲は `scope` ビットマスクで表す。
 * 有効期限は選択された全範囲で共有する。
 *
 * @see {@link ../../misc/mute-scope}
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
@Index(['muterId', 'muteeId'], { unique: true })
export class Muting {
	/** ミュート関係の識別子。 */
	@PrimaryColumn(id())
	public id: string;

	/** ミュート関係を作成した日時。 */
	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the Muting.',
	})
	public createdAt: Date;

	/** 全範囲で共有する解除日時。nullは無期限。 */
	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public expiresAt: Date | null;

	/**
	 * ミュート対象範囲のビットマスク。
	 *
	 * @remarks
	 * 値の解釈は `misc/mute-scope.ts` に集約する。
	 */
	@Column('integer', {
		default: 1,
		comment: 'ユーザー単位ミュートの対象範囲ビットマスク',
	})
	public scope: number;

	/** ミュートされるユーザーID。 */
	@Index()
	@Column({
		...id(),
		comment: 'The mutee user ID.',
	})
	public muteeId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public mutee: User | null;

	/** ミュートするユーザーID。 */
	@Index()
	@Column({
		...id(),
		comment: 'The muter user ID.',
	})
	public muterId: User["id"];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public muter: User | null;
}
