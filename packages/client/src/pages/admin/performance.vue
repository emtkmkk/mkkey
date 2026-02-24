<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
		/></template>
		<MkSpacer :content-max="900" :margin-min="16" :margin-max="32">
			<div class="controls">
				<MkSelect v-model="severity">
					<template #label>{{ i18n.ts._performanceIncidents.severity }}</template>
					<option value="all">{{ i18n.ts.all }}</option>
					<option value="warn">warn</option>
					<option value="critical">critical</option>
				</MkSelect>
				<MkButton @click="fetchIncidents">{{ i18n.ts.reload }}</MkButton>
			</div>

			<div class="_panel" style="padding: 12px">
				<div v-if="loading"><MkLoading /></div>
				<div v-else-if="incidents.length === 0" class="empty">
					{{ i18n.ts.noData }}
				</div>
				<div v-else class="list">
					<div v-for="item in incidents" :key="item.id" class="item">
						<div class="head">
							<span class="badge" :class="item.severity">{{ item.severity }}</span>
							<strong>{{ metricLabel(item.metric) }}</strong>
							<span>{{ item.value.toFixed(2) }}</span>
							<span class="date">{{ new Date(item.createdAt).toLocaleString() }}</span>
						</div>

						<!-- 診断メッセージ -->
						<div
							v-if="item.stats.diagnosis && item.stats.diagnosis.length > 0"
							class="section diagnosis"
						>
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.diagnosis }}</div>
							<div
								v-for="(d, i) in item.stats.diagnosis"
								:key="`${item.id}-diag-${i}`"
								class="diagnosisItem"
								:class="d.severity"
							>
								<div class="diagnosisMessage">{{ d.message }}</div>
								<div v-if="d.suggestion" class="diagnosisSuggestion">→ {{ d.suggestion }}</div>
							</div>
						</div>
						<div
							v-else-if="item.stats.diagnosis && Array.isArray(item.stats.diagnosis) && item.stats.diagnosis.length === 0"
							class="section diagnosis"
						>
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.diagnosis }}</div>
							<div class="noProblems">{{ i18n.ts._performanceIncidents.noProblemsDetected }}</div>
						</div>

						<!-- AI分析 -->
						<div class="section aiSection">
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.aiAnalysis }}</div>
							<div v-if="item.aiAnalysis" class="aiAnalysisContent">
								<pre class="aiAnalysisText">{{ item.aiAnalysis }}</pre>
								<div v-if="openaiApiKeySet" class="aiButtons">
									<MkButton
										:disabled="analyzingId === item.id"
										@click="runAnalysis(item.id)"
									>
										{{ analyzingId === item.id ? i18n.ts._performanceIncidents.analyzing : i18n.ts._performanceIncidents.reanalyzeWithAi }}
									</MkButton>
									<MkButton class="copyPromptBtn" @click="copyPrompt(item.id)">
										{{ i18n.ts._performanceIncidents.copyPrompt }}
									</MkButton>
								</div>
							</div>
							<div v-else-if="analyzingId === item.id" class="aiAnalyzing">
								<MkLoading /> {{ i18n.ts._performanceIncidents.analyzing }}
							</div>
							<div v-else-if="openaiApiKeySet" class="aiAnalyzePrompt">
								<div class="aiButtons">
									<MkButton :disabled="analyzingId != null" @click="runAnalysis(item.id)">
										{{ i18n.ts._performanceIncidents.analyzeWithAi }}
									</MkButton>
									<MkButton class="copyPromptBtn" @click="copyPrompt(item.id)">
										{{ i18n.ts._performanceIncidents.copyPrompt }}
									</MkButton>
								</div>
							</div>
							<div v-else class="aiKeyHint">
								{{ i18n.ts._performanceIncidents.openaiApiKeyNotSet }}
							</div>
						</div>

						<!-- 遅いエンドポイント -->
						<div
							v-if="item.stats.slowestEndpoints && item.stats.slowestEndpoints.length > 0"
							class="section"
						>
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.slowestEndpoints }}</div>
							<table class="slowestTable">
								<thead>
									<tr>
										<th>エンドポイント</th>
										<th>平均</th>
										<th>P95</th>
										<th>回数</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="(ep, ei) in item.stats.slowestEndpoints"
										:key="`${item.id}-ep-${ei}`"
									>
										<td>{{ ep.endpoint }}</td>
										<td>{{ ep.avgMs }}ms</td>
										<td>{{ ep.p95Ms }}ms</td>
										<td>{{ ep.count }}</td>
									</tr>
								</tbody>
							</table>
						</div>

						<!-- 直近の遅いAPIコール -->
						<div
							v-if="item.stats.recentSlowCalls && item.stats.recentSlowCalls.length > 0"
							class="section"
						>
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.recentSlowCalls }}</div>
							<div
								v-for="(c, ci) in item.stats.recentSlowCalls"
								:key="`${item.id}-slow-${ci}`"
								class="slowCallItem"
							>
								{{ c.endpoint }} {{ c.responseMs }}ms {{ formatAt(c.at) }}
							</div>
						</div>

						<!-- 連合の状態 -->
						<div v-if="item.stats.federationStats" class="section">
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.federationStatus }}</div>
							<div class="federationStats">
								<div>
									{{ i18n.ts._performanceIncidents.notRespondingServers }}:
									{{ item.stats.federationStats.notRespondingCount }}件
								</div>
								<div v-if="deliverDelayedTotal(item.stats.federationStats) > 0" class="delayedBreakdown">
									{{ i18n.ts._performanceIncidents.deliverDelayed }}:
									{{ i18n.ts._performanceIncidents.remoteError }}
									{{ item.stats.federationStats.deliverDelayed?.remote ?? 0 }}件 /
									{{ i18n.ts._performanceIncidents.localError }}
									{{ item.stats.federationStats.deliverDelayed?.local ?? 0 }}件 /
									{{ i18n.ts._performanceIncidents.unknownReason }}
									{{ item.stats.federationStats.deliverDelayed?.unknown ?? 0 }}件
								</div>
							</div>
						</div>

						<!-- DB接続プール -->
						<div v-if="item.stats.dbPoolStats" class="section">
							<div class="sectionTitle">{{ i18n.ts._performanceIncidents.dbPoolStatus }}</div>
							<div class="poolStats">
								合計: {{ item.stats.dbPoolStats.total }} / 使用中: {{ item.stats.dbPoolStats.active }} /
								アイドル: {{ item.stats.dbPoolStats.idle }}
								<span v-if="item.stats.dbPoolStats.idleInTransaction > 0">
									/ トランザクション中: {{ item.stats.dbPoolStats.idleInTransaction }}
								</span>
							</div>
						</div>

						<!-- 長時間実行クエリ -->
						<div
							v-if="item.stats.longRunningQueries && item.stats.longRunningQueries.length > 0"
							class="queries"
						>
							<div class="queriesTitle">{{ i18n.ts._performanceIncidents.longRunningQueries }}</div>
							<div
								v-for="query in item.stats.longRunningQueries"
								:key="`${item.id}-${query.pid}-${query.durationMs}`"
								class="queryItem"
							>
								<div class="queryMeta">
									PID {{ query.pid }} / {{ query.durationMs }}ms / {{ query.state }}
									<span v-if="query.waitEventType"> ({{ query.waitEventType }})</span>
								</div>
								<pre>{{ query.query }}</pre>
							</div>
						</div>

						<details>
							<summary>{{ i18n.ts._performanceIncidents.rawStatsSnapshot }}</summary>
							<pre>{{ JSON.stringify(item.stats, null, 2) }}</pre>
						</details>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted, computed } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkSelect from "@/components/form/select.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import copyToClipboard from "@/scripts/copy-to-clipboard";

