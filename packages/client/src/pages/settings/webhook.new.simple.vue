<template>
	<div class="_formRoot">
	<FormSection>
	
		<FormInput v-model="name" class="_formBlock">
			<template #label>サーバー名(任意)</template>
		</FormInput>
		
		<FormInput v-model="url" type="url" class="_formBlock">
			<template #label>Discord ウェブフック URL</template>
		</FormInput>
		
		<div>自身しか所属していないサーバーを作成し、
		任意のチャンネルの設定にて、ウェブフックを作成
		ウェブフックURLをコピーし、上の欄に貼り付けてください。</div>
		
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

let name = $ref("");
let url = $ref("");
let secret = $ref("");

let discord_type = $ref(true);

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

const antennasAll = await os.api("antennas/list", {mkkey: true}) as Array<any>;
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
	
	const match = /^https:\/\/discord.com\/api\/webhooks\/(.*?)\/(.*?)$/.exec(url);
	
	let webhookName = name || "Discord";
	
	if (match) webhookName = `${webhookName}-${match[1].slice(0, 6)}-${match[2].slice(0, 6)}`

	os.apiWithDialog("i/webhooks/create", {
		name: webhookName,
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
