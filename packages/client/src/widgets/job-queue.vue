<template>
	<div
		class="mkw-jobQueue _monospace"
		:class="{ _panel: !widgetProps.transparent }"
	>
		<div class="inbox">
			<div class="label">
				Inbox queue<i
					v-if="current.inbox.waiting > 0"
					class="ph-warning ph-bold ph-lg icon"
				></i>
			</div>
			<div class="values">
				<div>
					<div>Process</div>
					<div
						:class="{
							inc:
								current.inbox.activeSincePrevTick >
								prev.inbox.activeSincePrevTick,
							dec:
								current.inbox.activeSincePrevTick <
								prev.inbox.activeSincePrevTick,
						}"
					>
						{{ number(current.inbox.activeSincePrevTick) }}
					</div>
				</div>
				<div>
					<div>Active</div>
					<div
						:class="{
							inc: current.inbox.active > prev.inbox.active,
							dec: current.inbox.active < prev.inbox.active,
						}"
					>
						{{ number(current.inbox.active) }}
					</div>
				</div>
				<div>
					<div>Delayed</div>
					<div
						:class="{
							inc: current.inbox.delayed > prev.inbox.delayed,
							dec: current.inbox.delayed < prev.inbox.delayed,
						}"
					>
						{{ number(current.inbox.delayed) }}
						<div class="reasons">
							<div v-if="current.inbox.delayedByReason.remote > 0">
								R: {{ number(current.inbox.delayedByReason.remote) }}
							</div>
							<div v-if="current.inbox.delayedByReason.local > 0">
								L: {{ number(current.inbox.delayedByReason.local) }}
							</div>
							<div v-if="current.inbox.delayedByReason.unknown > 0">
								U: {{ number(current.inbox.delayedByReason.unknown) }}
							</div>
							<div v-if="current.inbox.delayedByReason.pending > 0">
								?: {{ number(current.inbox.delayedByReason.pending) }}
							</div>
						</div>
					</div>
				</div>
				<div>
					<div>Waiting</div>
					<div
						:class="{
							inc: current.inbox.waiting > prev.inbox.waiting,
							dec: current.inbox.waiting < prev.inbox.waiting,
						}"
					>
						{{ number(current.inbox.waiting) }}
					</div>
				</div>
			</div>
		</div>
		<div class="deliver">
			<div class="label">
				Deliver queue<i
					v-if="current.deliver.waiting > 0"
					class="ph-warning ph-bold ph-lg icon"
				></i>
			</div>
			<div class="values">
				<div>
					<div>Process</div>
					<div
						:class="{
							inc:
								current.deliver.activeSincePrevTick >
								prev.deliver.activeSincePrevTick,
							dec:
								current.deliver.activeSincePrevTick <
								prev.deliver.activeSincePrevTick,
						}"
					>
						{{ number(current.deliver.activeSincePrevTick) }}
					</div>
				</div>
				<div>
					<div>Active</div>
					<div
						:class="{
							inc: current.deliver.active > prev.deliver.active,
							dec: current.deliver.active < prev.deliver.active,
						}"
					>
						{{ number(current.deliver.active) }}
					</div>
				</div>
				<div>
					<div>Delayed</div>
					<div
						:class="{
							inc: current.deliver.delayed > prev.deliver.delayed,
							dec: current.deliver.delayed < prev.deliver.delayed,
						}"
					>
						{{ number(current.deliver.delayed) }}
						<div class="reasons">
							<div v-if="current.deliver.delayedByReason.remote > 0">
								R: {{ number(current.deliver.delayedByReason.remote) }}
							</div>
							<div v-if="current.deliver.delayedByReason.local > 0">
								L: {{ number(current.deliver.delayedByReason.local) }}
							</div>
							<div v-if="current.deliver.delayedByReason.unknown > 0">
								U: {{ number(current.deliver.delayedByReason.unknown) }}
							</div>
							<div v-if="current.deliver.delayedByReason.pending > 0">
								?: {{ number(current.deliver.delayedByReason.pending) }}
							</div>
						</div>
					</div>
				</div>
				<div>
					<div>Waiting</div>
					<div
						:class="{
							inc: current.deliver.waiting > prev.deliver.waiting,
							dec: current.deliver.waiting < prev.deliver.waiting,
						}"
					>
						{{ number(current.deliver.waiting) }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onUnmounted, reactive } from "vue";
import { useWidgetPropsManager } from "./widget";
import type { Widget, WidgetComponentExpose } from "./widget";
import type { GetFormResultType } from "@/scripts/form";
import { stream } from "@/stream";
import number from "@/filters/number";
import * as sound from "@/scripts/sound";
import { deepClone } from "@/scripts/clone";

