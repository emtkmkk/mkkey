<template>
	<div class="_formRoot">
		<FormRange
			v-model="masterVolume"
			:min="0"
			:max="1"
			:step="0.05"
			:text-converter="(v) => `${Math.floor(v * 100)}%`"
			class="_formBlock"
		>
			<template #label>{{ i18n.ts.masterVolume }}</template>
		</FormRange>
		<MkSwitch v-model="notUseSound" class="_formBlock">
			<template #label>{{ i18n.ts.notUseSound }}</template>
		</MkSwitch>
		<MkSwitch v-model="useSoundOnlyWhenActive" class="_formBlock">
			<template #label>{{ i18n.ts.useSoundOnlyWhenActive }}</template>
		</MkSwitch>

		<FormSection>
			<template #label>{{ i18n.ts.sounds }}</template>
			<FormFolder
				v-for="type in Object.keys(sounds)"
				:key="type"
				style="margin: 0.5rem 0;"
			>
				<template #label>{{
				i18n.t(`_sfx.${type}`)
				}}</template>
				<template #suffix>{{
					getSoundTypeName(sounds[type].type) +
					(sounds[type].type && sounds[type].volume !== 1 ? ` ${(sounds[type].volume * 100).toFixed(0)}%` : "")
				}}</template>
				<XSound :type="sounds[type].type" :volume="sounds[type].volume" :fileId="sounds[type].fileId" :fileUrl="sounds[type].fileUrl" :soundsTypes="soundsTypes" @update="(res) => updated(type, res)"/>
			</FormFolder>
		</FormSection>

		<FormButton danger class="_formBlock" @click="reset()"
			><i class="ph-arrow-clockwise ph-bold ph-lg"></i>
			{{ i18n.ts.default }}</FormButton
		>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import FormRange from "@/components/form/range.vue";
import FormButton from "@/components/MkButton.vue";
import FormSection from "@/components/form/section.vue";
import FormFolder from "@/components/form/folder.vue";
import XSound from '@/pages/settings/sounds.sound.vue';
import * as os from "@/os";
import { ColdDeviceStorage } from "@/store";
import { playFile } from "@/scripts/sound";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store.js";
import MkSwitch from "@/components/form/switch.vue";

const notUseSound = computed(defaultStore.makeGetterSetter("notUseSound"));
const useSoundOnlyWhenActive = computed(
	defaultStore.makeGetterSetter("useSoundOnlyWhenActive")
);
const soundsTypes = await os.api("get-sounds");

const masterVolume = computed({
	get: () => {
		return ColdDeviceStorage.get("sound_masterVolume");
	},
	set: (value) => {
		ColdDeviceStorage.set("sound_masterVolume", value);
	},
});

const volumeIcon = computed(() =>
	masterVolume.value === 0
		? "ph-speaker-none ph-bold ph-lg"
		: "ph-speaker-high ph-bold ph-lg"
);

function getSoundTypeName(f): string {
	switch (f) {
		case null:
			return i18n.ts.none;
		case '_driveFile_':
			return i18n.ts._soundSettings.driveFile;
		default:
			return f.length > 14 ? f.replace(/^[^\/]+\//,"") : f;
	}
}

const sounds = ref({
	note: ColdDeviceStorage.get("sound_note"),
	noteMy: ColdDeviceStorage.get("sound_noteMy"),
	notification: ColdDeviceStorage.get("sound_notification"),
	chat: ColdDeviceStorage.get("sound_chat"),
	chatBg: ColdDeviceStorage.get("sound_chatBg"),
	antenna: ColdDeviceStorage.get("sound_antenna"),
	channel: ColdDeviceStorage.get("sound_channel"),
	reaction: ColdDeviceStorage.get("sound_reaction"),
});

async function updated(type, sound) {
	const v = {
		type: sound.type,
		fileId: sound.fileId,
		fileUrl: sound.fileUrl,
		volume: sound.volume,
	};

	ColdDeviceStorage.set(`sound_${type}`, v);
	sounds.value[type] = v;
}

function reset() {
	for (const sound of Object.keys(sounds.value)) {
		const v = ColdDeviceStorage.default[`sound_${sound}`];
		ColdDeviceStorage.set(`sound_${sound}`, v);
		sounds.value[sound] = v;
	}
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.sounds,
	icon: "ph-speaker-high ph-bold ph-lg",
});
</script>
