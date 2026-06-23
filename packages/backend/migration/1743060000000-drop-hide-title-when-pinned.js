export class DropHideTitleWhenPinned1743060000000 {
	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "page" DROP COLUMN "hideTitleWhenPinned"`,
		);
	}
	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "page" ADD "hideTitleWhenPinned" boolean NOT NULL DEFAULT false`,
		);
	}
}