const name = "jobQueue";

const widgetPropsDef = {
	transparent: {
		type: "boolean" as const,
		default: false,
	},
	sound: {
		type: "boolean" as const,
		default: false,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

type QueueDomain = "inbox" | "deliver";

type QueueStats = Record<
	QueueDomain,
	{
		activeSincePrevTick: number;
		active: number;
		waiting: number;
		delayed: number;
		delayedByReason: {
			remote: number;
			local: number;
			unknown: number;
			pending: number;
		};
	}
>;

// 現時点ではvueの制限によりimportしたtypeをジェネリックに渡せない
//const props = defineProps<WidgetComponentProps<WidgetProps>>();
//const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();

const { widgetProps, configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit
);

const connection = stream.useChannel("queueStats");
const current = reactive({
	inbox: {
		activeSincePrevTick: 0,
		active: 0,
		waiting: 0,
		delayed: 0,
		delayedByReason: {
			remote: 0,
			local: 0,
			unknown: 0,
			pending: 0,
		},
	},
	deliver: {
		activeSincePrevTick: 0,
		active: 0,
		waiting: 0,
		delayed: 0,
		delayedByReason: {
			remote: 0,
			local: 0,
			unknown: 0,
			pending: 0,
		},
	},
});
const prev = reactive({} as typeof current);
let jammedAudioBuffer: AudioBuffer | null = $ref(null);
let jammedSoundNodePlaying: boolean = $ref(false);

sound
	.loadAudio("syuilo/queue-jammed")
	.then((buf) => (jammedAudioBuffer = buf ?? null));

const queueDomains: QueueDomain[] = ["inbox", "deliver"];

for (const domain of queueDomains) {
	prev[domain] = deepClone(current[domain]);
}

const onStats = (stats: QueueStats) => {
	for (const domain of queueDomains) {
		prev[domain] = deepClone(current[domain]);
		current[domain].activeSincePrevTick = stats[domain].activeSincePrevTick;
		current[domain].active = stats[domain].active;
		current[domain].waiting = stats[domain].waiting;
		current[domain].delayed = stats[domain].delayed;
		const delayedByReason = normalizeDelayedByReason(
			stats[domain].delayed,
			stats[domain].delayedByReason,
		);
		current[domain].delayedByReason.remote = delayedByReason.remote;
		current[domain].delayedByReason.local = delayedByReason.local;
		current[domain].delayedByReason.unknown = delayedByReason.unknown;
		current[domain].delayedByReason.pending = delayedByReason.pending;

		if (
			current[domain].waiting > 0 &&
			widgetProps.sound &&
			jammedAudioBuffer &&
			!jammedSoundNodePlaying
		) {
			const soundNode = sound.createSourceNode(jammedAudioBuffer, 1);
			if (soundNode) {
				jammedSoundNodePlaying = true;
				soundNode.onended = () => (jammedSoundNodePlaying = false);
				soundNode.start();
			}
		}
	}
};

const onStatsLog = (statsLog: QueueStats[]) => {
	for (const stats of [...statsLog].reverse()) {
		onStats(stats);
	}
};

connection.on("stats", onStats);
connection.on("statsLog", onStatsLog);

connection.send("requestLog", {
	id: Math.random().toString().substr(2, 8),
	length: 1,
});

onUnmounted(() => {
	connection.off("stats", onStats);
	connection.off("statsLog", onStatsLog);
	connection.dispose();
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});

function normalizeDelayedByReason(
	delayed: number,
	delayedByReason: QueueStats[QueueDomain]["delayedByReason"],
): QueueStats[QueueDomain]["delayedByReason"] {
	const remote = delayedByReason.remote;
	const local = delayedByReason.local;
	const unknown = delayedByReason.unknown;
	const pending = delayedByReason.pending;
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

<style lang="scss" scoped>
@keyframes warnBlink {
	0% {
		opacity: 1;
	}
	50% {
		opacity: 0;
	}
}

.mkw-jobQueue {
	font-size: 0.9em;

	> div {
		padding: 1rem;

		&:not(:first-child) {
			border-top: solid 0.03125rem var(--divider);
		}

		> .label {
			display: flex;

			> .icon {
				color: var(--warn);
				margin-left: auto;
				animation: warnBlink 1s infinite;
			}
		}

		> .values {
			display: flex;

			> div {
				flex: 1;

				> div:first-child {
					opacity: 0.7;
				}

				> div:last-child {
					&.inc {
						color: var(--warn);
					}

					&.dec {
						color: var(--success);
					}

					> .reasons {
						font-size: 0.75em;
						opacity: 0.8;
						line-height: 1.3;
					}
				}
			}
		}
	}
}
</style>