type Incident = {
	id: string;
	createdAt: string;
	severity: "warn" | "critical";
	metric: string;
	value: number;
	stats: Record<string, any>;
	aiAnalysis?: string | null;
};

const incidents = ref<Incident[]>([]);
const severity = ref<"all" | "warn" | "critical">("all");
const loading = ref(false);
const analyzingId = ref<string | null>(null);
const openaiApiKeySet = ref(false);

const metricLabels: Record<string, string> = {
	cpuUsage: "CPU使用率",
	queuePressure: "キュー滞留",
	eventLoopLagMs: "イベントループ遅延",
	dbLatencyMs: "DB応答遅延",
	dbLongRunningQueryCount: "長時間実行クエリ",
	apiLatencyP95Ms: "API応答遅延（P95）",
};

function metricLabel(metric: string): string {
	return metricLabels[metric] ?? metric;
}

function formatAt(at: number): string {
	if (typeof at !== "number") return "";
	const d = new Date(at);
	return d.toLocaleTimeString();
}

function deliverDelayedTotal(fs: { deliverDelayed?: { remote?: number; local?: number; unknown?: number } }): number {
	const d = fs.deliverDelayed;
	if (!d) return 0;
	return (d.remote ?? 0) + (d.local ?? 0) + (d.unknown ?? 0);
}

const fetchIncidents = async () => {
	loading.value = true;
	try {
		incidents.value = await os.api("admin/performance-incidents", {
			limit: 100,
			severity: severity.value,
		});
	} finally {
		loading.value = false;
	}
};

async function fetchMetaForOpenAi() {
	const meta = await os.api("admin/meta");
	openaiApiKeySet.value = meta.openaiApiKey != null && meta.openaiApiKey !== "";
}

