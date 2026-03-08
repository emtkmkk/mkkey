/**
 * 絵文字インポート申請機能用テーブルを追加する。
 * emoji_import_request: 申請一覧
 * emoji_import_denied: 否認済み絵文字名（emojiName のみで判定）
 */
export class EmojiImportRequest1741000000000 {
	name = "EmojiImportRequest1741000000000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "emoji_import_request" (
				"id" character varying(32) NOT NULL,
				"emojiName" character varying(128) NOT NULL,
				"emojiHost" character varying(128) NOT NULL,
				"requesterId" character varying(32) NOT NULL,
				"status" character varying(16) NOT NULL,
				"reason" text,
				"processedById" character varying(32),
				"importedEmojiId" character varying(32),
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"processedAt" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_emoji_import_request_id" PRIMARY KEY ("id")
			)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_import_request_requesterId" ON "emoji_import_request" ("requesterId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_import_request_emojiName" ON "emoji_import_request" ("emojiName")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_import_request_status" ON "emoji_import_request" ("status")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_import_request_createdAt" ON "emoji_import_request" ("createdAt")`,
		);

		await queryRunner.query(
			`CREATE TABLE "emoji_import_denied" (
				"name" character varying(128) NOT NULL,
				CONSTRAINT "PK_emoji_import_denied_name" PRIMARY KEY ("name")
			)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE "emoji_import_request"`);
		await queryRunner.query(`DROP TABLE "emoji_import_denied"`);
	}
}
