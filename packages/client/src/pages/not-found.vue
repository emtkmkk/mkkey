<template>
	<div class="ipledcug">
		<div class="_fullinfo">
			<img
				src="/static-assets/badges/not-found.png"
				class="_ghost"
				alt="Not found"
			/>
			<div>{{ i18n.ts.notFoundDescription }}</div>
			<MkButton class="button primary" @click="reload">{{
				i18n.ts.reload
			}}</MkButton>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { unisonReload } from "@/scripts/unison-reload";
import MkButton from "@/components/MkButton.vue";

function reload() {
	unisonReload();
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.notFound,
	icon: "ph-warning ph-bold ph-lg",
});
</script>
