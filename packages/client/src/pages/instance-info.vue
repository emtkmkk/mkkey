<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				v-model:tab="tab"
				:actions="headerActions"
				:tabs="headerTabs"
		/></template>
		<MkSpacer
			v-if="instance"
			:content-max="600"
			:margin-min="16"
			:margin-max="32"
		>
			<swiper
				:touch-angle="$store.state.swipeTouchAngle"
				:threshold="$store.state.swipeThreshold"
				:centeredSlides="$store.state.swipeCenteredSlides"
				:modules="[Virtual]"
				:space-between="20"
				:virtual="true"
				:allow-touch-move="!!defaultStore.state.swipeOnDesktop"
				@swiper="setSwiperRef"
				@slide-change="onSlideChange"
			>
				<swiper-slide>
					<div class="_formRoot">
						<div class="fnfelxur">
							<img
								:src="faviconUrl"
								title="favicon"
								alt="favicon"
								class="icon"
							/>
							<img
								:src="iconUrl"
								title="icon"
								alt="icon"
								class="icon"
							/>
							<span class="name">{{
								instance.name || `(${i18n.ts.unknown})`
							}}</span>
						</div>
						<MkKeyValue :copy="host" oneline style="margin: 1em 0">
							<template #key>Host</template>
							<template #value
								><span class="_monospace"
									><MkLink :url="`https://${host}`">{{
										host
									}}</MkLink></span
								></template
							>
						</MkKeyValue>
						<MkKeyValue oneline style="margin: 1em 0">
							<template #key>{{ i18n.ts.software }}</template>
							<template #value
								><span class="_monospace"
									>{{
										instance.softwareName ||
										`(${i18n.ts.unknown})`
									}}
									/
									{{
										instance.softwareVersion ||
										`(${i18n.ts.unknown})`
									}}</span
								></template
							>
						</MkKeyValue>
						<MkKeyValue oneline style="margin: 1em 0">
							<template #key>{{
								i18n.ts.administrator
							}}</template>
							<template #value
								>{{
									instance.maintainerName ||
									`(${i18n.ts.unknown})`
								}}
								({{
									instance.maintainerEmail ||
									`(${i18n.ts.unknown})`
								}})</template
							>
						</MkKeyValue>
						<MkKeyValue>
							<template #key>{{ i18n.ts.description }}</template>
							<template #value>{{
								instance.description
							}}</template>
						</MkKeyValue>

						<FormSection v-if="iAmAdmin">
							<template #label>Moderation</template>
							<FormSuspense :p="init">
								<div class="_formBlock delivery-state">
									<MkKeyValue oneline>
										<template #key>{{
											i18n.ts.stopActivityDelivery
										}}</template>
										<template #value
											><span
												v-tooltip="
													suspensionStateDescriptions[
														instance.suspensionState
													]
												"
												:class="{
													stopped:
														instance.suspensionState !==
														'none',
												}"
												>{{
													suspensionStateLabels[
														instance.suspensionState
													]
												}}</span
											><template
												v-if="instance.suspendedAt"
											>
												（<MkTime
													:time="instance.suspendedAt"
												/>から）</template
											></template
										>
									</MkKeyValue>
									<MkKeyValue
										v-if="instance.notRespondingSince"
										oneline
									>
										<template #key>不通</template>
										<template #value
											><MkTime
												:time="instance.notRespondingSince"
											/>から</template
										>
									</MkKeyValue>
									<MkButton
										v-if="instance.suspensionState === 'none'"
										inline
										danger
										@click="suspendDelivery"
										>配信を停止</MkButton
									>
									<MkButton
										v-else
										inline
										@click="unsuspendDelivery"
										>配信を再開</MkButton
									>
								</div>
								<FormSwitch
									v-model="isBlocked"
									class="_formBlock"
									@update:modelValue="toggleBlock"
									>{{ i18n.ts.blockThisInstance }}</FormSwitch
								>
								<FormSwitch
									v-model="isSilenced"
									class="_formBlock"
									@update:modelValue="toggleSilence"
									>{{
										i18n.ts.silenceThisInstance
									}}</FormSwitch
								>
							</FormSuspense>
							<MkButton @click="refreshMetadata"
								><i
									class="ph-arrows-clockwise ph-bold ph-lg"
								></i>
								Refresh metadata</MkButton
							>
						</FormSection>

						<FormSection>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>{{
									i18n.ts.registeredAt
								}}</template>
								<template #value
									><MkTime
										mode="detail"
										:time="instance.caughtAt"
								/></template>
							</MkKeyValue>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>{{
									i18n.ts.updatedAt
								}}</template>
								<template #value
									><MkTime
										mode="detail"
										:time="instance.infoUpdatedAt"
								/></template>
							</MkKeyValue>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>{{
									i18n.ts.latestRequestSentAt
								}}</template>
								<template #value
									><MkTime
										v-if="instance.latestRequestSentAt"
										:time="instance.latestRequestSentAt"
									/><span v-else>N/A</span></template
								>
							</MkKeyValue>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>{{
									i18n.ts.latestStatus
								}}</template>
								<template #value>{{
									instance.latestStatus
										? instance.latestStatus
										: "N/A"
								}}</template>
							</MkKeyValue>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>{{
									i18n.ts.latestRequestReceivedAt
								}}</template>
								<template #value
									><MkTime
										v-if="instance.latestRequestReceivedAt"
										:time="instance.latestRequestReceivedAt"
									/><span v-else>N/A</span></template
								>
							</MkKeyValue>
						</FormSection>

						<FormSection>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>Following (Pub)</template>
								<template #value>{{
									number(instance.followingCount)
								}}</template>
							</MkKeyValue>
							<MkKeyValue oneline style="margin: 1em 0">
								<template #key>Followers (Sub)</template>
								<template #value>{{
									number(instance.followersCount)
								}}</template>
							</MkKeyValue>
						</FormSection>

						<FormSection>
							<template #label>Well-known resources</template>
							<FormLink
								:to="`https://${host}/.well-known/host-meta`"
								external
								style="margin-bottom: 0.5rem"
								>host-meta</FormLink
							>
							<FormLink
								:to="`https://${host}/.well-known/host-meta.json`"
								external
								style="margin-bottom: 0.5rem"
								>host-meta.json</FormLink
							>
							<FormLink
								:to="`https://${host}/.well-known/nodeinfo`"
								external
								style="margin-bottom: 0.5rem"
								>nodeinfo</FormLink
							>
							<FormLink
								:to="`https://${host}/robots.txt`"
								external
								style="margin-bottom: 0.5rem"
								>robots.txt</FormLink
							>
							<FormLink
								:to="`https://${host}/manifest.json`"
								external
								style="margin-bottom: 0.5rem"
								>manifest.json</FormLink
							>
						</FormSection>
					</div>
				</swiper-slide>
				<swiper-slide v-if="!$store.state.hiddenActivityChart">
					<div class="_formRoot">
						<div class="cmhjzshl">
							<div class="selects">
								<MkSelect
									v-model="chartSrc"
									style="margin: 0 0.625rem 0 0; flex: 1"
								>
									<option value="instance-requests">
										{{ i18n.ts._instanceCharts.requests }}
									</option>
									<option value="instance-users">
										{{ i18n.ts._instanceCharts.users }}
									</option>
									<option value="instance-users-total">
										{{ i18n.ts._instanceCharts.usersTotal }}
									</option>
									<option value="instance-notes">
										{{ i18n.ts._instanceCharts.notes }}
									</option>
									<option value="instance-notes-total">
										{{ i18n.ts._instanceCharts.notesTotal }}
									</option>
									<option value="instance-ff">
										{{ i18n.ts._instanceCharts.ff }}
									</option>
									<option value="instance-ff-total">
										{{ i18n.ts._instanceCharts.ffTotal }}
									</option>
									<option value="instance-drive-usage">
										{{ i18n.ts._instanceCharts.cacheSize }}
									</option>
									<option value="instance-drive-usage-total">
										{{
											i18n.ts._instanceCharts
												.cacheSizeTotal
										}}
									</option>
									<option value="instance-drive-files">
										{{ i18n.ts._instanceCharts.files }}
									</option>
									<option value="instance-drive-files-total">
										{{ i18n.ts._instanceCharts.filesTotal }}
									</option>
								</MkSelect>
							</div>
							<div class="charts">
								<div class="label">
									{{ i18n.t("recentNHours", { n: 90 }) }}
								</div>
								<MkChart
									class="chart"
									:src="chartSrc"
									span="hour"
									:limit="90"
									:args="{ host: host }"
									:detailed="true"
								></MkChart>
								<div class="label">
									{{ i18n.t("recentNDays", { n: 90 }) }}
								</div>
								<MkChart
									class="chart"
									:src="chartSrc"
									span="day"
									:limit="90"
									:args="{ host: host }"
									:detailed="true"
								></MkChart>
							</div>
						</div>
					</div>
				</swiper-slide>
				<swiper-slide>
					<div class="_formRoot">
						<MkPagination
							v-slot="{ items }"
							:pagination="usersPagination"
							style="
								display: grid;
								grid-template-columns: repeat(
									auto-fill,
									minmax(16.875rem, 1fr)
								);
								grid-gap: 0.75rem;
							"
						>
							<MkA
								v-for="user in items"
								:key="user.id"
								v-tooltip.mfm="
									`Last posted: ${new Date(
										user.updatedAt
									).toLocaleString()}`
								"
								class="user"
								:to="`/user-info/${user.id}`"
							>
								<MkUserCardMini :user="user" />
							</MkA>
						</MkPagination>
					</div>
				</swiper-slide>
				<swiper-slide>
					<div class="_formRoot">
						<MkObjectView tall :value="instance"> </MkObjectView>
					</div>
				</swiper-slide>
				<swiper-slide v-if="iAmAdmin">
					<div class="_formRoot">
						<MkInstanceHealthLogs :host="host" />
					</div>
				</swiper-slide>
			</swiper>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 連合先サーバ 1 件の情報ページ（概要・チャート・ユーザー・生データ・履歴）。
 *
 * @remarks
 * - 管理者には、配信の停止状態（手動・閉鎖・自動）と、停止・再開の操作を出す。
 *   停止状態の書き換えは backend の `services/instance-health/state.ts` が行い、履歴に残る。
 * - 「履歴」タブは、そのサーバの状態の変化（一時停止・自動停止・解除・手動操作）を新しい順に出す。
 * - NB: タブ（`tabs`）とスライド（`swiper-slide`）は同じ順で並べること。ずれると別のタブの中身が出る。
 *
 * @internal
 */
