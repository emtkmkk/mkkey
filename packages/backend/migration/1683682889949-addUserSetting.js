export class addUserSetting1683682889949 {
	name = "addUserSetting1683682889949";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "blockPostPublic" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "blockPostHome" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "blockPostNotLocal" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "blockPostNotLocalPublic" boolean NOT NULL DEFAULT false`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD IF NOT EXISTS "isSilentLocked" boolean NOT NULL DEFAULT false`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostPublic"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "blockPostHome"`);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "blockPostNotLocal"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user" DROP COLUMN "blockPostNotLocalPublic"`,
		);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSilentLocked"`);
	}
}
