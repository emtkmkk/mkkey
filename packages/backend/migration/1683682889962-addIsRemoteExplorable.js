export class addIsRemoteExplorable1683682889962 {
	name = "addIsRemoteExplorable1683682889962";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "isRemoteExplorable" boolean NOT NULL DEFAULT true`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5a1b83c7cab66f167e6888189" ON "user" ("isRemoteExplorable") `,
		);
	}
	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_d5a1b83c7cab66f167e6888189"`);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "isRemoteExplorable"`,
		);
	}
}
