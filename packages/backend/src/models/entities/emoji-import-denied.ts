/**
 * @packageDocumentation
 *
 * 否認済み絵文字名エンティティ。
 * インポート申請を否認した絵文字名を保持し、同一名での再申請を防ぐ。
 * 判定キーは emojiName のみ。
 *
 * @public
 */
import { Entity, PrimaryColumn } from "typeorm";

@Entity()
export class EmojiImportDenied {
	@PrimaryColumn("varchar", { length: 128 })
	public name: string;
}