import { watch } from "vue";
import { Virtual } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import type * as calckey from "calckey-js";
import MkChart from "@/components/MkChart.vue";
import MkObjectView from "@/components/MkObjectView.vue";
import FormLink from "@/components/form/link.vue";
import MkLink from "@/components/MkLink.vue";
import MkButton from "@/components/MkButton.vue";
import FormSection from "@/components/form/section.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import MkSelect from "@/components/form/select.vue";
import FormSwitch from "@/components/form/switch.vue";
import MkInstanceHealthLogs from "@/components/MkInstanceHealthLogs.vue";
import * as os from "@/os";
import number from "@/filters/number";
import { iAmAdmin } from "@/account";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deviceKind } from "@/scripts/device-kind";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import MkUserCardMini from "@/components/MkUserCardMini.vue";
import MkPagination from "@/components/MkPagination.vue";
import "swiper/scss";
import "swiper/scss/virtual";
import { getProxiedImageUrlNullable } from "@/scripts/media-proxy";
import {
	suspensionStateDescriptions,
	suspensionStateLabels,
} from "@/scripts/instance-health";

type AugmentedInstanceMetadata = calckey.entities.DetailedInstanceMetadata & {
	blockedHosts: string[];
	silencedHosts: string[];
};
type AugmentedInstance = calckey.entities.Instance & {
	isBlocked: boolean;
	isSilenced: boolean;
};

