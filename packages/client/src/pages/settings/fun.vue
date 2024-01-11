<template>
	<div class="_formRoot">
		<FormSection>
			<template #label>{{ i18n.ts.power }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<FormSwitch v-model="powerMode" class="_formBlock">{{
				i18n.ts.powerMode
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeColorful" class="_formBlock">{{
				i18n.ts.powerModeColorful
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeNoShake" class="_formBlock">{{
				i18n.ts.powerModeNoShake
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
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { deviceKind } from "@/scripts/device-kind";
import { isSupportNavigatorConnection } from '@/scripts/datasaver';

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

const developer = computed(
	defaultStore.makeGetterSetter("developer")
);
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

const powerMode = computed(
	defaultStore.makeGetterSetter("powerMode")
);
const powerModeColorful = computed(
	defaultStore.makeGetterSetter("powerModeColorful")
);
const powerModeNoShake = computed(
	defaultStore.makeGetterSetter("powerModeNoShake")
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.funSetting,
	icon: "ph-confetti ph-bold ph-lg",
});
</script>
