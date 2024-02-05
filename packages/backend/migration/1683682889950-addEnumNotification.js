export class addEnumNotification1683682889950 {
	name = "addEnumNotification1683682889950";

	async up(queryRunner) {
		await queryRunner.query(
			`ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'unreadAntenna'`,
		);
		await queryRunner.query(
			`ALTER TYPE user_profile_mutingnotificationtypes_enum ADD VALUE IF NOT EXISTS 'unreadAntenna'`,
		);
	}

	async down(queryRunner) {}
}
