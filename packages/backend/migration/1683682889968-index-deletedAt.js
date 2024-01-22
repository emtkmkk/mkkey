export class indexDeletedAt1683682889968 {
	constructor() {
		this.name = "indexDeletedAt1683682889968";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE INDEX "IDX_NOTE_DELETEDAT" ON "note" ("deletedAt") `,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_NOTE_DELETEDAT"`)
	}
}
