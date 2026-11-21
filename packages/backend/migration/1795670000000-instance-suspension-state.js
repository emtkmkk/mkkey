/**
 * 配送先サーバの停止状態を「理由つきの状態」で持てるようにし、状態の変化の履歴テーブルを作る。
 *
 * - instance に suspensionState などの列を足す。`isSuspended` / `isNotResponding` は読む側が多いので残し、
 *   アプリ側で新しい列と同時に書き換える（`isSuspended = suspensionState <> 'none'`）。
 * - 既存の停止中は、次の 3 件を除いて全部再開する（計画 plans/instance-delivery-health-plan.md の Q5）。
 *   再開したもののうち本当に落ちているサーバは、3 日間の不通で自動停止され直す。
 *   - tickler.cc: 手動停止（スパム騒動）
 *   - relay.mkkey.net: 手動停止（運営者がサービスを停止）
 *   - koliosky.com: 閉鎖停止（サーバ自体が 410）
 * - 変更前の値は、サーバごとに履歴（event = migrated）の detail に残す。down はそれを読んで元に戻す。
 * - 不通の印（isNotResponding）が付いているサーバは、不通になった時刻を「このマイグレーションの時刻」とする。
 *   本当の時刻は分からないため。自動停止はそこから 3 日後になる。
 */

/** 状態を指定して残すサーバ */
const keepSuspended = [
	{ host: "tickler.cc", state: "manuallySuspended", reason: "スパム騒動" },
	{ host: "relay.mkkey.net", state: "manuallySuspended", reason: "運営者（自分）がサービスを停止" },
	{ host: "koliosky.com", state: "goneSuspended", reason: "サーバ自体が 410" },
];

/** AID と同じ形（2000/1/1 からのミリ秒の 36 進 8 桁 + 2 桁）の ID を作る */
let counter = Math.floor(Math.random() * 1296);
function genId(date) {
	const t = Math.max(0, date.getTime() - 946684800000);
	counter++;
	return t.toString(36).padStart(8, "0") + counter.toString(36).padStart(2, "0").slice(-2);
}

export class InstanceSuspensionState1795670000000 {
	name = "InstanceSuspensionState1795670000000";

	async up(queryRunner) {
		//#region 列とテーブルの追加
		await queryRunner.query(`CREATE TYPE "instance_suspensionstate_enum" AS ENUM('none', 'manuallySuspended', 'goneSuspended', 'autoSuspendedForNotResponding')`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "suspensionState" "instance_suspensionstate_enum" NOT NULL DEFAULT 'none'`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "suspendedAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "suspendedReason" character varying(512)`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "suspendedById" character varying(32)`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "notRespondingSince" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "nextProbeAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`ALTER TABLE "instance" ADD "probeFailures" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE "instance" ADD CONSTRAINT "FK_instance_suspendedById" FOREIGN KEY ("suspendedById") REFERENCES "user"("id") ON DELETE SET NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_instance_suspensionState" ON "instance" ("suspensionState")`);

		await queryRunner.query(`CREATE TABLE "instance_health_log" (
			"id" character varying(32) NOT NULL,
			"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
			"instanceId" character varying(32),
			"host" character varying(128) NOT NULL,
			"event" character varying(64) NOT NULL,
			"fromState" character varying(64),
			"toState" character varying(64),
			"source" character varying(32) NOT NULL,
			"actorId" character varying(32),
			"reason" character varying(512),
			"detail" jsonb NOT NULL DEFAULT '{}',
			CONSTRAINT "PK_instance_health_log" PRIMARY KEY ("id"),
			CONSTRAINT "FK_instance_health_log_instanceId" FOREIGN KEY ("instanceId") REFERENCES "instance"("id") ON DELETE SET NULL,
			CONSTRAINT "FK_instance_health_log_actorId" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL
		)`);
		await queryRunner.query(`CREATE INDEX "IDX_instance_health_log_instanceId_createdAt" ON "instance_health_log" ("instanceId", "createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_instance_health_log_createdAt" ON "instance_health_log" ("createdAt")`);
		await queryRunner.query(`CREATE INDEX "IDX_instance_health_log_host" ON "instance_health_log" ("host")`);
		//#endregion

		//#region 既存データの移行
		const now = new Date();
		const rows = await queryRunner.query(`SELECT "id", "host", "isSuspended", "isNotResponding", "latestStatus", "latestRequestSentAt", "latestRequestReceivedAt", "lastCommunicatedAt", "infoUpdatedAt" FROM "instance" WHERE "isSuspended" = true`);

		for (const row of rows) {
			const keep = keepSuspended.find((k) => k.host === row.host);
			const toState = keep ? keep.state : "none";
			await queryRunner.query(
				`INSERT INTO "instance_health_log" ("id", "createdAt", "instanceId", "host", "event", "fromState", "toState", "source", "reason", "detail") VALUES ($1, $2, $3, $4, 'migrated', NULL, $5, 'migration', $6, $7)`,
				[
					genId(now),
					now,
					row.id,
					row.host,
					toState,
					keep ? keep.reason : "作り直しに合わせて一度再開",
					JSON.stringify({
						isSuspended: row.isSuspended,
						isNotResponding: row.isNotResponding,
						latestStatus: row.latestStatus,
						latestRequestSentAt: row.latestRequestSentAt,
						latestRequestReceivedAt: row.latestRequestReceivedAt,
						lastCommunicatedAt: row.lastCommunicatedAt,
						infoUpdatedAt: row.infoUpdatedAt,
					}),
				],
			);
		}

		// 指定の 3 件以外の停止を解除する
		await queryRunner.query(
			`UPDATE "instance" SET "isSuspended" = false WHERE "isSuspended" = true AND NOT ("host" = ANY($1))`,
			[keepSuspended.map((k) => k.host)],
		);
		for (const k of keepSuspended) {
			await queryRunner.query(
				`UPDATE "instance" SET "isSuspended" = true, "suspensionState" = $2, "suspendedAt" = $3, "suspendedReason" = $4 WHERE "host" = $1`,
				[k.host, k.state, now, k.reason],
			);
		}

		// 不通の印が付いているサーバは、いまから不通とみなす
		await queryRunner.query(`UPDATE "instance" SET "notRespondingSince" = $1 WHERE "isNotResponding" = true`, [now]);
		//#endregion
	}

	async down(queryRunner) {
		// 履歴に残した変更前の値で戻す
		const logs = await queryRunner.query(`SELECT "instanceId", "detail" FROM "instance_health_log" WHERE "event" = 'migrated' AND "instanceId" IS NOT NULL`);
		for (const log of logs) {
			await queryRunner.query(
				`UPDATE "instance" SET "isSuspended" = $2, "isNotResponding" = $3 WHERE "id" = $1`,
				[log.instanceId, log.detail.isSuspended === true, log.detail.isNotResponding === true],
			);
		}

		await queryRunner.query(`DROP TABLE "instance_health_log"`);
		await queryRunner.query(`DROP INDEX "IDX_instance_suspensionState"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_instance_suspendedById"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "probeFailures"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "nextProbeAt"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "notRespondingSince"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "suspendedById"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "suspendedReason"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "suspendedAt"`);
		await queryRunner.query(`ALTER TABLE "instance" DROP COLUMN "suspensionState"`);
		await queryRunner.query(`DROP TYPE "instance_suspensionstate_enum"`);
	}
}
