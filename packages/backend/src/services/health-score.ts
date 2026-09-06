/**
 * @packageDocumentation
 *
 * インスタンス共通の固定ポリシーでヘルススコアを計算する。
 *
 * @remarks
 * 利用者ごとの設定値は受け取らず、観測できた利用者影響を固定の最大減点へ変換する。
 * 欠測値や非有限値は危険値として扱わず、該当項目を `unknown` にする。
 *
 * @internal
 */

/** ヘルス指標の状態。 */
export type HealthMetricStatus = "ok" | "warn" | "critical" | "unknown";

/** 固定ポリシーで評価する指標名。 */
export type HealthMetricKey =
	| "apiErrors"
	| "webWorkers"
	| "workerRestarts"
	| "workerEventLoop"
	| "apiLatency"
	| "inboxQueue"
	| "deliverQueue"
	| "db"
	| "redis"
	| "workerMemory"
	| "diskFree";

/** ウィジェットで値を整形するための単位。 */
export type HealthMetricUnit =
	| "percent"
	| "count"
	| "milliseconds"
	| "seconds"
	| "megabytes";

/** 1指標の評価結果。 */
export type HealthMetricResult = {
	key: HealthMetricKey;
	status: HealthMetricStatus;
	value: number | null;
	unit: HealthMetricUnit;
	penalty: number;
	maxPenalty: number;
};

/** スコア計算に必要な観測値。 */
export type HealthScoreInput = {
	apiLatencyP95Ms: number | null;
	apiLatencySampleCount: number;
	apiServerErrorCount: number;
	expectedWebWorkers: number;
	respondingWebWorkers: number;
	expectedQueueWorkers: number;
	respondingQueueWorkers: number;
	workerRestartCount10m: number;
	workerEventLoopLagMs: number | null;
	inboxOldestWaitingMs: number | null;
	deliverOldestWaitingMs: number | null;
	dbLatencyMs: number | null;
	dbAvailable: boolean | null;
	redisLatencyMs: number | null;
	redisAvailable: boolean | null;
	workerMaxRssMb: number | null;
	diskAvailablePercent: number | null;
	diskAvailableBytes: number | null;
};

/** バックエンドから配信する総合評価。 */
export type HealthScoreResult = {
	score: number | null;
	status: HealthMetricStatus;
	components: HealthMetricResult[];
};

type Assessment = {
	risk: number | null;
	status: HealthMetricStatus;
};

/** 評価対象とするAPIサンプル数の下限。 */
const MIN_API_SAMPLES = 20;
/** API失敗率を有効にする内部エラー件数の下限。 */
const MIN_API_ERROR_COUNT = 5;
/** ディスク空き容量のGiB換算値。 */
const GIB = 1024 ** 3;

/** 指標ごとの最大減点。合計は100点。 */
const MAX_PENALTIES: Record<HealthMetricKey, number> = {
	apiErrors: 25,
	webWorkers: 12,
	workerRestarts: 5,
	workerEventLoop: 3,
	apiLatency: 20,
	inboxQueue: 10,
	deliverQueue: 5,
	db: 10,
	redis: 5,
	workerMemory: 3,
	diskFree: 2,
};

/**
 * 大きい値ほど悪い指標を評価する。
 *
 * @param value - 観測値
 * @param warn - 警告を開始する値
 * @param critical - 危険とする値
 * @returns 0〜1のリスクと状態。欠測時は unknown。
 * @internal
 */
function assessHigh(
	value: number | null,
	warn: number,
	critical: number,
): Assessment {
	if (value == null || !Number.isFinite(value)) {
		return { risk: null, status: "unknown" };
	}
	if (value < warn) return { risk: 0, status: "ok" };
	if (value >= critical) return { risk: 1, status: "critical" };
	return {
		risk: (value - warn) / (critical - warn),
		status: "warn",
	};
}

/**
 * 小さい値ほど悪い指標を評価する。
 *
 * @param value - 観測値
 * @param warn - 警告を開始する値
 * @param critical - 危険とする値
 * @returns 0〜1のリスクと状態。欠測時は unknown。
 * @internal
 */
function assessLow(
	value: number | null,
	warn: number,
	critical: number,
): Assessment {
	if (value == null || !Number.isFinite(value)) {
		return { risk: null, status: "unknown" };
	}
	if (value > warn) return { risk: 0, status: "ok" };
	if (value <= critical) return { risk: 1, status: "critical" };
	return {
		risk: (warn - value) / (warn - critical),
		status: "warn",
	};
}

/**
 * 二つの評価から悪い方を採用する。
 *
 * @param left - 一つ目の評価
 * @param right - 二つ目の評価
 * @returns より高いリスクを持つ評価
 * @internal
 */
function worstOf(left: Assessment, right: Assessment): Assessment {
	if (left.risk == null) return right;
	if (right.risk == null) return left;
	return left.risk >= right.risk ? left : right;
}

/**
 * 指標の表示用結果を組み立てる。
 *
 * @param key - 指標名
 * @param value - 表示値
 * @param unit - 表示単位
 * @param assessment - リスク評価
 * @returns 最大減点を適用した指標結果
 * @internal
 */
function metric(
	key: HealthMetricKey,
	value: number | null,
	unit: HealthMetricUnit,
	assessment: Assessment,
): HealthMetricResult {
	const maxPenalty = MAX_PENALTIES[key];
	return {
		key,
		status: assessment.status,
		value: value != null && Number.isFinite(value) ? value : null,
		unit,
		penalty:
			assessment.risk == null
				? 0
				: Math.round(maxPenalty * assessment.risk * 10) / 10,
		maxPenalty,
	};
}

