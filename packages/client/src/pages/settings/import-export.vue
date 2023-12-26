<template>
	<div class="_formRoot">
		<FormSection>
			<template #label>{{
				i18n.ts._exportOrImport.emojiDeckList
			}}<span v-if="defaultStore.state.showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.export }}</template>
				<template #icon
					><i class="ph-download-simple ph-bold ph-lg"></i
				></template>
				<FormRadios v-model="exportDeckType" class="_formBlock">
					<option value="1">{{ defaultStore.state.reactionsFolderName || "1ページ目" }}</option>
					<option value="2">{{ defaultStore.state.reactionsFolderName2 || "2ページ目" }}</option>
					<option value="3">{{ defaultStore.state.reactionsFolderName3 || "3ページ目" }}</option>
					<option value="4">{{ defaultStore.state.reactionsFolderName4 || "4ページ目" }}</option>
					<option value="5">{{ defaultStore.state.reactionsFolderName5 || "5ページ目" }}</option>
				</FormRadios>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="exportEmojiDecks($event)"
					><i class="ph-download-simple ph-bold ph-lg"></i>
					{{ i18n.ts.export }}</MkButton
				>
			</FormFolder>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.import }}</template>
				<template #icon
					><i class="ph-upload-simple ph-bold ph-lg"></i
				></template>
				<FormRadios v-model="importDeckType" class="_formBlock">
					<option value="1">{{ defaultStore.state.reactionsFolderName || "1ページ目" }}</option>
					<option value="2">{{ defaultStore.state.reactionsFolderName2 || "2ページ目" }}</option>
					<option value="3">{{ defaultStore.state.reactionsFolderName3 || "3ページ目" }}</option>
					<option value="4">{{ defaultStore.state.reactionsFolderName4 || "4ページ目" }}</option>
					<option value="5">{{ defaultStore.state.reactionsFolderName5 || "5ページ目" }}</option>
				</FormRadios>
				<FormInput
					v-model="importServerName"
					class="_formBlock"
					:small="true"
					:placeholder="config.host"
					style="margin: 0 0 !important"
				>
					<template #label>{{ `インポートしたいサーバ(misskey.ioなど)` }}</template>
					<template #caption>{{ importServerName ? "下のリンクのアクセス可能な方にアクセスし、「値(JSON)」の内容をすべてコピーして下のテキストボックスに貼り付けてください。" : "インポート先のサーバ名を入力してください。" }}</template>
				</FormInput>
				<MkButton
					v-if="importServerName"
					inline
					@click="window.open(`https://${importServerName}/registry/value/@/client/base/reactions`);"
				>
				{{ "1" }}
				</MkButton>
				<MkButton
					v-if="importServerName"
					inline
					@click="window.open(`https://${importServerName}/registry/value/system/client/base/reactions`);"
				>
				{{ "2" }}
				</MkButton>
				<FormTextarea v-model="code" tall class="_formBlock">
					<template #label>{{ i18n.ts.code }}</template>
				</FormTextarea>
				<MkButton
					primary
					:disabled="code == null"
					:class="$style.button"
					inline
					@click="importEmojiDecks($event)"
					><i class="ph-upload-simple ph-bold ph-lg"></i>
					{{ i18n.ts.import }}</MkButton
				>
			</FormFolder>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts._exportOrImport.allNotes }}</template>
			<FormFolder>
				<template #label>{{ i18n.ts.export }}</template>
				<template #icon
					><i class="ph-download-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="exportNotes()"
					><i class="ph-download-simple ph-bold ph-lg"></i>
					{{ i18n.ts.export }}</MkButton
				>
			</FormFolder>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.import }}</template>
				<template #icon
					><i class="ph-upload-simple ph-bold ph-lg"></i
				></template>
				<FormRadios v-model="importType" class="_formBlock">
					<option value="calckey">Calckey/Misskey</option>
					<option value="mastodon">
						Mastodon/Akkoma/Pleroma (only outbox.json)
					</option>
					<option :disabled="true" value="twitter">
						Twitter (soon)
					</option>
				</FormRadios>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="importPosts($event)"
					><i class="ph-upload-simple ph-bold ph-lg"></i>
					{{ i18n.ts.import }}</MkButton
				>
			</FormFolder>
		</FormSection>
		<FormSection>
			<template #label>{{
				i18n.ts._exportOrImport.followingList
			}}</template>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.export }}</template>
				<template #icon
					><i class="ph-download-simple ph-bold ph-lg"></i
				></template>
				<FormSwitch v-model="excludeMutingUsers" class="_formBlock">
					{{ i18n.ts._exportOrImport.excludeMutingUsers }}
				</FormSwitch>
				<FormSwitch v-model="excludeInactiveUsers" class="_formBlock">
					{{ i18n.ts._exportOrImport.excludeInactiveUsers }}
				</FormSwitch>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="exportFollowing()"
					><i class="ph-download-simple ph-bold ph-lg"></i>
					{{ i18n.ts.export }}</MkButton
				>
			</FormFolder>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.import }}</template>
				<template #icon
					><i class="ph-upload-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="importFollowing($event)"
					><i class="ph-upload-simple ph-bold ph-lg"></i>
					{{ i18n.ts.import }}</MkButton
				>
			</FormFolder>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts._exportOrImport.userLists }}</template>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.export }}</template>
				<template #icon
					><i class="ph-download-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="exportUserLists()"
					><i class="ph-download-simple ph-bold ph-lg"></i>
					{{ i18n.ts.export }}</MkButton
				>
			</FormFolder>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.import }}</template>
				<template #icon
					><i class="ph-upload-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="importUserLists($event)"
					><i class="ph-upload-simple ph-bold ph-lg"></i>
					{{ i18n.ts.import }}</MkButton
				>
			</FormFolder>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts._exportOrImport.muteList }}</template>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.export }}</template>
				<template #icon
					><i class="ph-download-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="exportMuting()"
					><i class="ph-download-simple ph-bold ph-lg"></i>
					{{ i18n.ts.export }}</MkButton
				>
			</FormFolder>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.import }}</template>
				<template #icon
					><i class="ph-upload-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="importMuting($event)"
					><i class="ph-upload-simple ph-bold ph-lg"></i>
					{{ i18n.ts.import }}</MkButton
				>
			</FormFolder>
		</FormSection>
		<FormSection>
			<template #label>{{
				i18n.ts._exportOrImport.blockingList
			}}</template>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.export }}</template>
				<template #icon
					><i class="ph-download-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="exportBlocking()"
					><i class="ph-download-simple ph-bold ph-lg"></i>
					{{ i18n.ts.export }}</MkButton
				>
			</FormFolder>
			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.import }}</template>
				<template #icon
					><i class="ph-upload-simple ph-bold ph-lg"></i
				></template>
				<MkButton
					primary
					:class="$style.button"
					inline
					@click="importBlocking($event)"
					><i class="ph-upload-simple ph-bold ph-lg"></i>
					{{ i18n.ts.import }}</MkButton
				>
			</FormFolder>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import MkButton from "@/components/MkButton.vue";
