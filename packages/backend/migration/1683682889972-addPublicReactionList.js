export class addPublicReactionList1683682889972 {
	name = "addCanInvite1683682889971";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "isPublicLikeList" boolean NOT NULL DEFAULT true`,
		);
		await queryRunner.query(
			`ALTER TABLE "note" ADD IF NOT EXISTS "isPublicLikeList" boolean NOT NULL DEFAULT true`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isPublicLikeList"`);
		await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "isPublicLikeList"`);
	}
}
