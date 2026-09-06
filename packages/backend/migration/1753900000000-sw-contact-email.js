/**
 * プッシュ通知（VAPID）の連絡先メールアドレスを maintainerEmail から分離する。
 *
 * @remarks
 * - VAPID JWT の `sub` に使う値。Apple は `sub` の形式に厳格で、不正だと 403 を返す。
 * - maintainerEmail には Fediverse ハンドル等が入っていることがあり、`mailto:` を
 *   前置すると不正な URI になる。そのため専用カラムへ分離する。
 * - 移行時、maintainerEmail がメールアドレスとして妥当な場合のみ引き継ぐ。
 *   妥当でないインスタンスは NULL のままとし、config.url へフォールバックさせる。
 */
export class swContactEmail1753900000000 {
	constructor() {
		this.name = "swContactEmail1753900000000";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "meta" ADD "swContactEmail" character varying(128) DEFAULT NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."swContactEmail" IS 'Contact email used as the VAPID subject for Web Push.'`,
		);
		// メールアドレスとして妥当なものだけ引き継ぐ
		await queryRunner.query(
			`UPDATE "meta" SET "swContactEmail" = "maintainerEmail" WHERE "maintainerEmail" ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "swContactEmail"`);
	}
}
