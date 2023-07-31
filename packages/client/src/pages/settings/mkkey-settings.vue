<template>
	<div class="_formRoot">
		<FormSwitch
			v-model="notSetOnly"
			class="_formBlock"
		>
			{{ i18n.ts.notSetOnly }}
		</FormSwitch>
		<template v-for="item in items">
			<FormLink :key="item.key" v-if="!notSetOnly || defaultStore.isDefault(item.key)" :to="`/settings/${item.def.page}`" style="overflow: hidden;text-overflow: ellipsis;" class="_formBlock">
				{{ i18n.ts[item.key] }}<span v-if="defaultStore.isDefault(item.key)" class="_beta">{{ i18n.ts.notSet }}</span>
				<template #suffix><MkTime :time="new Date(item.def.createdAt)" mode="relative"/></template>
			</FormLink>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, defineAsyncComponent } from "vue";
import FormSwitch from "@/components/form/switch.vue";
import FormLink from "@/components/form/link.vue";
import MkButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { popup } from "@/os";
import { defaultStore } from "@/store";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const notSetOnly = ref(false);

const items = computed(() => {
	const storekeys = Object.keys(defaultStore.def).filter(x => {
		i18n.ts[x] &&
		defaultStore.def[x].createdAt &&
		defaultStore.def[x].page
	});
	return storekeys
		.map(x => ({
			key: x,
			def: defaultStore.def[x],
		}))
		.sort((a, b) => {
			if (a.def.createdAt === b.def.createdAt) {
				if (a.key < b.key) return -1;
				if (a.key > b.key) return 1;
				return 0;
			} else {
				if (new Date(a.def.createdAt) > new Date(b.def.createdAt)) return -1;
				if (new Date(a.def.createdAt) < new Date(b.def.createdAt)) return 1;
				return 0;
			}
		});
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.mkkeySettings,
	icon: "ph-list-plus ph-bold ph-lg",
});
</script>