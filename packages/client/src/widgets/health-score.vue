<template>
	<MkContainer
		:show-header="widgetProps.showHeader"
		:naked="widgetProps.transparent"
		class="mkw-healthScore"
	>
		<template #header
			><i class="ph-heartbeat ph-bold ph-lg"></i
			>{{ i18n.ts._widgets.healthScore }}</template
		>

		<div class="panel">
			<div class="score">
				<div class="value">{{ score }}</div>
				<div class="meta">
					<div class="status" :class="statusClass">{{ statusLabel }}</div>
					<div class="timestamp">{{ i18n.ts.updatedAt }}: {{ lastUpdatedText }}</div>
				</div>
			</div>

			<div class="bar">
				<div class="fill" :style="{ width: `${score}%` }"></div>
			</div>

			<details class="details">
				<summary>{{ i18n.ts.details }}</summary>
				<ul>
					<li
						v-for="item in breakdownItems"
						:key="item.key"
						:title="item.tooltip"
					>
						<div class="name">{{ item.label }}</div>
						<div class="value">{{ item.valueText }}</div>
						<div
							class="penalty"
							:class="{ danger: item.penalty > 0 }"
						>
							{{ item.penalty > 0 ? `-${item.penalty.toFixed(1)}` : "OK" }}
						</div>
					</li>
				</ul>
			</details>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { GetFormResultType } from "@/scripts/form";
import type { Widget, WidgetComponentExpose } from "./widget";
import { useWidgetPropsManager } from "./widget";
import MkContainer from "@/components/MkContainer.vue";
import { stream } from "@/stream";
import { i18n } from "@/i18n";

const name = "healthScore";

