<template>
	<div class="ihlogs">
		<div v-if="!host" class="filters">
			<MkInput
				v-model="hostFilter"
				class="filter"
				:debounce="true"
				type="search"
			>
				<template #prefix
					><i class="ph-magnifying-glass ph-bold ph-lg"></i
				></template>
				<template #label>ホスト</template>
			</MkInput>
			<MkSelect v-model="eventFilter" class="filter">
				<template #label>できごと</template>
				<option value="all">すべて</option>
				<option value="suspension">停止・解除（一時停止を除く）</option>
				<option value="circuit">一時停止・その解除</option>
				<option value="manual">手動操作</option>
			</MkSelect>
		</div>
		<MkPagination v-slot="{ items }" :pagination="pagination">
			<div class="list">
				<div v-for="log in items" :key="log.id" class="item">
					<div class="head">
						<span
							class="event"
							:class="{ worse: isWorseningEvent(log.event) }"
							>{{ healthEventLabels[log.event] ?? log.event }}</span
						>
						<MkA
							v-if="!host"
							class="host _link"
							:to="`/instance-info/${log.host}`"
							>{{ log.host }}</MkA
						>
						<span
							v-if="log.fromState && log.toState"
							class="states"
							>{{ suspensionStateLabels[log.fromState] }} →
							{{ suspensionStateLabels[log.toState] }}</span
						>
						<MkTime class="time" :time="log.createdAt" />
					</div>
					<div class="desc">{{ describeHealthLog(log) }}</div>
				</div>
			</div>
		</MkPagination>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 配送先サーバの状態の変化の履歴（`admin/federation/health-logs`）を新しい順に並べる部品。
 *
 * @remarks
 * - `host` を渡すとそのサーバだけ（サーバ情報ページの「履歴」タブ）。渡さないと全サーバで、ホストとできごとで絞り込める
 *   （ジョブキュー画面の「配送先」タブ）。
 * - モデレーター以上だけが使う（API が requireModerator）。
 *
 * @internal
 */
import { computed, ref } from "vue";
import MkPagination from "@/components/MkPagination.vue";
import MkInput from "@/components/form/input.vue";
import MkSelect from "@/components/form/select.vue";
import {
	describeHealthLog,
	healthEventLabels,
	isWorseningEvent,
	suspensionStateLabels,
} from "@/scripts/instance-health";

const props = defineProps<{
	/** 対象のホスト。省略すると全サーバ */
	host?: string;
}>();

/** ホストの絞り込み（全サーバのとき） */
const hostFilter = ref("");

/** できごとの絞り込み（全サーバのとき） */
const eventFilter = ref<"all" | "suspension" | "circuit" | "manual">("all");

/** 絞り込みの選択肢 → API に渡すできごとの一覧 */
const eventGroups: Record<string, string[] | null> = {
	all: null,
	suspension: [
		"autoSuspended",
		"gone",
		"unsuspendedByProbe",
		"unsuspendedByInbox",
		"manualSuspended",
		"manualUnsuspended",
		"migrated",
	],
	circuit: ["circuitOpened", "circuitClosed"],
	manual: ["manualSuspended", "manualUnsuspended"],
};

const pagination = {
	endpoint: "admin/federation/health-logs" as const,
	limit: 30,
	params: computed(() => ({
		host: props.host ?? (hostFilter.value.trim() || null),
		events: eventGroups[eventFilter.value],
	})),
};
</script>

<style lang="scss" scoped>
.ihlogs {
	> .filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;

		> .filter {
			flex: 1;
			min-width: 10rem;
			margin: 0;
		}
	}

	.list {
		> .item {
			padding: 0.75rem 1rem;
			background: var(--panel);
			border-radius: var(--radius);
			font-size: 0.9em;

			&:not(:last-child) {
				margin-bottom: 0.5rem;
			}

			> .head {
				display: flex;
				flex-wrap: wrap;
				align-items: baseline;
				gap: 0.25rem 0.75rem;

				> .event {
					font-weight: bold;
					color: var(--success);

					&.worse {
						color: var(--warn);
					}
				}

				> .host {
					word-break: break-all;
				}

				> .states {
					opacity: 0.7;
				}

				> .time {
					margin-left: auto;
					opacity: 0.7;
				}
			}

			> .desc {
				margin-top: 0.25rem;
				opacity: 0.85;
				word-break: break-word;
			}
		}
	}
}
</style>
