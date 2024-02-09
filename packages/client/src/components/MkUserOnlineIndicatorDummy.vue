<template>
	<div v-tooltip="text" class="fzgwjkgc" :class="onlineStatus"></div>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as misskey from "calckey-js";
import MkUserOnlineIndicatorDummy from "@/components/MkUserOnlineIndicatorDummy.vue";
import { i18n } from "@/i18n";

const props = defineProps<{
	onlineStatus:
		| "unknown"
		| "online"
		| "half-online"
		| "active"
		| "half-active"
		| "offline"
		| "half-sleeping"
		| "sleeping"
		| "deep-sleeping"
		| "super-sleeping";
}>();

const text = $computed(() => {
	switch (props.onlineStatus) {
		case "online":
			return i18n.ts.online;
		case "half-online":
			return i18n.ts.online;
		case "active":
			return i18n.ts.active;
		case "half-active":
			return i18n.ts.active;
		case "offline":
			return i18n.ts.offline;
		case "unknown":
			return i18n.ts.unknown;
		case "half-sleeping":
			return i18n.ts.offline;
		case "sleeping":
			return i18n.ts.offline;
		case "deep-sleeping":
			return i18n.ts.offline;
		case "super-sleeping":
			return i18n.ts.offline;
	}
});
</script>

<style lang="scss" scoped>
.fzgwjkgc {
	box-shadow: 0 0 0 3px var(--panel);
	border-radius: 120%; // Blinkのバグか知らんけど、100%ぴったりにすると何故か若干楕円でレンダリングされる

	&.online {
		background: #79fc68;
	}

	&.half-online {
		background: #9ccfd8;
	}

	&.active {
		background: #faa123;
	}

	&.half-active {
		background: #fce2bb;
	}

	&.offline {
		background: #6e6a86;
	}

	&.half-sleeping {
		background: #dfb8fc;
	}

	&.sleeping {
		background: #ac3bff;
	}

	&.deep-sleeping {
		background: #5436eb;
	}

	&.super-sleeping {
		background: #250173;
	}

	&.unknown {
		background: #555555;
	}
}
</style>
