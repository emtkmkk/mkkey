/**
 * @packageDocumentation
 *
 * 登録招待チケット（`registration_ticket`）のエンティティ定義。
 *
 * @remarks
 * - 通常招待: `allowedEmail` が null。24時間以内は複数回利用可（サインアップ成功時は削除しない）。
 * - メール指定招待: `allowedEmail` に正規化済みメールを保存。メール必須登録ON時のみ有効。有効期限なし・1回限り。
 *
 * @internal
 */
import { PrimaryColumn, Entity, Index, Column } from "typeorm";
import { id } from "../id.js";

@Entity()
export class RegistrationTicket {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Index({ unique: true })
	@Column('varchar', {
		length: 64,
	})
	public code: string;

	@Column('varchar', {
		length: 10,
		nullable: true
	})
	public inviteUserId: string;

	/** メール指定招待の場合のみ設定（小文字・trim 済み）。null のときは通常招待 */
	@Column('varchar', {
		length: 128,
		nullable: true,
	})
	public allowedEmail: string | null;
}
