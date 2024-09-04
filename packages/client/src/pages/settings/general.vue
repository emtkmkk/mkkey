<template>
	<div class="_formRoot">
		<FormSelect v-model="lang" class="_formBlock">
			<template #label>{{ i18n.ts.uiLanguage }}</template>
			<option v-for="x in langs" :key="x[0]" :value="x[0]">
				{{ x[1] }}
			</option>
		</FormSelect>

		<FormSwitch v-model="showAds" class="_formBlock">{{
			i18n.ts.showAds
		}}</FormSwitch>

		<FormSwitch v-model="showUpdates" class="_formBlock">{{
			i18n.ts.showUpdates
		}}</FormSwitch>

		<FormSwitch
			v-if="developer"
			v-model="showMiniUpdates"
			class="_formBlock"
			>{{ i18n.ts.showMiniUpdates
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>

		<FormSwitch
			v-if="$i?.isAdmin"
			v-model="showAdminUpdates"
			class="_formBlock"
			>{{ i18n.ts.showAdminUpdates }}</FormSwitch
		>

		<FormSwitch v-model="showMkkeySettingTips" class="_formBlock"
			>{{ i18n.ts.showMkkeySettingTips
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span></FormSwitch
		>

		<FormSwitch
			v-if="defaultStore.state.unlockDeveloperSettings"
			v-model="developer"
			class="_formBlock"
			>{{ i18n.ts.developerOption
			}}<span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span
			><template #caption>{{
				i18n.ts.developerOptionDescription
			}}</template></FormSwitch
		>

		<FormLink to="/settings/deck" class="_formBlock">{{
			i18n.ts.deck
		}}</FormLink>

		<FormLink to="/settings/custom-katex-macro" class="_formBlock"
			><template #icon><i class="ph-radical ph-bold ph-lg"></i></template
			>{{ i18n.ts.customKaTeXMacro }}</FormLink
		>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { $i } from "@/account";
import FormInput from "@/components/form/input.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FormRange from "@/components/form/range.vue";
import FormSection from "@/components/form/section.vue";
import FormLink from "@/components/form/link.vue";
import MkLink from "@/components/MkLink.vue";
import { ui, langs } from "@/config";
import { defaultStore } from "@/store";
import * as os from "@/os";
import { unisonReload } from "@/scripts/unison-reload";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
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

const lang = ref(localStorage.getItem("lang"));

const showAds = computed(defaultStore.makeGetterSetter("showAds"));

const showUpdates = computed(defaultStore.makeGetterSetter("showUpdates"));

const showAdminUpdates = computed(
	defaultStore.makeGetterSetter("showAdminUpdates")
);

const showMiniUpdates = computed(
	defaultStore.makeGetterSetter("showMiniUpdates")
);

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

const developer = computed(defaultStore.makeGetterSetter("developer"));
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

watch(lang, () => {
	localStorage.setItem("lang", lang.value as string);
	localStorage.removeItem("locale");
});

watch(
	[lang, showAds, showUpdates, showMiniUpdates, showAdminUpdates],
	async () => {
		await reloadAsk();
	}
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.general,
	icon: "ph-gear-six ph-bold ph-lg",
});
</script>
