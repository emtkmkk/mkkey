export class addFollowBlocking1683682889967 {
	constructor() {
		this.name = "addFollowBlocking1683682889967";
	}

	async up(queryRunner) {
		await queryRunner.query(
			`CREATE TABLE "follow_blocking" ("id" character varying(32) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "blockeeId" character varying(32) NOT NULL, "blockerId" character varying(32) NOT NULL, CONSTRAINT "PK_followblocking_id" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_follow_blocking_createdAt" ON "muting" ("createdAt") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_follow_blocking_muteeId" ON "muting" ("blockeeId") `,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_follow_blocking_muterId" ON "muting" ("blockerId") `,
		);
	}

	async down(queryRunner) {
		await queryRunner.query(
			`DROP TABLE "follow_blocking"`,
		);
	}
}
