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
				<div class="value">{{ scoreText }}</div>
				<div class="meta">
					<div class="status" :class="statusClass">{{ statusLabel }}</div>
					<div class="timestamp">{{ i18n.ts.updatedAt }}: {{ lastUpdatedText }}</div>
				</div>
			</div>

			<div class="bar">
				<div class="fill" :style="{ width: `${score ?? 0}%` }"></div>
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
						<div class="penalty" :class="{ danger: item.penalty > 0 }">
							{{ item.penaltyText }}
						</div>
					</li>
				</ul>
			</details>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * バックエンドが共通ポリシーで計算したインスタンスのヘルススコアを表示する。
 *
 * @remarks
 * 重みや閾値は利用者ごとに変更させず、ウィジェットは表示だけを担当する。
 * 受信が30秒以上止まった場合は、最後の点数を健康状態として見せず不明へ切り替える。
 *
 * @public
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { GetFormResultType } from "@/scripts/form";
import type { Widget, WidgetComponentExpose } from "./widget";
import { useWidgetPropsManager } from "./widget";
import MkContainer from "@/components/MkContainer.vue";
import { stream } from "@/stream";
import { i18n } from "@/i18n";

const name = "healthScore";
const streamStaleMs = 30_000;

const widgetPropsDef = {
	showHeader: {
		type: "boolean" as const,
		default: true,
	},
	transparent: {
		type: "boolean" as const,
		default: false,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;
type HealthMetricStatus = "ok" | "warn" | "critical" | "unknown";
type HealthMetricKey =
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
type HealthMetricUnit =
	| "percent"
	| "count"
	| "milliseconds"
	| "seconds"
	| "megabytes";
type HealthMetricResult = {
	key: HealthMetricKey;
	status: HealthMetricStatus;
	value: number | null;
	unit: HealthMetricUnit;
	penalty: number;
	maxPenalty: number;
};
type HealthStats = {
	healthScore?: {
		score: number | null;
		status: HealthMetricStatus;
		components: HealthMetricResult[];
	};
};

const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps): void }>();

const { widgetProps, configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

const stats = ref<HealthStats>({});
const lastUpdatedAt = ref<Date | null>(null);
const now = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const healthConnection = stream.useChannel("healthStats");

/** 受信した最新統計を反映する。 */
const applyStats = (nextStats: HealthStats): void => {
	stats.value = nextStats;
	lastUpdatedAt.value = new Date();
};

/** 履歴応答の最新値だけを初期表示へ使う。 */
const onStatsLog = (statsLog: HealthStats[]): void => {
	const latest = statsLog[0];
	if (latest) applyStats(latest);
};

const streamIsStale = computed(
	() =>
		lastUpdatedAt.value == null ||
		now.value - lastUpdatedAt.value.getTime() >= streamStaleMs,
);
const score = computed(() =>
	streamIsStale.value ? null : (stats.value.healthScore?.score ?? null),
);
const scoreText = computed(() => (score.value == null ? "--" : String(score.value)));
const status = computed<HealthMetricStatus>(() =>
	streamIsStale.value ? "unknown" : (stats.value.healthScore?.status ?? "unknown"),
);
const statusLabel = computed(() => {
	switch (status.value) {
		case "ok":
			return i18n.ts._widgets._healthScore.statusOk;
		case "warn":
			return i18n.ts._widgets._healthScore.statusWarn;
		case "critical":
			return i18n.ts._widgets._healthScore.statusCritical;
		default:
			return i18n.ts._widgets._healthScore.statusUnknown;
	}
});
const statusClass = computed(() => status.value);

/** 固定指標名を現在の表示言語へ変換する。 */
function metricLabel(key: HealthMetricKey): string {
	return i18n.ts._widgets._healthScore[key];
}

/** 指標値をバックエンド指定の単位で整形する。 */
function formatMetricValue(metric: HealthMetricResult): string {
	if (metric.value == null) return i18n.ts._widgets._healthScore.noData;
	switch (metric.unit) {
		case "percent":
			return `${metric.value.toFixed(1)}%`;
		case "count":
			return metric.value.toFixed(0);
		case "milliseconds":
			return `${metric.value.toFixed(1)}ms`;
		case "seconds":
			if (metric.value >= 3600) return `${(metric.value / 3600).toFixed(1)}h`;
			if (metric.value >= 60) return `${(metric.value / 60).toFixed(1)}m`;
			return `${metric.value.toFixed(1)}s`;
		case "megabytes":
			return `${metric.value.toFixed(0)}MB`;
	}
}

const breakdownItems = computed(() =>
	(streamIsStale.value ? [] : (stats.value.healthScore?.components ?? [])).map((metric) => ({
		...metric,
		label: metricLabel(metric.key),
		valueText: formatMetricValue(metric),
		penaltyText:
			metric.status === "unknown"
				? "--"
				: metric.penalty > 0
					? `-${metric.penalty.toFixed(1)}`
					: i18n.ts._widgets._healthScore.statusOk,
		tooltip: `${metricLabel(metric.key)} / max -${metric.maxPenalty}`,
	})),
);

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
	clockTimer = setInterval(() => {
		now.value = Date.now();
	}, 5000);
});

onUnmounted(() => {
	healthConnection.off("stats", applyStats);
	healthConnection.off("statsLog", onStatsLog);
	healthConnection.dispose();
	if (clockTimer != null) clearInterval(clockTimer);
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
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

				&.unknown {
					opacity: 0.7;
					background: var(--bg);
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
