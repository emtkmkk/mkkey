export class followedMessage1723944246767 {
	name = "followedMessage1723944246767";

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "followedMessage" character varying(256)`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "followedMessage"`);
	}
}
