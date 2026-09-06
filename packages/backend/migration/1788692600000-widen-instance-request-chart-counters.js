/**
 * インスタンス別リクエスト数のチャート列を smallint から integer へ拡張する。
 *
 * @remarks
 * 日次の連合リクエスト数は smallint の上限 32767 を超えるため、保存失敗を防ぐ。
 * down では PostgreSQL の型変換エラーを避けるため、範囲外の値を smallint の
 * 上下限へ丸める。したがって down はデータを損失し得る。
 *
 * @internal
 */
export class WidenInstanceRequestChartCounters1788692600000 {
	name = "WidenInstanceRequestChartCounters1788692600000";

	async up(queryRunner) {
		for (const table of ["__chart__instance", "__chart_day__instance"]) {
			await queryRunner.query(
				`ALTER TABLE "${table}"
					ALTER COLUMN "___requests_failed" TYPE integer,
					ALTER COLUMN "___requests_succeeded" TYPE integer,
					ALTER COLUMN "___requests_received" TYPE integer`,
			);
		}
	}

	async down(queryRunner) {
		for (const table of ["__chart__instance", "__chart_day__instance"]) {
			await queryRunner.query(
				`ALTER TABLE "${table}"
					ALTER COLUMN "___requests_failed" TYPE smallint USING LEAST(32767, GREATEST(-32768, "___requests_failed"))::smallint,
					ALTER COLUMN "___requests_succeeded" TYPE smallint USING LEAST(32767, GREATEST(-32768, "___requests_succeeded"))::smallint,
					ALTER COLUMN "___requests_received" TYPE smallint USING LEAST(32767, GREATEST(-32768, "___requests_received"))::smallint`,
			);
		}
	}
}
