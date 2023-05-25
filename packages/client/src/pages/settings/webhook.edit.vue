<template>
	<div class="_formRoot">
		<FormInput v-model="name" class="_formBlock">
			<template #label>Name</template>
		</FormInput>

		<FormInput v-model="url" type="url" class="_formBlock">
			<template #label>URL</template>
		</FormInput>

		<FormInput v-if="!discord_type" v-model="secret" class="_formBlock">
			<template #prefix><i class="ph-lock ph-bold ph-lg"></i></template>
			<template #label>Secret</template>
		</FormInput>
		<FormSwitch v-model="discord_type" class="_formBlock"
			>Discordで表示できる形式で送信</FormSwitch
		>

		<FormSection>
			<template #label>送信タイミング</template>

			<FormSwitch v-model="event_follow" class="_formBlock"
				>フォローされた時</FormSwitch
			>
			<FormSwitch v-model="event_followed" class="_formBlock"
				>フォロー成功時</FormSwitch
			>
			<FormSwitch v-model="event_note" class="_formBlock"
				>投稿時（自分）</FormSwitch
			>
			<FormSwitch v-model="event_reply" class="_formBlock"
				>リプライ受取時</FormSwitch
			>
			<FormSwitch v-model="event_renote" class="_formBlock"
				>RTされた時</FormSwitch
			>
			<FormSwitch v-model="event_reaction" class="_formBlock"
				>リアクションされた時</FormSwitch
			>
			<FormSwitch v-model="event_mention" class="_formBlock"
				>メンション受取時</FormSwitch
			>
		</FormSection>

		<FormSwitch v-model="active" class="_formBlock">有効化</FormSwitch>

		<div
			class="_formBlock"
			style="display: flex; gap: var(--margin); flex-wrap: wrap"
		>
			<FormButton primary inline @click="save"
				><i class="ph-check ph-bold ph-lg"></i>
				{{ i18n.ts.save }}</FormButton
			>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import FormInput from "@/components/form/input.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const props = defineProps<{
	webhookId: string;
}>();

const webhook = await os.api("i/webhooks/show", {
	webhookId: props.webhookId,
});

let name = $ref(webhook.name);
let url = $ref(webhook.url);
let secret = $ref(webhook.secret);
let active = $ref(webhook.active);

let discord_type = $ref(webhook.secret === "Discord");

let event_follow = $ref(webhook.on.includes("follow"));
let event_followed = $ref(webhook.on.includes("followed"));
let event_note = $ref(webhook.on.includes("note"));
let event_reply = $ref(webhook.on.includes("reply"));
let event_renote = $ref(webhook.on.includes("renote"));
let event_reaction = $ref(webhook.on.includes("reaction"));
let event_mention = $ref(webhook.on.includes("mention"));

async function save(): Promise<void> {
	const events = [];
	if (event_follow) events.push("follow");
	if (event_followed) events.push("followed");
	if (event_note) events.push("note");
	if (event_reply) events.push("reply");
	if (event_renote) events.push("renote");
	if (event_reaction) events.push("reaction");
	if (event_mention) events.push("mention");

	if (discord_type) secret = "Discord";

	os.apiWithDialog("i/webhooks/update", {
		name,
		url,
		secret,
		on: events,
		active,
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: "Edit webhook",
	icon: "ph-lightning ph-bold ph-lg",
});
</script>
