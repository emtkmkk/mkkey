<template>
	<div class="_formRoot">
		<MkTab v-model="tab" style="margin-bottom: var(--margin)">
			<option value="rnmute">{{ i18n.ts.rnMutedUsers }}</option>
			<option value="followblock">
				{{ i18n.ts.followBlockedUsers }}
			</option>
			<option value="mute">{{ i18n.ts.mutedUsers }}</option>
			<option value="block">{{ i18n.ts.blockedUsers }}</option>
		</MkTab>
		<div v-if="tab === 'rnmute'">
			<MkPagination :pagination="renotemutingPagination" class="muting">
				<template #empty
					><FormInfo>{{ i18n.ts.noUsers }}</FormInfo></template
				>
				<template #default="{ items }">
					<FormLink
						v-for="mute in items"
						:key="mute.id"
						:to="userPage(mute.mutee)"
					>
						<MkAcct :user="mute.mutee" />
					</FormLink>
				</template>
			</MkPagination>
		</div>
		<div v-if="tab === 'followblock'">
			<MkPagination
				:pagination="followblockingPagination"
				class="blocking"
			>
				<template #empty
					><FormInfo>{{ i18n.ts.noUsers }}</FormInfo></template
				>
				<template #default="{ items }">
					<FormLink
						v-for="block in items"
						:key="block.id"
						:to="userPage(block.blockee)"
					>
						<MkAcct :user="block.blockee" />
					</FormLink>
				</template>
			</MkPagination>
		</div>
		<div v-if="tab === 'mute'">
			<MkPagination :pagination="mutingPagination" class="muting">
				<template #empty
					><FormInfo>{{ i18n.ts.noUsers }}</FormInfo></template
				>
				<template #default="{ items }">
					<FormLink
						v-for="mute in items"
						:key="mute.id"
						:to="userPage(mute.mutee)"
					>
						<MkAcct :user="mute.mutee" />
					</FormLink>
				</template>
			</MkPagination>
		</div>
		<div v-if="tab === 'block'">
			<MkPagination :pagination="blockingPagination" class="blocking">
				<template #empty
					><FormInfo>{{ i18n.ts.noUsers }}</FormInfo></template
				>
				<template #default="{ items }">
					<FormLink
						v-for="block in items"
						:key="block.id"
						:to="userPage(block.blockee)"
					>
						<MkAcct :user="block.blockee" />
					</FormLink>
				</template>
			</MkPagination>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import MkPagination from "@/components/MkPagination.vue";
import MkTab from "@/components/MkTab.vue";
import FormInfo from "@/components/MkInfo.vue";
import FormLink from "@/components/form/link.vue";
import { userPage } from "@/filters/user";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

let tab = $ref("rnmute");

const mutingPagination = {
	endpoint: "mute/list" as const,
	limit: 10,
};

const renotemutingPagination = {
	endpoint: "renote-mute/list" as const,
	limit: 10,
};

const followblockingPagination = {
	endpoint: "follow-blocking/list" as const,
	limit: 10,
};

const blockingPagination = {
	endpoint: "blocking/list" as const,
	limit: 10,
};

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.muteAndBlock,
	icon: "ph-prohibit ph-bold ph-lg",
});
</script>
