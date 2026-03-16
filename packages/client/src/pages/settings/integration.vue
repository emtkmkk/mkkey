<template>
	<div class="_formRoot">
		<!-- 他設定画面と同様、FormSection は見出しのみ。パネルは中身のブロックに付与 -->
		<FormSection v-if="instance.enableGoogleIntegration">
			<template #label
				><i class="ph-google-logo ph-bold ph-lg"></i> Google</template
			>
			<div class="_formBlock _panel" style="padding: 1.25rem">
				<p v-if="integrations.google" class="_formBlock">
					{{ i18n.ts.connectedTo }}:
					<span>{{ integrations.google.email ?? integrations.google.name ?? integrations.google.id }}</span>
				</p>
				<MkButton
					v-if="integrations.google"
					danger
					class="_formBlock"
					@click="disconnectGoogle"
					>{{ i18n.ts.disconnectService }}</MkButton
				>
				<MkButton
					v-else
					primary
					class="_formBlock"
					@click="connectGoogle"
					>{{ i18n.ts.connectService }}</MkButton
				>
			</div>
		</FormSection>

		<FormSection v-if="instance.enableDiscordIntegration">
			<template #label
				><i class="ph-discord-logo ph-bold ph-lg"></i> Discord</template
			>
			<div class="_formBlock _panel" style="padding: 1.25rem">
				<p v-if="integrations.discord" class="_formBlock">
					{{ i18n.ts.connectedTo }}:
					<a
						:href="`https://discord.com/users/${integrations.discord.id}`"
						rel="nofollow noopener"
						target="_blank"
						>{{ discordHandle }}</a
					>
				</p>
				<MkButton
					v-if="integrations.discord"
					danger
					class="_formBlock"
					@click="disconnectDiscord"
					>{{ i18n.ts.disconnectService }}</MkButton
				>
				<MkButton
					v-else
					primary
					class="_formBlock"
					@click="connectDiscord"
					>{{ i18n.ts.connectService }}</MkButton
				>
			</div>
		</FormSection>

		<FormSection v-if="instance.enableGithubIntegration">
			<template #label
				><i class="ph-github-logo ph-bold ph-lg"></i> GitHub</template
			>
			<div class="_formBlock _panel" style="padding: 1.25rem">
				<p v-if="integrations.github" class="_formBlock">
					{{ i18n.ts.connectedTo }}:
					<a
						:href="`https://github.com/${integrations.github.login}`"
						rel="nofollow noopener"
						target="_blank"
						>@{{ integrations.github.login }}</a
					>
				</p>
				<MkButton
					v-if="integrations.github"
					danger
					class="_formBlock"
					@click="disconnectGithub"
					>{{ i18n.ts.disconnectService }}</MkButton
				>
				<MkButton
					v-else
					primary
					class="_formBlock"
					@click="connectGithub"
					>{{ i18n.ts.connectService }}</MkButton
				>
			</div>
		</FormSection>

		<FormSection v-if="instance.enableSwarmIntegration">
			<template #label><span class="swarm-icon" role="img" aria-hidden="true"></span> Swarm</template>
			<div class="_formBlock _panel" style="padding: 1.25rem">
				<p v-if="integrations.swarm?.accessToken" class="_formBlock">{{ i18n.ts.connectedTo }}: Swarm</p>
				<p v-else class="_formBlock">{{ i18n.ts.notConnected }}</p>
				<MkButton
					v-if="integrations.swarm?.accessToken"
					danger
					class="_formBlock"
					@click="disconnectSwarm"
					>{{ i18n.ts.disconnectService }}</MkButton
				>
				<MkButton
					v-else
					primary
					class="_formBlock"
					@click="connectSwarm"
					>{{ i18n.ts.connectService }}</MkButton
				>
				<FormSwitch
					:modelValue="showSwarmPostFormButton"
					:disabled="!integrations.swarm?.accessToken"
					class="_formBlock"
					@update:modelValue="updateSwarmPostFormButton"
				>
					{{ i18n.ts.showSwarmButtonInPostForm }}
				</FormSwitch>
				<FormSwitch
					:modelValue="swarmInsertShareUrl"
					:disabled="!integrations.swarm?.accessToken"
					class="_formBlock"
					@update:modelValue="updateSwarmInsertShareUrl"
				>
					{{ i18n.ts.insertSwarmShareUrl }}
				</FormSwitch>
			</div>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 * 連携設定ページ。Google / Discord / GitHub / Swarm の OAuth 連携と、
 * Swarm の投稿フォームボタン・共有URL挿入の設定を行う。
 * @internal
 */