/**
 * 固定ポリシーでヘルススコアを計算する。
 *
 * @remarks
 * 通常の閾値超過は項目ごとの最大減点に留める。DB/Redis疎通不能と
 * Webワーカー全欠損だけは利用不能としてスコア上限も適用する。
 *
 * @param input - 直近の観測値
 * @returns 総合点、状態、指標別内訳
 * @public
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
	const apiErrorRate =
		input.apiLatencySampleCount >= MIN_API_SAMPLES
			? (input.apiServerErrorCount / input.apiLatencySampleCount) * 100
			: null;
	const apiErrorAssessment =
		apiErrorRate == null
			? { risk: null, status: "unknown" as const }
			: input.apiServerErrorCount < MIN_API_ERROR_COUNT
				? { risk: 0, status: "ok" as const }
				: assessHigh(apiErrorRate, 0.5, 2);

	const webWorkerAvailability =
		input.expectedWebWorkers > 0
			? (input.respondingWebWorkers / input.expectedWebWorkers) * 100
			: null;
	const queueWorkersAvailable =
		input.expectedQueueWorkers === 0 ||
		input.respondingQueueWorkers >= input.expectedQueueWorkers;

	const diskAssessment = worstOf(
		assessLow(input.diskAvailablePercent, 15, 5),
		assessLow(input.diskAvailableBytes, 10 * GIB, 2 * GIB),
	);
	const inboxQueueAssessment = queueWorkersAvailable
		? assessHigh(
				input.inboxOldestWaitingMs == null
					? null
					: input.inboxOldestWaitingMs / 1000,
				60,
				300,
			)
		: { risk: 1, status: "critical" as const };
	const deliverQueueAssessment = queueWorkersAvailable
		? assessHigh(
				input.deliverOldestWaitingMs == null
					? null
					: input.deliverOldestWaitingMs / 1000,
				15 * 60,
				60 * 60,
			)
		: { risk: 1, status: "critical" as const };

	const dbAssessment =
		input.dbAvailable === false
			? { risk: 1, status: "critical" as const }
			: assessHigh(input.dbLatencyMs, 200, 500);
	const redisAssessment =
		input.redisAvailable === false
			? { risk: 1, status: "critical" as const }
			: assessHigh(input.redisLatencyMs, 50, 150);

	const components: HealthMetricResult[] = [
		metric("apiErrors", apiErrorRate, "percent", apiErrorAssessment),
		metric(
			"webWorkers",
			webWorkerAvailability,
			"percent",
			assessLow(webWorkerAvailability, 99.9, 79),
		),
		metric(
			"workerRestarts",
			input.workerRestartCount10m,
			"count",
			assessHigh(input.workerRestartCount10m, 2, 5),
		),
		metric(
			"workerEventLoop",
			input.workerEventLoopLagMs,
			"milliseconds",
			assessHigh(input.workerEventLoopLagMs, 120, 250),
		),
		metric(
			"apiLatency",
			input.apiLatencySampleCount >= 5 ? input.apiLatencyP95Ms : null,
			"milliseconds",
			assessHigh(
				input.apiLatencySampleCount >= 5 ? input.apiLatencyP95Ms : null,
				800,
				2000,
			),
		),
		metric(
			"inboxQueue",
			input.inboxOldestWaitingMs == null
				? null
				: input.inboxOldestWaitingMs / 1000,
			"seconds",
			inboxQueueAssessment,
		),
		metric(
			"deliverQueue",
			input.deliverOldestWaitingMs == null
				? null
				: input.deliverOldestWaitingMs / 1000,
			"seconds",
			deliverQueueAssessment,
		),
		metric("db", input.dbLatencyMs, "milliseconds", dbAssessment),
		metric("redis", input.redisLatencyMs, "milliseconds", redisAssessment),
		metric(
			"workerMemory",
			input.workerMaxRssMb,
			"megabytes",
			assessHigh(input.workerMaxRssMb, 800, 1200),
		),
		metric(
			"diskFree",
			input.diskAvailablePercent,
			"percent",
			diskAssessment,
		),
	];

	const evaluated = components.filter((component) => component.status !== "unknown");
	if (evaluated.length === 0) {
		return { score: null, status: "unknown", components };
	}

	const totalPenalty = components.reduce(
		(total, component) => total + component.penalty,
		0,
	);
	let score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

	const noWebWorkers =
		input.expectedWebWorkers > 0 && input.respondingWebWorkers === 0;
	const dependencyUnavailable =
		input.dbAvailable === false || input.redisAvailable === false;
	if (noWebWorkers) score = Math.min(score, 20);
	if (dependencyUnavailable) score = Math.min(score, 40);

	// 総合状態の「危険」は直接的な利用不能か、複数劣化で60点未満の場合に絞る。
	// 遅延や再起動の単独超過は内訳を critical として示しつつ、総合状態は警告に留める。
	const criticalServiceKeys = new Set<HealthMetricKey>([
		"apiErrors",
		"webWorkers",
	]);
	const hasCriticalServiceMetric = components.some(
		(component) =>
			component.status === "critical" && criticalServiceKeys.has(component.key),
	);
	const hasWarning = components.some(
		(component) =>
			component.status === "warn" || component.status === "critical",
	);

	const status: HealthMetricStatus =
		dependencyUnavailable || noWebWorkers || hasCriticalServiceMetric || score < 60
			? "critical"
			: hasWarning || score < 90
				? "warn"
				: "ok";

	return { score, status, components };
}
