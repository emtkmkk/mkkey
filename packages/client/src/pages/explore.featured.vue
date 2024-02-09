<template>
	<MkSpacer :content-max="800">
		<template v-if="$i != null">
			<MkTab v-model="tab" style="margin-bottom: var(--margin)">
				<option value="combined">{{ i18n.ts.combined }}</option>
				<option value="local">{{ i18n.ts.local }}</option>
				<option value="poll">{{ i18n.ts.poll }}</option>
			</MkTab>
		</template>
		<template v-else>
			<MkTab v-model="tab" style="margin-bottom: var(--margin)">
				<option value="local">{{ i18n.ts.local }}</option>
			</MkTab>
		</template>
		<XNotes v-if="tab === 'combined'" :pagination="paginationForCombined" />
		<XNotes v-if="tab === 'local'" :pagination="paginationForLocal" />
		<XNotes v-if="tab === 'poll'" :pagination="paginationForPoll" />
	</MkSpacer>
</template>

<script lang="ts" setup>
import XNotes from "@/components/MkNotes.vue";
import MkTab from "@/components/MkTab.vue";
import { i18n } from "@/i18n";
import { $i } from "@/account";

const paginationForLocal = {
	endpoint: "notes/featured" as const,
	limit: 10,
	origin: "local",
	offsetMode: true,
	params: {
		days: 14,
	},
};

const paginationForRemote = {
	endpoint: "notes/featured" as const,
	limit: 20,
	offsetMode: true,
	params: {
		origin: "remote",
		days: 7,
	},
};

const paginationForCombined = {
	endpoint: "notes/featured" as const,
	limit: 20,
	offsetMode: true,
	params: {
		origin: "combined",
		days: 7,
	},
};

const paginationForPoll = {
	endpoint: "notes/polls/recommendation" as const,
	limit: 10,
	offsetMode: false,
};

let tab = $ref($i != null ? "combined" : "local");
</script>
