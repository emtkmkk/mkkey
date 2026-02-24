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
					<template #label>{{ i18n.ts.severity }}</template>
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
							<strong>{{ item.metric }}</strong>
							<span>{{ item.value.toFixed(2) }}</span>
							<span class="date">{{ new Date(item.createdAt).toLocaleString() }}</span>
						</div>

						<div
							v-if="item.stats.longRunningQueries && item.stats.longRunningQueries.length > 0"
							class="queries"
						>
							<div class="queriesTitle">Long-running queries</div>
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
							<summary>Raw stats snapshot</summary>
							<pre>{{ JSON.stringify(item.stats, null, 2) }}</pre>
						</details>
					</div>
				</div>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkSelect from "@/components/form/select.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

type Incident = {
	id: string;
	createdAt: string;
	severity: "warn" | "critical";
	metric: string;
	value: number;
	stats: Record<string, any>;
};

const incidents = ref<Incident[]>([]);
const severity = ref<"all" | "warn" | "critical">("all");
const loading = ref(false);

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

watch(severity, fetchIncidents);
onMounted(fetchIncidents);

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
