<template>
	<div :class="$style.root">
		<div class="_table status">
			<div class="_row">
				<div class="_cell" style="text-align: center">
					<div class="_label">Process</div>
					{{ number(activeSincePrevTick) }}
				</div>
				<div class="_cell" style="text-align: center">
					<div class="_label">Active</div>
					{{ number(active) }}
				</div>
				<div class="_cell" style="text-align: center">
					<div class="_label">Waiting</div>
					{{ number(waiting) }}
				</div>
				<div class="_cell" style="text-align: center">
					<div class="_label">Delayed</div>
					{{ number(delayed) }}
					<div v-if="delayedRemote > 0" class="reason">R: {{ number(delayedRemote) }}</div>
					<div v-if="delayedLocal > 0" class="reason">L: {{ number(delayedLocal) }}</div>
					<div v-if="delayedUnknown > 0" class="reason">U: {{ number(delayedUnknown) }}</div>
					<div v-if="delayedPending > 0" class="reason">?: {{ number(delayedPending) }}</div>
				</div>
			</div>
		</div>
		<div class="charts">
			<div class="chart">
				<div class="title">Process</div>
				<XChart ref="chartProcess" type="process" />
			</div>
			<div class="chart">
				<div class="title">Active</div>
				<XChart ref="chartActive" type="active" />
			</div>
			<div class="chart">
				<div class="title">Delayed</div>
				<XChart ref="chartDelayed" type="delayed" />
			</div>
			<div class="chart">
				<div class="title">Waiting</div>
				<XChart ref="chartWaiting" type="waiting" />
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { markRaw, onMounted, onUnmounted, ref } from "vue";
import XChart from "./overview.queue.chart.vue";
import number from "@/filters/number";
import { stream } from "@/stream";

const connection = markRaw(stream.useChannel("queueStats"));

const activeSincePrevTick = ref(0);
const active = ref(0);
const delayed = ref(0);
const delayedRemote = ref(0);
const delayedLocal = ref(0);
const delayedUnknown = ref(0);
const delayedPending = ref(0);
const waiting = ref(0);
let chartProcess = $shallowRef<InstanceType<typeof XChart>>();
let chartActive = $shallowRef<InstanceType<typeof XChart>>();
let chartDelayed = $shallowRef<InstanceType<typeof XChart>>();
let chartWaiting = $shallowRef<InstanceType<typeof XChart>>();

const props = defineProps<{
	domain: string;
}>();

type QueueStats = Record<
	string,
	{
		activeSincePrevTick: number;
		active: number;
		delayed: number;
		waiting: number;
		delayedByReason?: {
			remote: number;
			local: number;
			unknown: number;
			pending: number;
		};
	}
>;

const onStats = (stats: QueueStats) => {
	const delayedByReason = normalizeDelayedByReason(
		stats[props.domain].delayed,
		stats[props.domain].delayedByReason,
	);

	activeSincePrevTick.value = stats[props.domain].activeSincePrevTick;
	active.value = stats[props.domain].active;
	delayed.value = stats[props.domain].delayed;
	delayedRemote.value = delayedByReason.remote;
	delayedLocal.value = delayedByReason.local;
	delayedUnknown.value = delayedByReason.unknown;
	delayedPending.value = delayedByReason.pending;
	waiting.value = stats[props.domain].waiting;

	chartProcess.pushData(stats[props.domain].activeSincePrevTick);
	chartActive.pushData(stats[props.domain].active);
	chartDelayed.pushData(stats[props.domain].delayed);
	chartWaiting.pushData(stats[props.domain].waiting);
};

const onStatsLog = (statsLog: QueueStats[]) => {
	const dataProcess = [];
	const dataActive = [];
	const dataDelayed = [];
	const dataWaiting = [];

	for (const stats of [...statsLog].reverse()) {
		dataProcess.push(stats[props.domain].activeSincePrevTick);
		dataActive.push(stats[props.domain].active);
		dataDelayed.push(stats[props.domain].delayed);
		dataWaiting.push(stats[props.domain].waiting);
	}

	chartProcess.setData(dataProcess);
	chartActive.setData(dataActive);
	chartDelayed.setData(dataDelayed);
	chartWaiting.setData(dataWaiting);
};

onMounted(() => {
	connection.on("stats", onStats);
	connection.on("statsLog", onStatsLog);
	connection.send("requestLog", {
		id: Math.random().toString().substr(2, 8),
		length: 100,
	});
});

onUnmounted(() => {
	connection.off("stats", onStats);
	connection.off("statsLog", onStatsLog);
	connection.dispose();
});

function normalizeDelayedByReason(
	delayed: number,
	delayedByReason?: {
		remote: number;
		local: number;
		unknown: number;
		pending: number;
	},
): {
	remote: number;
	local: number;
	unknown: number;
	pending: number;
} {
	const remote = delayedByReason?.remote ?? 0;
	const local = delayedByReason?.local ?? 0;
	const unknown = delayedByReason?.unknown ?? 0;
	const pending = delayedByReason?.pending ?? 0;
	const total = remote + local + unknown + pending;

	if (delayed > 0 && total === 0) {
		return {
			remote,
			local,
			unknown: delayed,
			pending: 0,
		};
	}

	if (total > delayed) {
		return {
			remote,
			local,
			unknown: Math.max(0, delayed - remote - local - pending),
			pending,
		};
	}

	return {
		remote,
		local,
		unknown,
		pending,
	};
}
</script>

<style lang="scss" module>
.root {
	> :global(.status) {
		padding: 0 0 1rem 0;
	}

	:global(.reason) {
		font-size: 0.8em;
		opacity: 0.8;
	}

	> :global(.charts) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;

		> :global(.chart) {
			min-width: 0;
			padding: 1rem;
			background: var(--panel);
			border-radius: var(--radius);

			> :global(.title) {
				font-size: 0.85em;
			}
		}
	}
}
</style>
