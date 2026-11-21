<template>
	<div class="taeiyria">
		<div class="query">
			<MkInput v-model="host" :debounce="true" class="">
				<template #prefix
					><i class="ph-magnifying-glass ph-bold ph-lg"></i
				></template>
				<template #label>{{ i18n.ts.host }}</template>
			</MkInput>
			<FormSplit style="margin-top: var(--margin)">
				<MkSelect v-model="state">
					<template #label>{{ i18n.ts.state }}</template>
					<option value="all">{{ i18n.ts.all }}</option>
					<option value="federating">{{ i18n.ts.federating }}</option>
					<option value="subscribing">
						{{ i18n.ts.subscribing }}
					</option>
					<option value="publishing">{{ i18n.ts.publishing }}</option>
					<option value="suspended">{{ i18n.ts.suspended }}</option>
					<option value="autoSuspendedForNotResponding">
						{{ i18n.ts.suspended }}（{{
							suspensionStateLabels.autoSuspendedForNotResponding
						}}）
					</option>
					<option value="goneSuspended">
						{{ i18n.ts.suspended }}（{{
							suspensionStateLabels.goneSuspended
						}}）
					</option>
					<option value="manuallySuspended">
						{{ i18n.ts.suspended }}（{{
							suspensionStateLabels.manuallySuspended
						}}）
					</option>
					<option value="blocked">{{ i18n.ts.blocked }}</option>
					<option value="silenced">{{ i18n.ts.silenced }}</option>
					<option value="notResponding">
						{{ i18n.ts.notResponding }}
					</option>
				</MkSelect>
				<MkSelect v-model="sort">
					<template #label>{{ i18n.ts.sort }}</template>
					<option value="+pubSub">
						{{ i18n.ts.pubSub }} ({{ i18n.ts.descendingOrder }})
					</option>
					<option value="-pubSub">
						{{ i18n.ts.pubSub }} ({{ i18n.ts.ascendingOrder }})
					</option>
					<option value="+notes">
						{{ i18n.ts.notes }} ({{ i18n.ts.descendingOrder }})
					</option>
					<option value="-notes">
						{{ i18n.ts.notes }} ({{ i18n.ts.ascendingOrder }})
					</option>
					<option value="+users">
						{{ i18n.ts.users }} ({{ i18n.ts.descendingOrder }})
					</option>
					<option value="-users">
						{{ i18n.ts.users }} ({{ i18n.ts.ascendingOrder }})
					</option>
					<option value="+following">
						{{ i18n.ts.following }} ({{ i18n.ts.descendingOrder }})
					</option>
					<option value="-following">
						{{ i18n.ts.following }} ({{ i18n.ts.ascendingOrder }})
					</option>
					<option value="+followers">
						{{ i18n.ts.followers }} ({{ i18n.ts.descendingOrder }})
					</option>
					<option value="-followers">
						{{ i18n.ts.followers }} ({{ i18n.ts.ascendingOrder }})
					</option>
					<option value="+caughtAt">
						{{ i18n.ts.registeredAt }} ({{
							i18n.ts.descendingOrder
						}})
					</option>
					<option value="-caughtAt">
						{{ i18n.ts.registeredAt }} ({{
							i18n.ts.ascendingOrder
						}})
					</option>
					<option value="+lastCommunicatedAt">
						{{ i18n.ts.lastCommunication }} ({{
							i18n.ts.descendingOrder
						}})
					</option>
					<option value="-lastCommunicatedAt">
						{{ i18n.ts.lastCommunication }} ({{
							i18n.ts.ascendingOrder
						}})
					</option>
				</MkSelect>
			</FormSplit>
		</div>

		<MkPagination
			v-slot="{ items }"
			ref="instances"
			:key="host + state"
			:pagination="pagination"
		>
			<div class="dqokceoi">
				<MkA
					v-for="instance in items"
					:key="instance.id"
					v-tooltip.mfm="
						`Last communicated: ${new Date(
							instance.lastCommunicatedAt
						).toLocaleString()}\nStatus: ${getStatus(instance)}`
					"
					class="instance"
					:to="`/instance-info/${instance.host}`"
				>
					<MkInstanceCardMini :instance="instance" />
				</MkA>
			</div>
		</MkPagination>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 連合先サーバの一覧（ホスト・状態で絞り込み、並べ替え）。サーバ一覧ページとコントロールパネルの「連合」で使う。
 *
 * @remarks
 * 配信の停止は、種類（自動・閉鎖・手動）でも絞り込める（API の `suspensionState`）。
 *
 * @internal
 */
import { computed } from "vue";
import MkInput from "@/components/form/input.vue";
import MkSelect from "@/components/form/select.vue";
import MkPagination from "@/components/MkPagination.vue";
import MkInstanceCardMini from "@/components/MkInstanceCardMini.vue";
import FormSplit from "@/components/form/split.vue";
import { i18n } from "@/i18n";
import { suspensionStateLabels } from "@/scripts/instance-health";

let host = $ref("");
let state = $ref("federating");
let sort = $ref("+pubSub");
const pagination = {
	endpoint: "federation/instances" as const,
	limit: 10,
	offsetMode: true,
	params: computed(() => ({
		sort: sort,
		host: host !== "" ? host : null,
		...(state === "federating"
			? { federating: true }
			: state === "subscribing"
			? { subscribing: true }
			: state === "publishing"
			? { publishing: true }
			: state === "suspended"
			? { suspended: true }
			: state === "autoSuspendedForNotResponding" ||
			  state === "goneSuspended" ||
			  state === "manuallySuspended"
			? { suspensionState: state }
			: state === "blocked"
			? { blocked: true }
			: state === "silenced"
			? { silenced: true }
			: state === "notResponding"
			? { notResponding: true }
			: {}),
	})),
};

/**
 * ツールチップに出す状態。
 *
 * @param instance - サーバ
 * @returns 状態の表示名
 */
function getStatus(instance) {
	if (instance.isSuspended) {
		const label = suspensionStateLabels[instance.suspensionState];
		return label ? `Suspended（${label}）` : "Suspended";
	}
	if (instance.isBlocked) return "Blocked";
	if (instance.isSilenced) return "Silenced";
	if (instance.isNotResponding) return "Error";
	return "Alive";
}
</script>

<style lang="scss" scoped>
.taeiyria {
	> .query {
		background: var(--bg);
		margin-bottom: 1rem;
	}
}

.dqokceoi {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(16.875rem, 1fr));
	grid-gap: 0.75rem;

	> .instance:hover {
		text-decoration: none;
	}
}
</style>
