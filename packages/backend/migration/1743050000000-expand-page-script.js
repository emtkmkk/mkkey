/**
 * Page.script カラムの最大長を Misskey Play 互換の 65536 文字に拡張する。
 *
 * @remarks
 * NOTE: 1743000000000 は unfollow/block 通知用マイグレーションと重複するため、
 * 本ファイルは 1743050000000 として追加する。
 */
export class ExpandPageScript1743050000000 {
	constructor() {
		this.name = "ExpandPageScript1743050000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "page" ALTER COLUMN "script" TYPE character varying(65536)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "page" ALTER COLUMN "script" TYPE character varying(16384)`,
		);
	}
}
