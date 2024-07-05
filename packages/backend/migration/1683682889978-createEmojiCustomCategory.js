export class createEmojiCustomCategory1683682889978 {
	name = "createEmojiCustomCategory1683682889978";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "emoji_custom_category" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" character varying(32) NOT NULL, "title" character varying(256) NOT NULL, "name" character varying(256) NOT NULL, "summary" character varying(256),"eyeCatchingImageId" character varying(32), "content" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_ddc924606e033c31ac670b4ca2a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3f053796a31419e41a0129a5e9" ON "emoji_custom_category" ("createdAt") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_20b94b139fa1a34f01acc932ca" ON "emoji_custom_category" ("updatedAt") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_db9ded34dbab4cd5facb23ef1c" ON "emoji_custom_category" ("name") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6ac03498d37309660e4e18395d" ON "emoji_custom_category" ("userId") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_c3ffc5e8e6f8c65a3314b38a41" ON "emoji_custom_category" ("userId", "name") `,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji_custom_category" ADD CONSTRAINT "FK_746d8668a5fdba9ed33f361fa3f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji_custom_category" ADD CONSTRAINT "FK_be677030aec760263e56bf02538" FOREIGN KEY ("eyeCatchingImageId") REFERENCES "drive_file"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "page" DROP CONSTRAINT "FK_be677030aec760263e56bf02538"`,
		);
		await queryRunner.query(
			`ALTER TABLE "page" DROP CONSTRAINT "FK_746d8668a5fdba9ed33f361fa3f"`,
		);
		await queryRunner.query(`DROP INDEX "IDX_c3ffc5e8e6f8c65a3314b38a41"`);
		await queryRunner.query(`DROP INDEX "IDX_6ac03498d37309660e4e18395d"`);
		await queryRunner.query(`DROP INDEX "IDX_db9ded34dbab4cd5facb23ef1c"`);
		await queryRunner.query(`DROP INDEX "IDX_20b94b139fa1a34f01acc932ca"`);
		await queryRunner.query(`DROP INDEX "IDX_3f053796a31419e41a0129a5e9"`);
		await queryRunner.query(`DROP TABLE "page"`);
	}
}
