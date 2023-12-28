<template>
	<div class="_formRoot">
		<FormSection v-if="!fetching">
			<template #label>{{ i18n.ts.usageAmount }}</template>
			<div class="_formBlock uawsfosz">
				<div class="meter"><div :style="meterStyle"></div></div>
			</div>
			<FormSplit>
				<MkKeyValue class="_formBlock">
					<template #key>{{ i18n.ts.capacity }}</template>
					<template #value>{{ bytes(capacity, 2) + (capacity - DEFAULT_CAPACITY > 0 ? ` (+${bytes(capacity - DEFAULT_CAPACITY, 2)} ${~~(((capacity - DEFAULT_CAPACITY) / (MAX_CAPACITY - DEFAULT_CAPACITY)) * 100)}% 拡張済み)` : "") }}</template>
				</MkKeyValue>
				<MkKeyValue class="_formBlock">
					<template #key>{{ i18n.ts.inUse }}</template>
					<template #value>{{ bytes(usage, 2) }}</template>
				</MkKeyValue>
			</FormSplit>
		</FormSection>

		<FormSection v-if="!$store.state.hiddenActivityChart">
			<template #label>{{ i18n.ts.statistics }}</template>
			<MkChart
				src="per-user-drive"
				:args="{ user: $i }"
				span="day"
				:limit="7 * 5"
				:bar="true"
				:stacked="true"
				:detailed="false"
				:aspect-ratio="6"
			/>
		</FormSection>

		<FormSection>
			<FormButton @click="chooseUploadFolder()">
				{{ i18n.ts.uploadFolder }}
				<template #suffix>{{
					uploadFolder ? uploadFolder.name : "-"
				}}</template>
				<template #suffixIcon
					><i class="ph-folder-notch-open ph-bold ph-lg"></i
				></template>
			</FormButton>
			<FormButton @click="chooseUploadFolderAvatar()">
				{{ i18n.ts.uploadFolderAvatar }}
				<template #suffix>{{
					uploadFolderAvatar ? uploadFolderAvatar.name : "-"
				}}</template>
				<template #suffixIcon
					><i class="ph-folder-notch-open ph-bold ph-lg"></i
				></template>
			</FormButton>
			<FormButton @click="chooseUploadFolderBanner()">
				{{ i18n.ts.uploadFolderBanner }}
				<template #suffix>{{
					uploadFolderBanner ? uploadFolderBanner.name : "-"
				}}</template>
				<template #suffixIcon
					><i class="ph-folder-notch-open ph-bold ph-lg"></i
				></template>
			</FormButton>
			<FormButton v-if="$i.isModerator || $i.isAdmin" @click="chooseUploadFolderEmoji()">
				{{ i18n.ts.uploadFolderEmoji }}
				<template #suffix>{{
					uploadFolderEmoji ? uploadFolderEmoji.name : "-"
				}}</template>
				<template #suffixIcon
					><i class="ph-folder-notch-open ph-bold ph-lg"></i
				></template>
			</FormButton>
			<FormSwitch v-model="keepOriginalUploading" class="_formBlock">
				<template #label>{{ i18n.ts.keepOriginalUploading }}</template>
				<template #caption>{{
					i18n.ts.keepOriginalUploadingDescription
				}}</template>
			</FormSwitch>
			<FormSwitch v-model="keepFileName" class="_formBlock">
				<template #label>{{ i18n.ts.keepFileName }}</template>
			</FormSwitch>
			<FormSwitch v-model="alwaysInputFilename" class="_formBlock">
				<template #label>{{ i18n.ts.alwaysInputFilename }}</template>
			</FormSwitch>
			<FormSwitch
				v-model="alwaysMarkNsfw"
				class="_formBlock"
				@update:modelValue="saveProfile()"
			>
				<template #label>{{ i18n.ts.alwaysMarkSensitive }}</template>
			</FormSwitch><span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			<FormSwitch
				v-model="autoSensitive"
				class="_formBlock"
				@update:modelValue="saveProfile()"
			>
				<template #label
					>{{ i18n.ts.enableAutoSensitive
					}}<span class="_beta">{{ i18n.ts.beta }}</span></template
				>
				<template #caption>{{
					i18n.ts.enableAutoSensitiveDescription
				}}</template>
			</FormSwitch>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import tinycolor from "tinycolor2";
import FormLink from "@/components/form/link.vue";
import FormButton from "@/components/MkButton.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSection from "@/components/form/section.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import FormSplit from "@/components/form/split.vue";
import * as os from "@/os";
import bytes from "@/filters/bytes";
import { defaultStore } from "@/store";
import MkChart from "@/components/MkChart.vue";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { $i } from "@/account";

