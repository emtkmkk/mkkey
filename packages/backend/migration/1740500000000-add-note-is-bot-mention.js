/**
 * Note に isBotMention カラムを追加するマイグレーション。
 * 文頭でBot1件のみメンションしている投稿をTLフィルタで「Botが関わる返信」として扱うためのフラグ。
 */
export class AddNoteIsBotMention1740500000000 {
	name = "AddNoteIsBotMention1740500000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "isBotMention" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."isBotMention" IS '文頭でBot1件のみメンションしているか（TLフィルタ・API用）'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "note" DROP COLUMN IF EXISTS "isBotMention"`,
		);
	}
}
