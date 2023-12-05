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
		<FormSwitch v-if="!slack_type" v-model="discord_type" class="_formBlock"
			>Discordに対応した形式で送信<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
		>
		<FormSwitch v-if="!discord_type" v-model="slack_type" class="_formBlock"
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
			<template v-if="event_antenna && antennas.length > 0">
				<FormSection>
					<template #label>送信するアンテナ<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
					<template v-for="(antenna,index) in antennas" :key="antenna.id" >
						<FormSwitch v-model="event_excludeAntennas[index]" class="_formBlock"
							>{{ antenna.name }}</FormSwitch
						>
					</template>
				</FormSection>
			</template>
		</FormSection>

		<div
			class="_formBlock"
			style="display: flex; gap: var(--margin); flex-wrap: wrap"
		>
			<FormButton primary inline @click="create"
				><i class="ph-check ph-bold ph-lg"></i>
				{{ i18n.ts.create }}</FormButton
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

const showMkkeySettingTips = $computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

let name = $ref("");
let url = $ref("");
let secret = $ref("");

let discord_type = $ref(false);
let slack_type = $ref(false);

let text_length = $ref("");

let event_follow = $ref(false);
let event_followed = $ref(true);
let event_note = $ref(false);
let event_reply = $ref(false);
let event_renote = $ref(true);
let event_reaction = $ref(true);
let event_mention = $ref(true);
let event_antenna = $ref(false);
let event_userMessage = $ref(true);
let event_groupMessage = $ref(true);
let event_groupMentionOnly = $ref(false);
let event_unfollow = $ref(false);

const antennasAll = await os.api("antennas/list") as Array<any>;
const antennas = $ref(antennasAll.filter((x) => x.notify));

let event_excludeAntennas = $ref(antennas.map((x) => true));

async function create(): Promise<void> {
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

	os.apiWithDialog("i/webhooks/create", {
		name,
		url,
		secret,
		on: events,
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: "Create new webhook",
	icon: "ph-lightning ph-bold ph-lg",
});
</script>
