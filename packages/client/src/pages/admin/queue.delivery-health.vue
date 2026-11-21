<template>
	<div class="dlvhlth">
		<MkLoading v-if="overview == null && !failed" />
		<div v-else-if="failed" class="_panel empty">
			読み込めませんでした。
		</div>
		<template v-else-if="overview">
			<!-- 概要 -->
			<div class="cards">
				<div
					v-for="card in cards"
					:key="card.label"
					v-tooltip="card.tooltip"
					class="card _panel"
				>
					<div class="value" :class="card.tone">{{ card.value }}</div>
					<div class="label">{{ card.label }}</div>
				</div>
			</div>
			<div class="note">
				<template v-if="overview.breaker">
					一時停止の情報は queue ワーカーから
					<MkTime :time="overview.breaker.updatedAt" /> に取得。
					「通信せずに返した」「一時停止の回数」はワーカーの起動（<MkTime
						:time="overview.breaker.startedAt"
					/>）以降、直近 24 時間の分です。
				</template>
				<template v-else>
					queue ワーカーから一時停止の情報が届いていません（まだ配送が無いか、ワーカーが止まっています）。
				</template>
			</div>

			<!-- いま問題のあるサーバ -->
			<FormSection>
				<template #label>いま問題のあるサーバ</template>
				<div v-if="overview.hosts.length === 0" class="empty">
					ありません。
				</div>
				<div v-else class="hosts">
					<div v-for="h in overview.hosts" :key="h.host" class="host">
						<div class="head">
							<MkA
								class="name _link"
								:to="`/instance-info/${h.host}`"
								>{{ h.host }}</MkA
							>
							<span class="badge" :class="badgeTone(h)">{{
								stateLabel(h)
							}}</span>
						</div>
						<div class="facts">
							<span v-if="h.since"
								>いつから <MkTime :time="h.since"
							/></span>
							<span v-if="h.lastError"
								>最後のエラー {{ h.lastError }}</span
							>
							<span v-if="h.nextCheckAt"
								>次の確認 <MkTime :time="h.nextCheckAt"
							/></span>
							<span v-if="h.delayedJobs > 0"
								>遅延中 {{ number(h.delayedJobs) }} 件</span
							>
							<span v-if="h.succeeded24h + h.failed24h > 0"
								>24 時間の失敗率
								{{ failureRate(h) }}（{{
									number(h.failed24h)
								}}
								/
								{{
									number(h.succeeded24h + h.failed24h)
								}}）</span
							>
						</div>
					</div>
				</div>
			</FormSection>
		</template>

		<!-- 最近の変化 -->
		<FormSection>
			<template #label>最近の変化</template>
			<MkInstanceHealthLogs />
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ジョブキュー画面の「配送先」タブ。配送先サーバの状態を一通り見られるようにする。
 *
 * @remarks
 * - 上から「概要（数字）」「いま問題のあるサーバ」「最近の変化（全サーバの履歴）」を並べる。
 * - データは `admin/federation/health-overview`（概要と一覧）と `admin/federation/health-logs`（履歴）から取る。
 *   概要は 30 秒ごとに取り直す（遅延中のジョブを全件数えるので、あまり頻繁にはしない）。
 * - 停止・解除の操作はサーバ情報ページで行う（操作の場所を 1 か所にする）。ここは見るだけ。
 *
 * @see plans/instance-delivery-health-plan.md 設計方針 7
 * @internal
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import FormSection from "@/components/form/section.vue";
import MkInstanceHealthLogs from "@/components/MkInstanceHealthLogs.vue";
import number from "@/filters/number";
import * as os from "@/os";
import {
	suspensionStateLabels,
	type SuspensionState,
} from "@/scripts/instance-health";

/** 「問題のあるサーバ」1 行（API の応答） */
type ProblemHost = {
	host: string;
	suspensionState: SuspensionState | null;
	circuitOpen: boolean;
	since: string | null;
	lastError: string | null;
	nextCheckAt: string | null;
	delayedJobs: number;
	succeeded24h: number;
	failed24h: number;
};

/** API の応答 */
type Overview = {
	counts: Record<string, number>;
	breaker: {
		updatedAt: string;
		startedAt: string;
		skipped24h: number;
		opened24h: number;
		adaptiveDelayMs: number;
	} | null;
	hosts: ProblemHost[];
};

/** 取り直す間隔（ミリ秒） */
const REFRESH_INTERVAL_MS = 30 * 1000;

const overview = ref<Overview | null>(null);
const failed = ref(false);
let timer: number | null = null;

/** 概要を取り直す */
async function fetchOverview() {
	try {
		overview.value = (await os.api(
			"admin/federation/health-overview",
		)) as Overview;
		failed.value = false;
	} catch {
		failed.value = overview.value == null;
	}
}

