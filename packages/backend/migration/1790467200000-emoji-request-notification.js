/**
 * 絵文字申請の通知の種類（emojiRequest）と、どの申請かを表す列を通知に追加する。
 *
 * @remarks
 * - 申請の種類（add / import / edit）、申請 ID、宛先（requester / reviewer）を持たせ、押したときにその申請を開けるようにする。
 * - enum への値の追加は `transaction = false` にする（トランザクション内だと追加した値をすぐ使えず 55P04 になるため。
 *   周年バッジの追加と同じやり方）。
 * - down は追加した列だけを消す。PostgreSQL の enum から値は消せないので、通知の種類 emojiRequest は残る
 *   （使われなくなるだけで害は無い）。
 *
 * @internal
 */
export class EmojiRequestNotification1790467200000 {
	constructor() {
		this.name = "EmojiRequestNotification1790467200000";
		this.transaction = false;
	}

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'emojiRequest'`,
		);
		await queryRunner.query(
			`ALTER TYPE user_profile_mutingnotificationtypes_enum ADD VALUE IF NOT EXISTS 'emojiRequest'`,
		);
		await queryRunner.query(
			`ALTER TABLE "notification"
				ADD COLUMN IF NOT EXISTS "emojiRequestKind" character varying(16),
				ADD COLUMN IF NOT EXISTS "emojiRequestId" character varying(32),
				ADD COLUMN IF NOT EXISTS "emojiRequestRole" character varying(16)`,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`ALTER TABLE "notification"
				DROP COLUMN IF EXISTS "emojiRequestRole",
				DROP COLUMN IF EXISTS "emojiRequestId",
				DROP COLUMN IF EXISTS "emojiRequestKind"`,
		);
	}
}
