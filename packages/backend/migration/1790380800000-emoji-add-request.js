/**
 * 絵文字の追加申請テーブル emoji_add_request を追加する。
 *
 * @remarks
 * - 既存のリモート絵文字インポート申請（emoji_import_request）とは別のテーブル。
 * - 申請者・画像・審査者は、ユーザーやファイルが消えても申請の記録を残すため ON DELETE SET NULL。
 * - 複数申請（まとめ申請）用の groupId は、第 2 段階で別のマイグレーションとして足す。
 * - down はテーブルを消すだけ。入っていた申請はすべて失われる。
 *
 * @internal
 */
export class EmojiAddRequest1790380800000 {
	name = "EmojiAddRequest1790380800000";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "emoji_add_request" (
				"id" character varying(32) NOT NULL,
				"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
				"status" character varying(24) NOT NULL,
				"source" character varying(16) NOT NULL DEFAULT 'form',
				"requesterId" character varying(32),
				"fileId" character varying(32),
				"imageProcessed" boolean NOT NULL DEFAULT false,
				"originalWidth" integer,
				"originalHeight" integer,
				"name" character varying(128) NOT NULL,
				"alternateName" character varying(512),
				"ruby" character varying(512),
				"description" text,
				"category" character varying(128),
				"aliases" character varying(128) array NOT NULL DEFAULT '{}',
				"sensitive" boolean NOT NULL DEFAULT false,
				"isTextOnly" boolean NOT NULL DEFAULT false,
				"motifSelf" boolean,
				"motifUserMode" character varying(16),
				"copyPermission" character varying(16) NOT NULL DEFAULT 'none',
				"askContact" character varying(256),
				"licenseName" text,
				"creator" character varying(256),
				"usageInfo" text,
				"copyrightNotice" text,
				"creditText" text,
				"relatedLinks" character varying(512) array NOT NULL DEFAULT '{}',
				"message" text,
				"proposal" jsonb,
				"reviewComment" text,
				"reviewerId" character varying(32),
				"processedAt" TIMESTAMP WITH TIME ZONE,
				"approvedEmojiId" character varying(32),
				"history" jsonb NOT NULL DEFAULT '[]',
				CONSTRAINT "PK_emoji_add_request_id" PRIMARY KEY ("id")
			)`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_add_request_createdAt" ON "emoji_add_request" ("createdAt")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_add_request_status" ON "emoji_add_request" ("status")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_add_request_requesterId" ON "emoji_add_request" ("requesterId")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_emoji_add_request_name" ON "emoji_add_request" ("name")`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji_add_request" ADD CONSTRAINT "FK_emoji_add_request_requesterId" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji_add_request" ADD CONSTRAINT "FK_emoji_add_request_fileId" FOREIGN KEY ("fileId") REFERENCES "drive_file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji_add_request" ADD CONSTRAINT "FK_emoji_add_request_reviewerId" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP TABLE IF EXISTS "emoji_add_request"`);
	}
}