const props = defineProps<{
	host: string;
}>();

let tabs = ["overview"];
if (iAmAdmin && !defaultStore.state.hiddenActivityChart) tabs.push("chart");
if (iAmAdmin) tabs.push("users", "raw");
if (iAmAdmin) tabs.push("history");
let tab = $ref(tabs[0]);
watch($$(tab), () => syncSlide(tabs.indexOf(tab)));

let chartSrc = $ref("instance-requests");
let meta = $ref<AugmentedInstanceMetadata | null>(null);
let instance = $ref<AugmentedInstance | null>(null);
let isBlocked = $ref(false);
let isSilenced = $ref(false);
let iconUrl = $ref(null);
let faviconUrl = $ref(null);

const usersPagination = {
	endpoint: iAmAdmin ? "admin/show-users" : ("users" as const),
	limit: 10,
	params: {
		sort: "+updatedAt",
		state: "all",
		hostname: props.host,
	},
	offsetMode: true,
};

async function fetch() {
	if (iAmAdmin)
		meta = (await os.api("admin/meta")) as AugmentedInstanceMetadata;
	instance = (await os.api("federation/show-instance", {
		host: props.host,
	})) as AugmentedInstance;
	isBlocked = instance.isBlocked;
	isSilenced = instance.isSilenced;
	iconUrl = getProxiedImageUrlNullable(instance.iconUrl, "preview");
	faviconUrl = getProxiedImageUrlNullable(instance.faviconUrl, "preview");
}

