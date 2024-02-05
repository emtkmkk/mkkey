export class alterIndexReaction1683682889957 {
	name = "alterIndexReaction1683682889957";

	async up(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_ad0c221b25672daf2df320a817"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_ad0c221b25672daf2df320a817" ON "note_reaction" ("userId", "noteId", "reaction")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_ad0c221b25672daf2df320a817"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_ad0c221b25672daf2df320a817" ON "note_reaction" ("userId", "noteId")`,
		);
	}
}
