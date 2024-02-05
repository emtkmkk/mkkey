export class addIndexFeatured1683682889953 {
	name = "addIndexFeatured1683682889953";

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX note_user_createdat_index ON "note"("userId","createdAt")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX note_user_createdat_index`);
	}
}
