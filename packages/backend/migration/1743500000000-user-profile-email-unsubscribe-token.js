/**
 * メール配信停止用トークンカラムを追加する。
 *
 * @remarks
 * - 案内系メール（休眠アカウント削除予告等）にログイン不要の配信停止リンクを載せるためのトークン。
 * - ユーザー単位で固定・恒久有効。初回のメール送信時に生成される。
 * - 照合高速化と重複防止のため UNIQUE インデックスを張る。
 */
export class userProfileEmailUnsubscribeToken1743500000000 {
	constructor() {
		this.name = "userProfileEmailUnsubscribeToken1743500000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "user_profile" ADD "emailUnsubscribeToken" character varying(128) DEFAULT NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_user_profile_emailUnsubscribeToken" ON "user_profile" ("emailUnsubscribeToken")`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP INDEX "IDX_user_profile_emailUnsubscribeToken"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_profile" DROP COLUMN "emailUnsubscribeToken"`,
		);
	}
}