import FormSection from "@/components/form/section.vue";
import FormFolder from "@/components/form/folder.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormRadios from "@/components/form/radios.vue";
import FormTextarea from "@/components/form/textarea.vue";
import FormInput from "@/components/form/input.vue";
import * as os from "@/os";
import { selectFile } from "@/scripts/select-file";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { instance } from "@/instance";
import { defaultStore } from "@/store";
import * as config from "@/config";

const excludeMutingUsers = ref(false);
const importType = ref("calckey");
const excludeInactiveUsers = ref(false);
const exportDeckType = ref("1");
const importDeckType = ref("1");
const code = ref<string>();
const importServerName = ref<string>();

const deckType = {"1":"reactions", "2":"reactions2", "3":"reactions3", "4":"reactions4", "5":"reactions5"};

const href = $computed(() => {
	return URL.createObjectURL(
		new Blob([JSON.stringify(defaultStore.state[deckType[exportDeckType.value]], null, 2)], {
			type: "application/json",
		})
	)
});

const name = $computed(() => {
	switch (exportDeckType.value) {
		case "1":
			return defaultStore.state.reactionsFolderName || "page1";
		case "2":
			return defaultStore.state.reactionsFolderName2 || "page2";
		case "3":
			return defaultStore.state.reactionsFolderName3 || "page3";
		case "4":
			return defaultStore.state.reactionsFolderName4 || "page4";
		case "5":
			return defaultStore.state.reactionsFolderName5 || "page5";
		default:
			return "reactions"
	}
	
});

const onExportSuccess = () => {
	os.alert({
		type: "info",
		text: i18n.ts.exportRequested,
	});
};

