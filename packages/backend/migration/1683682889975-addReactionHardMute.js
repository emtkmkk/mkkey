export class addReactionHardMute1683682889975 {
	name = "addReactionHardMute1683682889975";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD "enableReactionMute" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD "reactionMutedWords" jsonb NOT NULL DEFAULT '[]'`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD "rejectMuteReaction" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3befe6f999c86aff06eb0257b5" ON "user_profile" ("enableReactionMute") `,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_3befe6f999c86aff06eb0257b5"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "rejectMuteReaction"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "reactionMutedWords"`);
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "enableReactionMute"`);
	}
}
