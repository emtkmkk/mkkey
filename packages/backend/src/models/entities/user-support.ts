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

/**
 * 月ごとの支援実績。
 *
 * @remarks
 * - 「その月に支援を受けた」事実の記録であり、1ユーザー1月あたり1行（`userId` + `month` で一意）。
 * - 数ヶ月分をまとめて反映する場合も行は増えない。まとめた月数は `months` に持つ。
 * - この一意制約が二重適用の防止そのものなので、外すと同じ月に容量を二重加算できてしまう。
 * - ドライブ容量は毎月加算していく運用のため、退会・失効の概念は持たない。
 */
@Entity()
@Index(["userId", "month"], { unique: true })
export class UserSupport {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: "The ID of the supporting user.",
	})
	public userId: User["id"];

	@ManyToOne((type) => User, {
		onDelete: "CASCADE",
	})
	@JoinColumn()
	public user: User | null;

	/** 対象月。`YYYY-MM` 形式。 */
	@Index()
	@Column("varchar", {
		length: 7,
		comment: "Target month in YYYY-MM.",
	})
	public month: string;

	/** 支援元。現状は OFUSE のみだが、他が増えても区別できるようにしておく。 */
	@Column("varchar", {
		length: 32,
		default: "ofuse",
		comment: "Where the support came from (e.g. ofuse).",
	})
	public source: string;

	/** 支援元での識別子。OFUSE なら link_id。 */
	@Column("varchar", {
		length: 128,
		nullable: true,
		comment: "Identifier on the source service (e.g. OFUSE link_id).",
	})
	public externalId: string | null;

	/** 加入していたプラン名。複数同時加入がありうるので配列。 */
	@Column("jsonb", {
		default: [],
		comment: "Plan names on the source service.",
	})
	public plans: string[];

	/**
	 * この記録で加算したドライブ容量（MB）。上限クランプ後ではなく、加算しようとした値。
	 *
	 * @remarks
	 * `months` ヶ月分の合計。1ヶ月あたりの額は `grantMb / months`。
	 */
	@Column("integer", {
		default: 0,
		comment: "Drive capacity granted by this record, in MB (months worth in total).",
	})
	public grantMb: number;

	/**
	 * 何ヶ月分をまとめて加算したか。
	 *
	 * @remarks
	 * - 反映を忘れて数ヶ月分をまとめて処理するときに使う。通常は 1。
	 * - 全員に一律で掛かる。途中から加入した人の分は考慮しない。
	 * - 過去月の行は作らない。記録はあくまで `month` の1行だけで、
	 *   まとめた事実はこの列に残る。
	 */
	@Column("integer", {
		default: 1,
		comment: "How many months this single record covers.",
	})
	public months: number;

	/** 加算前のドライブ容量上限（MB）。null は未設定＝デフォルト値だったことを表す。 */
	@Column("integer", {
		nullable: true,
		comment: "driveCapacityOverrideMb before this grant.",
	})
	public beforeMb: number | null;

	/** 加算後のドライブ容量上限（MB）。 */
	@Column("integer", {
		comment: "driveCapacityOverrideMb after this grant.",
	})
	public afterMb: number;

	@Index()
	@Column("timestamp with time zone", {
		comment: "The applied date of the UserSupport.",
	})
	public appliedAt: Date;

	/** 適用したモデレーター。 */
	@Column({
		...id(),
		nullable: true,
		comment: "The ID of the moderator who applied this.",
	})
	public appliedById: User["id"] | null;
}
