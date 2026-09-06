/**
 * @packageDocumentation
 *
 * 固定ヘルススコアポリシーの単体テスト。
 *
 * @internal
 */
import * as assert from "assert";
import {
	calculateHealthScore,
	type HealthScoreInput,
} from "../../src/services/health-score.js";

/** 正常状態の基準入力を作る。 */
const healthyInput = (): HealthScoreInput => ({
	apiLatencyP95Ms: 200,
	apiLatencySampleCount: 1000,
	apiServerErrorCount: 0,
	expectedWebWorkers: 5,
	respondingWebWorkers: 5,
	expectedQueueWorkers: 1,
	respondingQueueWorkers: 1,
	workerRestartCount10m: 0,
	workerEventLoopLagMs: 20,
	inboxOldestWaitingMs: 0,
	deliverOldestWaitingMs: 0,
	dbLatencyMs: 5,
	dbAvailable: true,
	redisLatencyMs: 2,
	redisAvailable: true,
	workerMaxRssMb: 400,
	diskAvailablePercent: 70,
	diskAvailableBytes: 60 * 1024 ** 3,
});

describe("calculateHealthScore", () => {
	it("正常系：すべての指標が正常な場合、100点になる", () => {
		const result = calculateHealthScore(healthyInput());

		assert.strictEqual(result.score, 100);
		assert.strictEqual(result.status, "ok");
		assert.ok(result.components.every((component) => component.penalty === 0));
	});

	it("境界値：API遅延だけが危険でも、総合点は0にならない", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			apiLatencyP95Ms: 2000,
		});

		assert.strictEqual(result.score, 80);
		assert.strictEqual(result.status, "warn");
		assert.strictEqual(
			result.components.find((component) => component.key === "apiLatency")
				?.status,
			"critical",
		);
		assert.strictEqual(
			result.components.find((component) => component.key === "apiLatency")
				?.penalty,
			20,
		);
	});

	it("正常系：APIサンプル不足は失敗率を評価対象外にする", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			apiLatencySampleCount: 4,
			apiServerErrorCount: 4,
		});

		const apiErrors = result.components.find(
			(component) => component.key === "apiErrors",
		);
		assert.strictEqual(apiErrors?.status, "unknown");
		assert.strictEqual(apiErrors?.penalty, 0);
	});

	it("異常系：API内部エラー率が2%の場合、総合状態も危険になる", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			apiServerErrorCount: 20,
		});

		assert.strictEqual(result.score, 75);
		assert.strictEqual(result.status, "critical");
	});

	it("異常系：DB疎通不能の場合、危険状態かつ40点以下になる", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			dbLatencyMs: null,
			dbAvailable: false,
		});

		assert.strictEqual(result.status, "critical");
		assert.ok(result.score != null && result.score <= 40);
	});

	it("異常系：Webワーカーが1台欠けた場合、警告になる", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			respondingWebWorkers: 4,
		});

		assert.strictEqual(result.status, "warn");
		assert.ok(result.score != null && result.score > 0);
	});

	it("異常系：Webワーカーが全停止した場合、20点以下になる", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			respondingWebWorkers: 0,
		});

		assert.strictEqual(result.status, "critical");
		assert.ok(result.score != null && result.score <= 20);
	});

	it("異常系：複数の実用上の劣化が重なっても段階的な点数になる", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			apiLatencyP95Ms: 2200,
			apiServerErrorCount: 8,
			respondingWebWorkers: 4,
			workerRestartCount10m: 5,
		});

		assert.strictEqual(result.status, "critical");
		assert.ok(result.score != null && result.score >= 50 && result.score <= 70);
	});

	it("正常系：キューが空の場合、処理速度がなくても減点しない", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			inboxOldestWaitingMs: 0,
			deliverOldestWaitingMs: 0,
		});

		assert.strictEqual(
			result.components.find((component) => component.key === "inboxQueue")
				?.penalty,
			0,
		);
		assert.strictEqual(
			result.components.find((component) => component.key === "deliverQueue")
				?.penalty,
			0,
		);
	});

	it("異常系：非有限値は危険値ではなく不明として扱う", () => {
		const result = calculateHealthScore({
			...healthyInput(),
			workerEventLoopLagMs: Number.NaN,
		});

		const eventLoop = result.components.find(
			(component) => component.key === "workerEventLoop",
		);
		assert.strictEqual(eventLoop?.status, "unknown");
		assert.strictEqual(eventLoop?.penalty, 0);
	});
});
