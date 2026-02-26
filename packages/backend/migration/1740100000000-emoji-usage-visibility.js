/**
 * 絵文字テーブルに usageVisibility, allowedUserIds, motifUserId, motifUserMode を追加する。
 * 既存データ: category が '!' で始まる行は usageVisibility = 'private'、それ以外は 'public' に設定。
 * 後方互換のフォールバック（usageVisibility 未設定時は category で判定）は repository/pack 側で行う。
 */
export class EmojiUsageVisibility1740100000000 {
	name = "EmojiUsageVisibility1740100000000";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "usageVisibility" character varying(32) DEFAULT 'private'`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "allowedUserIds" character varying(128) array NOT NULL DEFAULT '{}'`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "motifUserId" character varying(128)`,
		);
		await queryRunner.query(
			`ALTER TABLE "emoji" ADD "motifUserMode" character varying(32) DEFAULT 'any'`,
		);

		// 既存: usageVisibility デフォルトは private。category が ! で始まらない行は public に上書き
		await queryRunner.query(
			`UPDATE "emoji" SET "usageVisibility" = 'public' WHERE "category" IS NULL OR "category" NOT LIKE '!%'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "motifUserMode"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "motifUserId"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "allowedUserIds"`);
		await queryRunner.query(`ALTER TABLE "emoji" DROP COLUMN "usageVisibility"`);
	}
}