import { computed, onMounted, ref, watch } from "vue";
import { apiUrl } from "@/config";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import MkButton from "@/components/MkButton.vue";
import { $i } from "@/account";
import { instance } from "@/instance";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import * as os from "@/os";

const twitterForm = ref<Window | null>(null);
const discordForm = ref<Window | null>(null);
const githubForm = ref<Window | null>(null);
const googleForm = ref<Window | null>(null);
const swarmForm = ref<Window | null>(null);

const integrations = computed(() => $i!.integrations as Record<string, any>);
const showSwarmPostFormButton = computed(
	() => integrations.value.swarm?.showPostFormButton ?? false,
);
const swarmInsertShareUrl = computed(
	() => integrations.value.swarm?.insertShareUrl ?? true,
);

const discordHandle = computed(() => {
	const discord = integrations.value.discord;
	if (!discord) return "";
	if (discord.discriminator === "0" || discord.discriminator === "0000") {
		return `@${discord.username}`;
	}
	return `@${discord.username}#${discord.discriminator}`;
});

function getCookieAttributes(maxAge?: number): string {
	const attrs = ["path=/", "SameSite=Lax"];
	if (maxAge !== undefined) {
		attrs.push(`max-age=${maxAge}`);
	}
	if (document.location.protocol.startsWith("https")) {
		attrs.push("Secure");
	}
	return attrs.join("; ");
}

function openWindow(service: string, type: string) {
	return window.open(
		`${apiUrl}/${type}/${service}`,
		`${service}_${type}_window`,
		"height=570, width=520"
	);
}

function connectTwitter() {
	twitterForm.value = openWindow("twitter", "connect");
}

function disconnectTwitter() {
	twitterForm.value = openWindow("twitter", "disconnect");
}

function connectDiscord() {
	discordForm.value = openWindow("discord", "connect");
}

function disconnectDiscord() {
	discordForm.value = openWindow("discord", "disconnect");
}

function connectGithub() {
	githubForm.value = openWindow("github", "connect");
}

function disconnectGithub() {
	githubForm.value = openWindow("github", "disconnect");
}

function connectGoogle() {
	googleForm.value = openWindow("google", "connect");
}

function disconnectGoogle() {
	googleForm.value = openWindow("google", "disconnect");
}

function connectSwarm() {
	swarmForm.value = openWindow("swarm", "connect");
}

function disconnectSwarm() {
	swarmForm.value = openWindow("swarm", "disconnect");
}

async function updateSwarmPostFormButton(value: boolean) {
	await os.api("i/swarm/update-settings", {
		showPostFormButton: value,
		insertShareUrl: swarmInsertShareUrl.value,
	});
}

async function updateSwarmInsertShareUrl(value: boolean) {
	await os.api("i/swarm/update-settings", {
		showPostFormButton: showSwarmPostFormButton.value,
		insertShareUrl: value,
	});
}

function closeIntegrationWindow(win: Window | null) {
	if (win) win.close();
}

onMounted(() => {
	document.cookie = `igi=${$i!.token}; ${getCookieAttributes(31536000)}`;

	watch(
		() => [
			integrations.value.twitter,
			integrations.value.discord,
			integrations.value.github,
			integrations.value.google,
			integrations.value.swarm,
		],
		([
			twitterIntegration,
			discordIntegration,
			githubIntegration,
			googleIntegration,
			swarmIntegration,
		], [
			previousTwitterIntegration,
			previousDiscordIntegration,
			previousGithubIntegration,
			previousGoogleIntegration,
			previousSwarmIntegration,
		]) => {
			if (twitterIntegration !== previousTwitterIntegration) {
				closeIntegrationWindow(twitterForm.value);
			}
			if (discordIntegration !== previousDiscordIntegration) {
				closeIntegrationWindow(discordForm.value);
			}
			if (githubIntegration !== previousGithubIntegration) {
				closeIntegrationWindow(githubForm.value);
			}
			if (googleIntegration !== previousGoogleIntegration) {
				closeIntegrationWindow(googleForm.value);
			}
			if (swarmIntegration !== previousSwarmIntegration) {
				closeIntegrationWindow(swarmForm.value);
			}
		},
	);
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.integration,
	icon: "ph-share-network ph-bold ph-lg",
});
</script>