const onImportSuccess = () => {
	os.alert({
		type: "info",
		text: i18n.ts.importRequested,
	});
};

const onError = (ev) => {
	os.alert({
		type: "error",
		text: ev.message,
	});
};

const exportNotes = () => {
	os.api("i/export-notes", {}).then(onExportSuccess).catch(onError);
};

const importPosts = async (ev) => {
	const file = await selectFile(ev.currentTarget ?? ev.target);
	os.api("i/import-posts", {
		fileId: file.id,
		signatureCheck: importType.value === "mastodon" ? true : false,
	})
		.then(onImportSuccess)
		.catch(onError);
};

const exportFollowing = () => {
	os.api("i/export-following", {
		excludeMuting: excludeMutingUsers.value,
		excludeInactive: excludeInactiveUsers.value,
	})
		.then(onExportSuccess)
		.catch(onError);
};

const exportBlocking = () => {
	os.api("i/export-blocking", {}).then(onExportSuccess).catch(onError);
};

const exportUserLists = () => {
	os.api("i/export-user-lists", {}).then(onExportSuccess).catch(onError);
};

const exportMuting = () => {
	os.api("i/export-mute", {}).then(onExportSuccess).catch(onError);
};

const importFollowing = async (ev) => {
	const file = await selectFile(ev.currentTarget ?? ev.target);
	os.api("i/import-following", { fileId: file.id })
		.then(onImportSuccess)
		.catch(onError);
};

const importUserLists = async (ev) => {
	const file = await selectFile(ev.currentTarget ?? ev.target);
	os.api("i/import-user-lists", { fileId: file.id })
		.then(onImportSuccess)
		.catch(onError);
};

const importMuting = async (ev) => {
	const file = await selectFile(ev.currentTarget ?? ev.target);
	os.api("i/import-muting", { fileId: file.id })
		.then(onImportSuccess)
		.catch(onError);
};

const importBlocking = async (ev) => {
	const file = await selectFile(ev.currentTarget ?? ev.target);
	os.api("i/import-blocking", { fileId: file.id })
		.then(onImportSuccess)
		.catch(onError);
};

const exportEmojiDecks = (ev) => {
	const a = document.createElement("a");
	a.href = href;
	a.download = `${name}.json`;
	a.click();
}

const importEmojiDecks = (ev) => {
	try {
		if (!code.value) return;
		let parsedData;
		try {
			parsedData = JSON.parse(code.value);
		} catch (parseError) {
			onError(parseError);
			return;
		}

		// ② JSONでパースできたら、文字列型の配列かどうかを確認
		if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'string')) {
			let customEmojis = $computed(() =>
				instance.emojis
			);
			let emojiStr = $computed(() =>
				customEmojis ? customEmojis.map((x) => `:${x.name}:`) : undefined
			);
			let deck = [...defaultStore.state[deckType[exportDeckType.value]]]
			parsedData.forEach((x) => {
				if (!x.startsWith(":") || !x.endsWith(":")) {
					if (!deck.includes(x) && [...x].length === 1) {
						deck.push(x);
					}
				}
				const emojiName = x.split("@")?.[0]?.replaceAll(":", "");
				const emojiHost = x.split("@")?.[1]?.replaceAll(":", "");
				if (emojiStr.includes(x) || emojiHost === config.host) {
					if (!deck.includes(`:${emojiName}:`)) {
						deck.push(`:${emojiName}:`);
					}
					return;
				}
				if (emojiHost) {
					if (!deck.includes(`:${emojiName}@${emojiHost}:`)) {
						deck.push(`:${emojiName}@${emojiHost}:`);
					}
					return;
				}
				if (importServerName.value === config.host || !importServerName.value) {
					if (!deck.includes(`:${emojiName}:`)) {
						deck.push(`:${emojiName}:`);
					}
					return;
				}
				if (!deck.includes(`:${emojiName}@${importServerName.value}:`)) {
					deck.push(`:${emojiName}@${emojiHost}:`);
				}
			})
			defaultStore.set(deckType[exportDeckType.value], deck);
			onImportSuccess(); // 成功時の処理
		} else {
			onError(new Error("Invalid data format. Expected an array of strings."));
		}
	} catch (error) {
		onError(error);
	}
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.importAndExport,
	icon: "ph-package ph-bold ph-lg",
});
</script>

<style module>
.button {
	margin-right: 16px;
}
</style>