const widgetPropsDef = {
	showHeader: {
		type: "boolean" as const,
		default: true,
	},
	transparent: {
		type: "boolean" as const,
		default: false,
	},
	cpuWeight: {
		type: "number" as const,
		default: 20,
		min: 0,
		max: 100,
	},
	memoryWeight: {
		type: "number" as const,
		default: 20,
		min: 0,
		max: 100,
	},
	queueWeight: {
		type: "number" as const,
		default: 25,
		min: 0,
		max: 100,
	},
	eventLoopLagWeight: {
		type: "number" as const,
		default: 15,
		min: 0,
		max: 100,
	},
	dbLatencyWeight: {
		type: "number" as const,
		default: 10,
		min: 0,
		max: 100,
	},
	redisLatencyWeight: {
		type: "number" as const,
		default: 10,
		min: 0,
		max: 100,
	},
	cpuWarn: {
		type: "number" as const,
		default: 70,
		min: 0,
		max: 100,
	},
	cpuCritical: {
		type: "number" as const,
		default: 90,
		min: 0,
		max: 100,
	},
	memoryWarn: {
		type: "number" as const,
		default: 70,
		min: 0,
		max: 100,
	},
	memoryCritical: {
		type: "number" as const,
		default: 90,
		min: 0,
		max: 100,
	},
	queueWarn: {
		type: "number" as const,
		default: 3,
		min: 0,
		max: 30,
	},
	queueCritical: {
		type: "number" as const,
		default: 8,
		min: 0,
		max: 50,
	},
	eventLoopLagWarn: {
		type: "number" as const,
		default: 80,
		min: 0,
		max: 2000,
	},
	eventLoopLagCritical: {
		type: "number" as const,
		default: 200,
		min: 0,
		max: 5000,
	},
	dbLatencyWarn: {
		type: "number" as const,
		default: 80,
		min: 0,
		max: 30000,
	},
	dbLatencyCritical: {
		type: "number" as const,
		default: 300,
		min: 0,
		max: 30000,
	},
	redisLatencyWarn: {
		type: "number" as const,
		default: 40,
		min: 0,
		max: 30000,
	},
	redisLatencyCritical: {
		type: "number" as const,
		default: 150,
		min: 0,
		max: 30000,
	},
	queueThroughputWarn: {
		type: "number" as const,
		default: 0.5,
		min: 0,
		max: 200,
		step: 0.1,
	},
	queueThroughputCritical: {
		type: "number" as const,
		default: 0.1,
		min: 0,
		max: 200,
		step: 0.1,
	},
	throughputPenaltyWeight: {
		type: "number" as const,
		default: 8,
		min: 0,
		max: 100,
	},
	statsStaleWarnSec: {
		type: "number" as const,
		default: 30,
		min: 5,
		max: 300,
	},
	statsStaleCriticalSec: {
		type: "number" as const,
		default: 90,
		min: 10,
		max: 600,
	},
	stalePenaltyWeight: {
		type: "number" as const,
		default: 10,
		min: 0,
		max: 100,
	},
	scoreWarn: {
		type: "number" as const,
		default: 70,
		min: 0,
		max: 100,
	},
	scoreCritical: {
		type: "number" as const,
		default: 40,
		min: 0,
		max: 100,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

type HealthStats = {
	cpuUsage: number;
	memoryUsage: number;
	queuePressure: number;
	queueWaiting: number;
	queueThroughputPerSec: number;
	eventLoopLagMs: number;
	dbLatencyMs: number;
	redisLatencyMs: number;
};

const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();

const { widgetProps, configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

const stats = ref<HealthStats>({
	cpuUsage: 0,
	memoryUsage: 0,
	queuePressure: 0,
	queueWaiting: 0,
	queueThroughputPerSec: 0,
	eventLoopLagMs: 0,
	dbLatencyMs: 0,
	redisLatencyMs: 0,
});
const lastUpdatedAt = ref<Date | null>(null);

const healthConnection = stream.useChannel("healthStats");

const applyStats = (nextStats: HealthStats) => {
	stats.value = nextStats;
	lastUpdatedAt.value = new Date();
};

const onStatsLog = (statsLog: HealthStats[]) => {
	const latest = statsLog[0];
	if (latest) applyStats(latest);
};

const metricRiskHigh = (
	value: number,
	warnThreshold: number,
	criticalThreshold: number,
) => {
	if (criticalThreshold <= warnThreshold) {
		return value >= criticalThreshold ? 1 : 0;
	}
	if (value <= warnThreshold) return 0;
	if (value >= criticalThreshold) return 1;
	return (value - warnThreshold) / (criticalThreshold - warnThreshold);
};

const metricRiskLow = (
	value: number,
	warnThreshold: number,
	criticalThreshold: number,
) => {
	if (warnThreshold <= criticalThreshold) {
		return value <= criticalThreshold ? 1 : 0;
	}
	if (value >= warnThreshold) return 0;
	if (value <= criticalThreshold) return 1;
	return (warnThreshold - value) / (warnThreshold - criticalThreshold);
};

const staleSeconds = computed(() => {
	if (!lastUpdatedAt.value) return Number.POSITIVE_INFINITY;
	return (Date.now() - lastUpdatedAt.value.getTime()) / 1000;
});

const totalWeight = computed(() => {
	const sum =
		widgetProps.cpuWeight +
		widgetProps.memoryWeight +
		widgetProps.queueWeight +
		widgetProps.eventLoopLagWeight +
		widgetProps.dbLatencyWeight +
		widgetProps.redisLatencyWeight +
		widgetProps.throughputPenaltyWeight +
		widgetProps.stalePenaltyWeight;
	return Math.max(1, sum);
});

const metrics = computed(() => {
	const current = stats.value;
	return [
		{
			key: "cpu",
			label: "CPU",
			weight: widgetProps.cpuWeight,
			risk: metricRiskHigh(
				current.cpuUsage,
				widgetProps.cpuWarn,
				widgetProps.cpuCritical,
			),
			valueText: `${current.cpuUsage.toFixed(1)}%`,
			tooltip: `warn=${widgetProps.cpuWarn}% critical=${widgetProps.cpuCritical}%`,
		},
		{
			key: "memory",
			label: "MEM",
			weight: widgetProps.memoryWeight,
			risk: metricRiskHigh(
				current.memoryUsage,
				widgetProps.memoryWarn,
				widgetProps.memoryCritical,
			),
			valueText: `${current.memoryUsage.toFixed(1)}%`,
			tooltip: `warn=${widgetProps.memoryWarn}% critical=${widgetProps.memoryCritical}%`,
		},
		{
			key: "queue",
			label: "QUEUE",
			weight: widgetProps.queueWeight,
			risk: metricRiskHigh(
				current.queuePressure,
				widgetProps.queueWarn,
				widgetProps.queueCritical,
			),
			valueText:
				current.queueWaiting > 0
					? `${current.queuePressure.toFixed(2)}x (waiting=${current.queueWaiting})`
					: `${current.queuePressure.toFixed(2)}x`,
			tooltip: `warn=${widgetProps.queueWarn} critical=${widgetProps.queueCritical}`,
		},
		{
			key: "eventLoopLag",
			label: "EVENT LOOP",
			weight: widgetProps.eventLoopLagWeight,
			risk: metricRiskHigh(
				current.eventLoopLagMs,
				widgetProps.eventLoopLagWarn,
				widgetProps.eventLoopLagCritical,
			),
			valueText: `${current.eventLoopLagMs.toFixed(1)}ms`,
			tooltip: `warn=${widgetProps.eventLoopLagWarn}ms critical=${widgetProps.eventLoopLagCritical}ms`,
		},
		{
			key: "dbLatency",
			label: "DB LATENCY",
			weight: widgetProps.dbLatencyWeight,
			risk: metricRiskHigh(
				current.dbLatencyMs,
				widgetProps.dbLatencyWarn,
				widgetProps.dbLatencyCritical,
			),
			valueText: `${current.dbLatencyMs.toFixed(0)}ms`,
			tooltip: `warn=${widgetProps.dbLatencyWarn}ms critical=${widgetProps.dbLatencyCritical}ms`,
		},
		{
			key: "redisLatency",
			label: "REDIS LATENCY",
			weight: widgetProps.redisLatencyWeight,
			risk: metricRiskHigh(
				current.redisLatencyMs,
				widgetProps.redisLatencyWarn,
				widgetProps.redisLatencyCritical,
			),
			valueText: `${current.redisLatencyMs.toFixed(0)}ms`,
			tooltip: `warn=${widgetProps.redisLatencyWarn}ms critical=${widgetProps.redisLatencyCritical}ms`,
		},
		{
			key: "queueThroughput",
			label: "QUEUE THROUGHPUT",
			weight: widgetProps.throughputPenaltyWeight,
			risk: metricRiskLow(
				current.queueThroughputPerSec,
				widgetProps.queueThroughputWarn,
				widgetProps.queueThroughputCritical,
			),
			valueText: `${current.queueThroughputPerSec.toFixed(2)} job/s`,
			tooltip: `warn>=${widgetProps.queueThroughputWarn} critical<=${widgetProps.queueThroughputCritical}`,
		},
		{
			key: "stale",
			label: "STREAM STALE",
			weight: widgetProps.stalePenaltyWeight,
			risk: metricRiskHigh(
				staleSeconds.value,
				widgetProps.statsStaleWarnSec,
				widgetProps.statsStaleCriticalSec,
			),
			valueText:
				staleSeconds.value === Number.POSITIVE_INFINITY
					? "no data"
					: `${staleSeconds.value.toFixed(1)}s`,
			tooltip: `warn=${widgetProps.statsStaleWarnSec}s critical=${widgetProps.statsStaleCriticalSec}s`,
		},
	];
});

const penalty = computed(() => {
	return metrics.value.reduce(
		(total, metric) =>
			total + (metric.weight / totalWeight.value) * metric.risk * 100,
		0,
	);
});

const score = computed(() => {
	return clampRange(Math.round(100 - penalty.value), 0, 100);
});

const statusLabel = computed(() => {
	if (score.value <= widgetProps.scoreCritical) return "CRITICAL";
	if (score.value <= widgetProps.scoreWarn) return "WARN";
	return "OK";
});

const statusClass = computed(() => {
	if (statusLabel.value === "CRITICAL") return "critical";
	if (statusLabel.value === "WARN") return "warn";
	return "ok";
});

const breakdownItems = computed(() => {
	return metrics.value.map((metric) => ({
		...metric,
		penalty: (metric.weight / totalWeight.value) * metric.risk * 100,
	}));
});

const lastUpdatedText = computed(() => {
	if (!lastUpdatedAt.value) return "-";
	return lastUpdatedAt.value.toLocaleTimeString();
});

onMounted(() => {
	healthConnection.on("stats", applyStats);
	healthConnection.on("statsLog", onStatsLog);
	healthConnection.send("requestLog", {
		id: Math.random().toString().substr(2, 8),
		length: 1,
	});
});

onUnmounted(() => {
	healthConnection.off("stats", applyStats);
	healthConnection.off("statsLog", onStatsLog);
	healthConnection.dispose();
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});

function clampRange(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
</script>

<style lang="scss" scoped>
.mkw-healthScore {
	.panel {
		padding: 1rem;
		display: grid;
		gap: 0.75rem;
	}

	.score {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;

		> .value {
			font-size: 2rem;
			font-weight: 700;
			line-height: 1;
		}

		> .meta {
			display: grid;
			justify-items: end;
			gap: 0.25rem;

			> .status {
				padding: 0.125rem 0.5rem;
				border-radius: 999px;
				font-weight: 700;
				font-size: 0.875rem;

				&.ok {
					color: var(--success);
					background: color-mix(in srgb, var(--success) 20%, transparent);
				}

				&.warn {
					color: var(--warn);
					background: color-mix(in srgb, var(--warn) 20%, transparent);
				}

				&.critical {
					color: var(--error);
					background: color-mix(in srgb, var(--error) 20%, transparent);
				}
			}

			> .timestamp {
				font-size: 0.8rem;
				opacity: 0.7;
			}
		}
	}

	.bar {
		height: 0.5rem;
		border-radius: 999px;
		overflow: hidden;
		background: var(--bg);
		border: solid 0.03125rem var(--divider);

		> .fill {
			height: 100%;
			background: linear-gradient(90deg, var(--error), var(--warn), var(--success));
			transition: width 0.3s ease;
		}
	}

	.details {
		> summary {
			cursor: pointer;
			opacity: 0.8;
		}

		> ul {
			margin: 0.75rem 0 0;
			padding: 0;
			list-style: none;
			display: grid;
			gap: 0.5rem;

			> li {
				display: grid;
				grid-template-columns: auto 1fr auto;
				align-items: center;
				gap: 0.5rem;
				font-family: var(--monospace);

				> .name {
					font-weight: 700;
				}

				> .value {
					text-align: right;
					opacity: 0.8;
				}

				> .penalty {
					min-width: 3.5rem;
					text-align: right;

					&.danger {
						color: var(--error);
					}
				}
			}
		}
	}
}
</style>
