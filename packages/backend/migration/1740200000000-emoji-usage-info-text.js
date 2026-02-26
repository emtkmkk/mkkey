/**
 * 絵文字の usageInfo を varchar(512) から text に変更する。
 * ライセンス全文（Apache License 2.0 等）を格納できるようにする。
 */
export class EmojiUsageInfoText1740200000000 {
	name = "EmojiUsageInfoText1740200000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji" ALTER COLUMN "usageInfo" TYPE text USING "usageInfo"::text`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji" ALTER COLUMN "usageInfo" TYPE character varying(512) USING LEFT("usageInfo", 512)`,
		);
	}
}
