<template>
	<div class="_formRoot">
		<FormSection>
			<template #label>{{ i18n.ts.emailAddress }}</template>
			<FormInput v-model="emailAddress" type="email" manual-save>
				<template #prefix
					><i class="ph-envelope-simple-open ph-bold ph-lg"></i
				></template>
				<template v-if="$i.email && !$i.emailVerified" #caption>{{
					i18n.ts.verificationEmailSent
				}}</template>
				<template
					v-else-if="emailAddress === $i.email && $i.emailVerified"
					#caption
					><i
						class="ph-check ph-bold ph-lg"
						style="color: var(--success)"
					></i>
					{{ i18n.ts.emailVerified }}</template
				>
			</FormInput>
		</FormSection>

		<FormSection>
			<FormSwitch
				:model-value="$i.receiveAnnouncementEmail"
				@update:modelValue="onChangeReceiveAnnouncementEmail"
			>
				{{ i18n.ts.receiveAnnouncementFromInstance }}
			</FormSwitch>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import FormSection from "@/components/form/section.vue";
import FormInput from "@/components/form/input.vue";
import FormSwitch from "@/components/form/switch.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const emailAddress = ref($i!.email);

const onChangeReceiveAnnouncementEmail = (v) => {
	os.api("i/update", {
		receiveAnnouncementEmail: v,
	});
};

const saveEmailAddress = () => {
	os.inputText({
		title: i18n.ts.password,
		type: "password",
	}).then(({ canceled, result: password }) => {
		if (canceled) return;
		os.apiWithDialog("i/update-email", {
			password: password,
			email: emailAddress.value,
		});
	});
};

onMounted(() => {
	watch(emailAddress, () => {
		saveEmailAddress();
	});
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.email,
	icon: "ph-envelope-simple-open ph-bold ph-lg",
});
</script>
