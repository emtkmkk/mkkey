<template>
	<div class="jmgmzlwq _block">
		{{ i18n.ts.remoteUserCaution
		}}<a
			class="link"
			:href="href"
			rel="nofollow noopener"
			target="_blank"
			>{{ i18n.ts.showOnRemote }}</a
		>
	</div>
</template>

<script lang="ts" setup>
import { i18n } from "@/i18n";

defineProps<{
	href: string;
}>();
</script>

<style lang="scss" scoped>
.jmgmzlwq {
	padding: 1rem;
	font-size: 90%;
	background: var(--infoWarnBg);
	color: var(--infoWarnFg);
	border-radius: var(--radius);

	> .link {
		margin-left: 0.25rem;
		color: var(--accent);
	}
}
</style>