/** 数字のカード */
const cards = computed(() => {
	const o = overview.value;
	if (!o) return [];
	const c = o.counts;
	return [
		{
			label: "一時停止中",
			value: number(c.circuitOpen ?? 0),
			tone: (c.circuitOpen ?? 0) > 0 ? "warn" : "",
			tooltip:
				"落ちているサーバへの配送を、数分〜1 時間ほど試さずに待たせています（サーキットブレーカー）。",
		},
		{
			label: "不通",
			value: number(c.notResponding ?? 0),
			tone: "",
			tooltip: "直近の配送で接続できなかったサーバ。3 日続くと自動停止します。",
		},
		{
			label: suspensionStateLabels.autoSuspendedForNotResponding,
			value: number(c.autoSuspendedForNotResponding ?? 0),
			tone: "",
			tooltip: "不通が 3 日続いたため停止中。定期的に生存を確認しています。",
		},
		{
			label: suspensionStateLabels.goneSuspended,
			value: number(c.goneSuspended ?? 0),
			tone: "",
			tooltip: "サーバ自体が 410（閉鎖）を返したため停止中。",
		},
		{
			label: suspensionStateLabels.manuallySuspended,
			value: number(c.manuallySuspended ?? 0),
			tone: "",
			tooltip: "管理者が停止中。",
		},
		{
			label: "通信せずに返した配送",
			value: o.breaker ? number(o.breaker.skipped24h) : "-",
			tone: "",
			tooltip:
				"一時停止中のサーバ宛てで、通信せずに後回しにした件数（直近 24 時間）。処理枠と待ち時間の節約分です。",
		},
		{
			label: "一時停止した回数",
			value: o.breaker ? number(o.breaker.opened24h) : "-",
			tone: "",
			tooltip: "直近 24 時間に一時停止が始まった回数。",
		},
		{
			label: "配送 1 件ごとの待ち",
			value: o.breaker ? `${number(o.breaker.adaptiveDelayMs)} ms` : "-",
			tone: (o.breaker?.adaptiveDelayMs ?? 0) > 0 ? "warn" : "",
			tooltip:
				"キューが混んでいるときに、全サーバへの配送に入れている待ち時間（適応スロットル）。",
		},
	];
});

/**
 * サーバの状態の表示名。
 *
 * @param h - サーバ
 * @returns 表示名
 */
function stateLabel(h: ProblemHost): string {
	if (h.suspensionState && h.suspensionState !== "none") {
		return suspensionStateLabels[h.suspensionState];
	}
	if (h.circuitOpen) return "一時停止中";
	if (h.since) return "不通";
	return "遅延あり";
}

/**
 * 状態のバッジの色。
 *
 * @param h - サーバ
 * @returns クラス名
 */
function badgeTone(h: ProblemHost): string {
	if (h.suspensionState && h.suspensionState !== "none") return "stopped";
	if (h.circuitOpen || h.since) return "warn";
	return "";
}

/**
 * 直近 24 時間の失敗率。
 *
 * @param h - サーバ
 * @returns 「62%」のような文字列
 */
function failureRate(h: ProblemHost): string {
	const total = h.succeeded24h + h.failed24h;
	return `${Math.round((h.failed24h / total) * 100)}%`;
}

onMounted(() => {
	fetchOverview();
	timer = window.setInterval(fetchOverview, REFRESH_INTERVAL_MS);
});

onUnmounted(() => {
	if (timer != null) window.clearInterval(timer);
});
</script>

<style lang="scss" scoped>
.dlvhlth {
	> .cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.75rem;

		> .card {
			padding: 0.75rem 1rem;

			> .value {
				font-size: 1.5em;
				font-weight: bold;

				&.warn {
					color: var(--warn);
				}
			}

			> .label {
				font-size: 0.85em;
				opacity: 0.7;
			}
		}
	}

	> .note {
		margin: 0.75rem 0 0;
		font-size: 0.85em;
		opacity: 0.7;
	}

	.empty {
		padding: 1rem;
		opacity: 0.6;
	}

	.hosts {
		> .host {
			padding: 0.75rem 1rem;
			background: var(--panel);
			border-radius: var(--radius);

			&:not(:last-child) {
				margin-bottom: 0.5rem;
			}

			> .head {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;

				> .name {
					font-weight: bold;
					word-break: break-all;
				}

				> .badge {
					padding: 0 0.5rem;
					border-radius: 999px;
					font-size: 0.8em;
					border: solid 1px var(--divider);

					&.warn {
						color: var(--warn);
						border-color: var(--warn);
					}

					&.stopped {
						color: var(--error);
						border-color: var(--error);
					}
				}
			}

			> .facts {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem 1rem;
				margin-top: 0.25rem;
				font-size: 0.85em;
				opacity: 0.85;
				word-break: break-word;
			}
		}
	}
}
</style>
