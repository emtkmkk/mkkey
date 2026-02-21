<template>
	<FormSuspense :p="init">
		<div class="_formRoot">
			<FormSwitch v-model="enableSwarmIntegration" class="_formBlock">
				<template #label>{{ i18n.ts.enable }}</template>
			</FormSwitch>

			<template v-if="enableSwarmIntegration">
				<FormInfo class="_formBlock"
					>Callback URL: {{ `${uri}/api/swarm/cb` }}</FormInfo
				>

				<FormInput v-model="swarmClientId" class="_formBlock">
					<template #prefix
						><i class="ph-key ph-bold ph-lg"></i
					></template>
					<template #label>Client ID</template>
				</FormInput>

				<FormInput v-model="swarmClientSecret" class="_formBlock">
					<template #prefix
						><i class="ph-key ph-bold ph-lg"></i
					></template>
					<template #label>Client Secret</template>
				</FormInput>
			</template>

			<FormButton primary class="_formBlock" @click="save"
				><i class="ph-floppy-disk-back ph-bold ph-lg"></i>
				{{ i18n.ts.save }}</FormButton
			>
		</div>
	</FormSuspense>
</template>

<script lang="ts" setup>
import {} from "vue";
import FormSwitch from "@/components/form/switch.vue";
import FormInput from "@/components/form/input.vue";
import FormButton from "@/components/MkButton.vue";
import FormInfo from "@/components/MkInfo.vue";
import FormSuspense from "@/components/form/suspense.vue";
import * as os from "@/os";
import { fetchInstance } from "@/instance";
import { i18n } from "@/i18n";

let uri: string = $ref("");
let enableSwarmIntegration: boolean = $ref(false);
let swarmClientId: string | null = $ref(null);
let swarmClientSecret: string | null = $ref(null);

async function init() {
	const meta = await os.api("admin/meta");
	uri = meta.uri;
	enableSwarmIntegration = meta.enableSwarmIntegration;
	swarmClientId = meta.swarmClientId;
	swarmClientSecret = meta.swarmClientSecret;
}

function save() {
	os.apiWithDialog("admin/update-meta", {
		enableSwarmIntegration,
		swarmClientId,
		swarmClientSecret,
	}).then(() => {
		fetchInstance();
	});
}
</script>