const runAnalysis = async (incidentId: string) => {
	analyzingId.value = incidentId;
	try {
		const res = await os.api("admin/analyze-performance-incident", { incidentId });
		if (res.error) {
			os.alert({
				type: "error",
				text: res.error.message,
			});
			return;
		}
		const item = incidents.value.find((i) => i.id === incidentId);
		if (item && res.aiAnalysis) {
			item.aiAnalysis = res.aiAnalysis;
		}
	} catch (e: any) {
		os.alert({
			type: "error",
			text: e?.message ?? "AI分析に失敗しました。",
		});
	} finally {
		analyzingId.value = null;
	}
};

const copyPrompt = async (incidentId: string) => {
	try {
		const res = await os.api("admin/get-performance-incident-prompt", { incidentId });
		copyToClipboard(res.prompt);
		os.success();
	} catch (e: any) {
		os.alert({
			type: "error",
			text: e?.message ?? "プロンプトの取得に失敗しました。",
		});
	}
};

watch(severity, fetchIncidents);
onMounted(() => {
	fetchIncidents();
	fetchMetaForOpenAi();
});

const headerActions = $computed(() => []);
const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.performanceIncidents,
	icon: "ph-activity ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.controls {
	display: flex;
	gap: 0.75rem;
	align-items: end;
	margin-bottom: 1rem;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.item {
	border: 1px solid var(--divider);
	border-radius: 0.5rem;
	padding: 0.75rem;

	> pre {
		margin: 0.5rem 0 0;
		white-space: pre-wrap;
		font-size: 0.75rem;
		color: var(--fgTransparentWeak);
	}
}

.head {
	display: flex;
	gap: 0.5rem;
	align-items: center;
	flex-wrap: wrap;

	.date {
		margin-left: auto;
		font-size: 0.85em;
		color: var(--fgTransparentWeak);
	}
}

.badge {
	padding: 0.1rem 0.4rem;
	border-radius: 999px;
	font-size: 0.75rem;
	font-weight: 700;
	text-transform: uppercase;

	&.warn {
		background: #d0a33633;
		color: #d8b145;
	}

	&.critical {
		background: #e2555533;
		color: #f16f6f;
	}
}

.section {
	margin-top: 0.75rem;
	padding: 0.5rem 0;
	border-top: 1px solid var(--divider);

	.sectionTitle {
		font-weight: 700;
		margin-bottom: 0.5rem;
		font-size: 0.9em;
	}
}

.diagnosisItem {
	margin-bottom: 0.5rem;
	padding: 0.35rem 0;

	&.critical {
		color: var(--error);
	}
	&.warn {
		color: var(--warn);
	}
	.diagnosisMessage {
		font-size: 0.9em;
	}
	.diagnosisSuggestion {
		font-size: 0.85em;
		opacity: 0.9;
		margin-top: 0.2rem;
	}
}

.noProblems {
	font-size: 0.9em;
	opacity: 0.8;
}

.aiSection {
	.aiButtons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.aiAnalysisContent {
		.aiAnalysisText {
			white-space: pre-wrap;
			font-size: 0.85rem;
			max-height: 20em;
			overflow: auto;
			background: var(--bg);
			padding: 0.5rem;
			border-radius: 0.4rem;
			margin-bottom: 0.5rem;
		}
	}
	.aiAnalyzing {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.aiKeyHint {
		font-size: 0.9em;
		opacity: 0.8;
	}
}

.slowestTable {
	width: 100%;
	font-size: 0.85rem;
	border-collapse: collapse;

	th,
	td {
		padding: 0.25rem 0.5rem;
		text-align: left;
		border-bottom: 1px solid var(--divider);
	}
	th {
		font-weight: 700;
	}
}

.slowCallItem {
	font-size: 0.85rem;
	font-family: var(--monospace);
	margin-bottom: 0.25rem;
}

.federationStats,
.poolStats {
	font-size: 0.9em;
	.delayedBreakdown {
		margin-top: 0.25rem;
		opacity: 0.9;
	}
}

.queries {
	margin-top: 0.5rem;
	padding: 0.5rem;
	border-radius: 0.5rem;
	background: var(--bg);

	.queriesTitle {
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.queryItem {
		padding: 0.5rem;
		border: 1px solid var(--divider);
		border-radius: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.queryMeta {
		font-size: 0.85em;
		margin-bottom: 0.25rem;
		color: var(--fgTransparentWeak);
	}

	pre {
		margin: 0;
		font-size: 0.75rem;
		white-space: pre-wrap;
	}
}

.empty {
	padding: 1rem;
	text-align: center;
	color: var(--fgTransparentWeak);
}
</style>
