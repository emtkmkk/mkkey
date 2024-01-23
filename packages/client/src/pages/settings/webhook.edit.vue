<template>
	<div class="_formRoot">
		<FormInput v-model="name" class="_formBlock">
			<template #label>Webhookの名前</template>
		</FormInput>

		<FormInput v-model="url" type="url" class="_formBlock">
			<template #label>送信先のURL</template>
		</FormInput>

		<FormInput v-if="!discord_type && !slack_type" v-model="secret" class="_formBlock">
			<template #prefix><i class="ph-lock ph-bold ph-lg"></i></template>
			<template #label>Secret</template>
		</FormInput>
		<FormSwitch :disabled="slack_type" v-model="discord_type" class="_formBlock"
			>Discordに対応した形式で送信<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
		>
		<FormSwitch :disabled="discord_type" v-model="slack_type" class="_formBlock"
			>Slackに対応した形式で送信<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
		>
		
		<FormInput v-if="discord_type || slack_type" v-model="text_length" class="_formBlock">
			<template #prefix><i class="ph-pencil-line ph-bold ph-lg"></i></template>
			<template #label>表示する本文の最大文字数<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
		</FormInput>

		<FormSection>
			<template #label>送信タイミング</template>

			<FormSwitch v-model="event_followed" class="_formBlock"
				>フォローされた時</FormSwitch
			>
			<FormSwitch v-model="event_mention" class="_formBlock"
				>呼びかけられた時</FormSwitch
			>
			<FormSwitch v-model="event_renote" class="_formBlock"
				>RTされた時</FormSwitch
			>
			<FormSwitch v-model="event_reaction" class="_formBlock"
				>リアクションされた時<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>
			<FormSwitch v-model="event_userMessage" class="_formBlock"
				>個人宛のチャット受信時<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>
			<FormSwitch v-model="event_groupMessage" class="_formBlock"
				>グループチャット受信時<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>
			<FormSwitch v-if="event_groupMessage" v-model="event_groupMentionOnly" class="_formBlock"
				>呼びかけられた時のみ<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>
			<FormSwitch v-model="event_note" class="_formBlock"
				>自分の投稿時</FormSwitch
			>
			<FormSwitch v-model="event_follow" class="_formBlock"
				>フォロー成功時</FormSwitch
			>
			<FormSwitch v-model="event_reply" class="_formBlock"
				>返信された時</FormSwitch
			>
			<FormSwitch v-if="$store.state.developer" v-model="event_unfollow" class="_formBlock"
				>【dev】フォロー解除された時<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>
			<FormSwitch :disabled="antennas.length <= 0" v-model="event_antenna" class="_formBlock"
				>アンテナ新着時<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>				
			<template v-if="event_antenna && antennas.length > 0 && event_excludeAntennas.length > 0">
				<FormSection>
					<template #label>送信するアンテナ<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
					<template v-for="(antenna,index) in antennas" :key="antenna.id" >
						<FormSwitch v-if="event_excludeAntennas.length > index" v-model="event_excludeAntennas[index]" class="_formBlock"
							>{{ antenna.name }}</FormSwitch
						>
					</template>
				</FormSection>
			</template>
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
import { defaultStore } from "@/store";

const props = defineProps<{
	webhookId: string;
}>();

const showMkkeySettingTips = $computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

const webhook = await os.api("i/webhooks/show", {
	webhookId: props.webhookId,
});

const antennasAll = await os.api("antennas/list", {mkkey: true});
const antennas = $ref(antennasAll.filter((x) => x.notify));

let name = $ref(webhook.name);
let url = $ref(webhook.url);
let secret = $ref(webhook.secret?.startsWith("Discord") || webhook.secret?.startsWith("Slack") ? "" : webhook.secret);
let active = $ref(webhook.active);

let discord_type = $ref(webhook.secret?.startsWith("Discord"));
let slack_type = $ref(webhook.secret?.startsWith("Slack"));

let text_length = $ref(webhook.secret?.startsWith("Discord") || webhook.secret?.startsWith("Slack") ? webhook.secret.replaceAll("Discord","").replaceAll("Slack","") : "");

let event_follow = $ref(webhook.on.includes("follow"));
let event_followed = $ref(webhook.on.includes("followed"));
let event_note = $ref(webhook.on.includes("note"));
let event_reply = $ref(webhook.on.includes("reply"));
let event_renote = $ref(webhook.on.includes("renote"));
let event_reaction = $ref(webhook.on.includes("reaction"));
let event_mention = $ref(webhook.on.includes("mention"));
let event_antenna = $ref(webhook.on.includes("antenna"));
let event_userMessage = $ref(webhook.on.includes("userMessage"));
let event_groupMessage = $ref(webhook.on.includes("groupMessage"));
let event_groupMentionOnly = $ref(webhook.on.includes("groupMentionOnly"));
let event_unfollow = $ref(webhook.on.includes("unfollow"));

let event_excludeAntennas = $ref(antennas.map((x) => !webhook.on.includes(`exclude-${x.id}`) ?? true));

async function save(): Promise<void> {
	const events = [];
	if (event_follow) events.push("follow");
	if (event_followed) events.push("followed");
	if (event_note) events.push("note");
	if (event_reply) events.push("reply");
	if (event_renote) events.push("renote");
	if (event_reaction) events.push("reaction");
	if (event_mention) events.push("mention");
	if (event_userMessage) events.push("userMessage");
	if (event_groupMessage) events.push("groupMessage");
	if (event_groupMentionOnly) events.push("groupMentionOnly");
	if (event_unfollow) events.push("unfollow");
	if (event_antenna) {
		events.push("antenna");
			event_excludeAntennas.forEach((x,index) => {
			if (!x){
				events.push(`exclude-${antennas[index].id}`);
			}
		});
	}

	if (discord_type) {
		if (text_length && isFinite(text_length)) {
			if (text_length > 1000) text_length = 1000;
			if (text_length < 0) text_length = 0;
			secret = `Discord${parseInt(text_length)}`;
		} else {
			secret = "Discord";
		}
	}

	if (slack_type) {
		if (text_length && isFinite(text_length)) {
			if (text_length > 1000) text_length = 1000;
			if (text_length < 0) text_length = 0;
			secret = `Slack${parseInt(text_length)}`;
		} else {
			secret = "Slack";
		}
	}

	os.apiWithDialog("i/webhooks/update", {
		webhookId: props.webhookId,
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
