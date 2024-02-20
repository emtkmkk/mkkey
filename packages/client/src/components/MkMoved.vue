<template>
	<div class="msjugskd _block">
		<i
			class="ph-airplane-takeoff ph-bold ph-lg"
			style="margin-right: 0.5rem"
		/>
		{{ i18n.ts.accountMoved }}
		<MkMention class="link" :username="acct" :host="host" />
	</div>
</template>

<script lang="ts" setup>
import MkMention from "./MkMention.vue";
import { i18n } from "@/i18n";

defineProps<{
	acct: string;
	host: string;
}>();
</script>

<style lang="scss" scoped>
.msjugskd {
	padding: 1rem;
	font-size: 90%;
	background: var(--infoWarnBg);
	color: var(--error);
	border-radius: var(--radius);

	> .link {
		margin-left: 0.25rem;
		color: var(--accent);
	}
}
</style>
