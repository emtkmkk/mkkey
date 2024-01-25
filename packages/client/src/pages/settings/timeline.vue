<template>
	<div class="_formRoot">
			<FormSection>
			<template #label></template>
			<FormRadios v-model="showLocalPostsInTimeline" class="_formBlock">
				<template #label>{{ i18n.ts.showLocalPosts }}</template>
				<option value="home">
					<i class="ph-handshake ph-bold ph-lg" />
					{{ i18n.ts.homeTimeline }}
				</option>
				<option value="social">
					<i class="ph-house ph-bold ph-lg" />
					{{ i18n.ts.socialTimeline }}
				</option>
				<option value="both">
					<i class="ph-house ph-bold ph-lg" />
					<i class="ph-handshake ph-bold ph-lg" />
					{{ i18n.ts.bothTimeline }}
				</option>
				<option value="none">
					{{ i18n.ts.hidden }}
				</option>
			</FormRadios>
			<FormSwitch v-model="hiddenLTL" class="_formBlock">{{
				i18n.ts.hiddenLTL
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch
				v-model="blockPostPublic"
				v-if="hiddenLTL"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.blockPostPublic
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
					i18n.ts.blockPostPublicDescription
				}}{{
					i18n.ts.hiddenLTLDescription
				}}</template></FormSwitch
			>
			<FormSwitch  v-model="hiddenGTL" class="_formBlock">{{
				i18n.ts.hiddenGTL
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSelect v-model="thirdTimelineType" class="_formBlock">
				<template #label>{{ i18n.ts.thirdTimelineType }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="media">{{ i18n.ts._timelines.media }}</option>
				<option value="spotlight">{{ i18n.ts._timelines.spotlight }}</option>
				<option value="list">{{ i18n.ts._timelines.list }}</option>
				<option value="antenna">{{ i18n.ts._timelines.antenna }}</option>
				<option value="hidden">{{ i18n.ts.hidden }}</option>
			</FormSelect>
			<FormInput
				v-if="['list','antenna'].includes(thirdTimelineType)"
				v-model="thirdTimelineListId"
				class="_formBlock"
				:small="true"
				:placeholder="`リスト / アンテナの内部ID (10文字)`"
				:manualSave="true"
				style="margin: 0 0 !important"
			>
				<template #label>{{ i18n.ts.thirdTimelineListId }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			</FormInput>
			<!--<FormSelect v-if="!['classic', 'deck'].includes(ui)" v-model="fourthTimelineType" class="_formBlock">
				<template #label>{{ i18n.ts.fourthTimelineType }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="media">{{ i18n.ts._timelines.media }}</option>
				<option value="spotlight">{{ i18n.ts._timelines.spotlight }}</option>
				<option value="list">{{ i18n.ts._timelines.list }}</option>
				<option value="antenna">{{ i18n.ts._timelines.antenna }}</option>
				<option value="hidden">{{ i18n.ts.hidden }}</option>
			</FormSelect>
			<FormInput
				v-if="['list', 'antenna'].includes(fourthTimelineType)"
				v-model="fourthTimelineListId"
				class="_formBlock"
				:small="true"
				:placeholder="`リスト / アンテナの内部ID (10文字)`"
				style="margin: 0 0 !important"
			>
				<template #label>{{ i18n.ts.fourthTimelineListId }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			</FormInput>-->
			<FormSwitch  v-model="showListButton" class="_formBlock">{{
				i18n.ts.showListButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch  v-model="showAntennaButton" class="_formBlock">{{
				i18n.ts.showAntennaButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch  v-model="showTimeTravelButton" class="_formBlock">{{
				i18n.ts.showTimeTravelButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showFixedPostForm" class="_formBlock">{{
				i18n.ts.showFixedPostForm
			}}</FormSwitch>
			<FormSwitch v-model="recentRenoteHidden" class="_formBlock">{{
				i18n.ts.recentRenoteHidden
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="reactedRenoteHidden" class="_formBlock">{{
				i18n.ts.reactedRenoteHidden
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showLocalTimelineBelowPublic" class="_formBlock">{{
				i18n.ts.showLocalTimelineBelowPublic
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="delayPostHidden" class="_formBlock">{{
				i18n.ts.delayPostHidden
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="localShowRenote" class="_formBlock" @update:modelValue="save()">{{
				i18n.ts.localShowRenote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="remoteShowRenote" class="_formBlock" @update:modelValue="save()">{{
				i18n.ts.remoteShowRenote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showSelfRenoteToHome" class="_formBlock" @update:modelValue="save()">{{
				i18n.ts.showSelfRenoteToHome
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showTimelineReplies" class="_formBlock" @update:modelValue="save()"
				>{{ i18n.ts.flagShowTimelineReplies
				}}<template #caption
					>{{ i18n.ts.flagShowTimelineRepliesDescription }}
					{{ i18n.ts.reflectMayTakeTime }}</template
				></FormSwitch
			>

			<FormSelect v-model="nsfw" class="_formBlock">
				<template #label>{{ i18n.ts.nsfw }}</template>
				<option value="respect">{{ i18n.ts._nsfw.respect }}</option>
				<option value="ignore">{{ i18n.ts._nsfw.ignore }}</option>
				<option value="force">{{ i18n.ts._nsfw.force }}</option>
				<option value="toCW">{{ i18n.ts._nsfw.toCW }}</option>
			</FormSelect>
			<FormSwitch v-model="noteAllCw" class="_formBlock">{{
				i18n.ts.noteAllCw
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import FormButton from "@/components/MkButton.vue";
import FormLink from "@/components/form/link.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormInput from "@/components/form/input.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FormRange from "@/components/form/range.vue";
import MkLink from "@/components/MkLink.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";

const DESKTOP_THRESHOLD = 1100;
const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = ref(
	deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD
);
window.addEventListener("resize", () => {
	isMobile.value =
		deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
});

const showLocalPostsInTimeline = computed(
	defaultStore.makeGetterSetter("showLocalPostsInTimeline")
);
const developer = computed(
	defaultStore.makeGetterSetter("developer")
);
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);
const showListButton = computed(
	defaultStore.makeGetterSetter("showListButton")
);
const showAntennaButton = computed(
	defaultStore.makeGetterSetter("showAntennaButton")
);
const showTimeTravelButton = computed(
	defaultStore.makeGetterSetter("showTimeTravelButton")
);
const showFixedPostForm = computed(
	defaultStore.makeGetterSetter("showFixedPostForm")
);
const nsfw = computed(defaultStore.makeGetterSetter("nsfw"));
const recentRenoteHidden = $computed(
	defaultStore.makeGetterSetter("recentRenoteHidden")
);
const reactedRenoteHidden = $computed(
	defaultStore.makeGetterSetter("reactedRenoteHidden")
);
const delayPostHidden = computed(defaultStore.makeGetterSetter("delayPostHidden"));
const noteAllCw = $computed(
	defaultStore.makeGetterSetter("noteAllCw")
);
const thirdTimelineType = $computed(
	defaultStore.makeGetterSetter("thirdTimelineType")
);
const thirdTimelineListId = $computed(
	defaultStore.makeGetterSetter("thirdTimelineListId")
);
const fourthTimelineType = $computed(
	defaultStore.makeGetterSetter("fourthTimelineType")
);
const fourthTimelineListId = $computed(
	defaultStore.makeGetterSetter("fourthTimelineListId")
);
const hiddenLTL = $computed(
	defaultStore.makeGetterSetter("hiddenLTL")
);
const hiddenGTL = $computed(
	defaultStore.makeGetterSetter("hiddenGTL")
);
const showLocalTimelineBelowPublic = $computed(
	defaultStore.makeGetterSetter('showLocalTimelineBelowPublic')
);
let localShowRenote = $ref($i.localShowRenote);
let remoteShowRenote = $ref($i.remoteShowRenote);
let showSelfRenoteToHome = $ref($i.showSelfRenoteToHome);
let showTimelineReplies = $ref($i.showTimelineReplies);
let blockPostPublic = $ref($i.blockPostPublic);
function save() {
	os.api("i/update", {
		localShowRenote: !!localShowRenote,
		remoteShowRenote: !!remoteShowRenote,
		showSelfRenoteToHome: !!showSelfRenoteToHome,
		showTimelineReplies: !!showTimelineReplies,
		blockPostPublic: !!blockPostPublic,
	});
}

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch(
	[
		showLocalPostsInTimeline,
		delayPostHidden,
		showLocalTimelineBelowPublic,
	],
	async () => {
		await reloadAsk();
	}
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.timeline,
	icon: "ph-list-dashes ph-bold ph-lg",
});
</script>
