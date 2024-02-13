<template>
	<div class="_formRoot">
		<div class="query">
			<MkInput
				v-model="q"
				debounce
				class=""
				:placeholder="i18n.ts.search"
			>
				<template #prefix
					><i class="ph-magnifying-glass ph-bold ph-lg"></i
				></template>
			</MkInput>
		</div>
		<FormSwitch v-model="notSetOnly" class="_formBlock">
			{{ i18n.ts.notSetOnly }}
		</FormSwitch>
		<FormSwitch
			v-if="!notSetOnly"
			v-model="dontShowNotSet"
			class="_formBlock"
		>
			{{ i18n.ts.dontShowNotSet }}
		</FormSwitch>
		<MkButton
			v-if="allConfigured && notSetOnly"
			inline
			@click="changeUnlockDeveloperSettings"
			>{{ "？" }}</MkButton
		>
		<template v-for="item in items">
			<FormLink
				:key="item.key"
				v-if="!notSetOnly || defaultStore.isDefault(item.key)"
				:to="`/settings/${item.def.page}`"
				style="overflow: hidden; text-overflow: ellipsis"
				class="_formBlock"
			>
				<span
					v-if="
						!notSetOnly &&
						!dontShowNotSet &&
						defaultStore.isDefault(item.key)
					"
					style="
						margin-left: 0;
						margin-right: 0.5em;
						vertical-align: baseline;
					"
					class="_beta"
					>{{ i18n.ts.notSet }}</span
				>{{ i18n.ts[item.key] }}
				<template #suffix
					><MkTime
						v-if="item.def.createdAt"
						:time="new Date(item.def.createdAt)"
						mode="relative"
						dateOnly
				/>
				<span v-else>
					{{ i18n.ts.basicSettings }}
				</span></template>
			</FormLink>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { ref, unref, computed, defineAsyncComponent } from "vue";
import FormSwitch from "@/components/form/switch.vue";
import FormLink from "@/components/form/link.vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import * as os from "@/os";
import { popup, toast } from "@/os";
import { defaultStore } from "@/store";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const q = $ref("");

const dontShowNotSet = computed(
	defaultStore.makeGetterSetter("dontShowNotSet")
);

const items = computed(() => {
	return Object.keys(defaultStore.def)
		.filter((x) => q || defaultStore.def[x].createdAt)
		.filter((x) => defaultStore.def[x].page)
		.filter((x) => i18n.ts[x])
		.filter((x) => !q || i18n.ts[x].includes(q) || x.includes(q))
		.map((x) => ({
			key: x,
			def: defaultStore.def[x],
		}))
		.sort((a, b) => {
			if (q) {
				if (i18n.ts[a.key].length < i18n.ts[b.key].length) return -1;
				if (i18n.ts[b.key].length < i18n.ts[a.key].length) return 1;
			}
			if (a.def.createdAt === b.def.createdAt) {
				if (a.key < b.key) return -1;
				if (a.key > b.key) return 1;
				return 0;
			} else {
				if (new Date(a.def.createdAt) > new Date(b.def.createdAt))
					return -1;
				if (new Date(a.def.createdAt) < new Date(b.def.createdAt))
					return 1;
				return 0;
			}
		});
});

const unlockDeveloperSettings = computed(
	defaultStore.makeGetterSetter("unlockDeveloperSettings")
);

const allConfigured = !unref(items).some((x) => defaultStore.isDefault(x.key));

const notSetOnly = ref(!unref(dontShowNotSet) && !allConfigured);

function changeUnlockDeveloperSettings() {
	if (unlockDeveloperSettings.value) {
		toast("既に設定 > 色々に項目が追加されています。");
	} else {
		unlockDeveloperSettings.value = true;
		toast("設定 > 色々にて項目が追加されました！");
	}
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.mkkeySettings,
	icon: "ph-list-plus ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.query {
	background: var(--bg);
	padding: 16px;
}
</style>