async function toggleBlock() {
	if (meta == null) return;
	if (!instance) {
		throw new Error(`Instance info not loaded`);
	}
	let blockedHosts: string[];
	if (isBlocked) {
		blockedHosts = meta.blockedHosts.concat([instance.host]);
	} else {
		blockedHosts = meta.blockedHosts.filter((x) => x !== instance!.host);
	}
	await os.api("admin/update-meta", {
		blockedHosts,
	});
}

async function toggleSilence() {
	if (meta == null) return;
	if (!instance) {
		throw new Error(`Instance info not loaded`);
	}
	let silencedHosts: string[];
	if (isSilenced) {
		silencedHosts = meta.silencedHosts.concat([instance.host]);
	} else {
		silencedHosts = meta.silencedHosts.filter((x) => x !== instance!.host);
	}
	await os.api("admin/update-meta", {
		silencedHosts,
	});
}

/**
 * 配信を手動で停止する。理由のメモは履歴とモデレーションログに残る。
 *
 * @remarks
 * 手動停止は自動では解除されない。どの状態（自動停止・閉鎖停止）からでも手動停止にできる。
 */
async function suspendDelivery() {
	if (!instance) return;
	const { canceled, result } = await os.inputText({
		title: "配信を停止",
		text: "手動で停止したサーバは、自動では再開されません。理由のメモ（任意）を入力してください。",
		placeholder: "例: スパムが続いているため",
	});
	if (canceled) return;
	await os.apiWithDialog("admin/federation/update-instance", {
		host: instance.host,
		isSuspended: true,
		reason: result || null,
	});
	await fetch();
}

/**
 * 配信を再開する。手動停止・自動停止・閉鎖停止のどれからでも再開できる。
 */
async function unsuspendDelivery() {
	if (!instance) return;
	const { canceled, result } = await os.inputText({
		title: "配信を再開",
		text: "理由のメモ（任意）を入力してください。まだ落ちているサーバは、不通が 3 日続くと自動で停止されます。",
	});
	if (canceled) return;
	await os.apiWithDialog("admin/federation/update-instance", {
		host: instance.host,
		isSuspended: false,
		reason: result || null,
	});
	await fetch();
}

function refreshMetadata() {
	os.api("admin/federation/refresh-remote-instance-metadata", {
		host: instance.host,
	});
	os.alert({
		text: i18n.ts.refreshRequested,
	});
}

fetch();

const headerActions = $computed(() => [
	{
		text: `https://${props.host}`,
		icon: "ph-arrow-square-out ph-bold ph-lg",
		handler: () => {
			window.open(`https://${props.host}`, "_blank");
		},
	},
]);

let theTabs = [
	{
		key: "overview",
		title: i18n.ts.overview,
		icon: "ph-info ph-bold ph-lg",
	},
];

if (iAmAdmin && !defaultStore.state.hiddenActivityChart) {
	theTabs.push({
		key: "chart",
		title: i18n.ts.charts,
		icon: "ph-chart-bar ph-bold ph-lg",
	});
}
if (iAmAdmin) {
	theTabs.push(
		{
			key: "users",
			title: i18n.ts.users,
			icon: "ph-users ph-bold ph-lg",
		},
		{
			key: "raw",
			title: "Raw",
			icon: "ph-code ph-bold ph-lg",
		}
	);
}
if (iAmAdmin) {
	theTabs.push({
		key: "history",
		title: "履歴",
		icon: "ph-clock-counter-clockwise ph-bold ph-lg",
	});
}

let headerTabs = $computed(() => theTabs);

definePageMetadata({
	title: props.host,
	icon: "ph-hard-drives ph-bold ph-lg",
});

let swiperRef = null;

function setSwiperRef(swiper) {
	swiperRef = swiper;
	syncSlide(tabs.indexOf(tab));
}

function onSlideChange() {
	tab = tabs[swiperRef.activeIndex];
}

function syncSlide(index) {
	swiperRef.slideTo(index);
}
</script>

<style lang="scss" scoped>
.fnfelxur {
	display: flex;
	align-items: center;

	> .icon {
		display: block;
		margin: 0 1rem 0 0;
		height: 4rem;
		border-radius: 0.5rem;
	}

	> .name {
		word-break: break-all;
	}
}

.delivery-state {
	> * {
		margin: 0 0 0.75rem 0;
	}

	.stopped {
		color: var(--error);
		font-weight: bold;
	}
}

.cmhjzshl {
	> .selects {
		display: flex;
		margin: 0 0 1rem 0;
	}

	> .charts {
		> .label {
			margin-bottom: 0.75rem;
			font-weight: bold;
		}
	}
}
</style>