const fetching = ref(true);
const usage = ref<any>(null);
const capacity = ref<any>(null);
const uploadFolder = ref<any>(null);
const uploadFolderAvatar = ref<any>(null);
const uploadFolderBanner = ref<any>(null);
const uploadFolderEmoji = ref<any>(null);
const DEFAULT_CAPACITY = 5 * 1024 * 1024 * 1024;
const MAX_CAPACITY = 100 * 1024 * 1024 * 1024;
let alwaysMarkNsfw = $ref($i.alwaysMarkNsfw);
let autoSensitive = $ref($i.autoSensitive);
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);


const meterStyle = computed(() => {
	return {
		width: `${(usage.value / capacity.value) * 100}%`,
		background: tinycolor({
			h: 180 - (usage.value / capacity.value) * 180,
			s: 0.7,
			l: 0.5,
		}),
	};
});

const keepOriginalUploading = computed(
	defaultStore.makeGetterSetter("keepOriginalUploading")
);

const keepFileName = computed(
	defaultStore.makeGetterSetter("keepFileName")
);

const alwaysInputFilename = computed(
	defaultStore.makeGetterSetter("alwaysInputFilename")
);

os.api("drive").then((info) => {
	capacity.value = info.capacity;
	usage.value = info.usage;
	fetching.value = false;
});

if (defaultStore.state.uploadFolder) {
	os.api("drive/folders/show", {
		folderId: defaultStore.state.uploadFolder,
	}).then((response) => {
		uploadFolder.value = response;
	});
}
if (defaultStore.state.uploadFolderAvatar) {
	os.api("drive/folders/show", {
		folderId: defaultStore.state.uploadFolderAvatar,
	}).then((response) => {
		uploadFolderAvatar.value = response;
	});
}
if (defaultStore.state.uploadFolderBanner) {
	os.api("drive/folders/show", {
		folderId: defaultStore.state.uploadFolderBanner,
	}).then((response) => {
		uploadFolderBanner.value = response;
	});
}
if (defaultStore.state.uploadFolderEmoji) {
	os.api("drive/folders/show", {
		folderId: defaultStore.state.uploadFolderEmoji,
	}).then((response) => {
		uploadFolderEmoji.value = response;
	});
}

function chooseUploadFolder() {
	os.selectDriveFolder(false).then(async (folder) => {
		defaultStore.set("uploadFolder", folder ? folder.id : null);
		os.success();
		if (defaultStore.state.uploadFolder) {
			uploadFolder.value = await os.api("drive/folders/show", {
				folderId: defaultStore.state.uploadFolder,
			});
		} else {
			uploadFolder.value = null;
		}
	});
}
function chooseUploadFolderAvatar() {
	os.selectDriveFolder(false).then(async (folder) => {
		defaultStore.set("uploadFolderAvatar", folder ? folder.id : null);
		os.success();
		if (defaultStore.state.uploadFolderAvatar) {
			uploadFolderAvatar.value = await os.api("drive/folders/show", {
				folderId: defaultStore.state.uploadFolderAvatar,
			});
		} else {
			uploadFolderAvatar.value = null;
		}
	});
}
function chooseUploadFolderBanner() {
	os.selectDriveFolder(false).then(async (folder) => {
		defaultStore.set("uploadFolderBanner", folder ? folder.id : null);
		os.success();
		if (defaultStore.state.uploadFolderBanner) {
			uploadFolderBanner.value = await os.api("drive/folders/show", {
				folderId: defaultStore.state.uploadFolderBanner,
			});
		} else {
			uploadFolderBanner.value = null;
		}
	});
}
function chooseUploadFolderEmoji() {
	os.selectDriveFolder(false).then(async (folder) => {
		defaultStore.set("uploadFolderEmoji", folder ? folder.id : null);
		os.success();
		if (defaultStore.state.uploadFolderEmoji) {
			uploadFolderEmoji.value = await os.api("drive/folders/show", {
				folderId: defaultStore.state.uploadFolderEmoji,
			});
		} else {
			uploadFolderEmoji.value = null;
		}
	});
}

function saveProfile() {
	os.api("i/update", {
		alwaysMarkNsfw: !!alwaysMarkNsfw,
		autoSensitive: !!autoSensitive,
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.drive,
	icon: "ph-cloud ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
@use "sass:math";

.uawsfosz {
	> .meter {
		$size: 12px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: math.div($size, 2);
		overflow: hidden;

		> div {
			height: $size;
			border-radius: math.div($size, 2);
		}
	}
}
</style>
