<template>
	<div class="_formRoot">
		<MkTab v-model="tab" class="_formBlock">
			<option value="soft">{{ i18n.ts._wordMute.soft }}</option>
			<option value="hard">{{ i18n.ts._wordMute.hard }}</option>
			<option value="reaction">{{ i18n.ts._wordMute.emojiMutes }}</option>
		</MkTab>
		<MkButton primary inline :disabled="!changed" @click="save()"
			><i class="ph-floppy-disk-back ph-bold ph-lg"></i>
			{{ i18n.ts.save }}</MkButton
		>
		<div class="_formBlock">
			<div v-show="tab === 'soft'">
				<MkInfo class="_formBlock">{{
					i18n.ts._wordMute.softDescription
				}}</MkInfo>
				<FormTextarea v-model="softMutedWords" class="_formBlock">
					<span>{{ i18n.ts._wordMute.muteWords }}</span>
					<template #caption
						>{{ i18n.ts._wordMute.muteWordsDescription }}<br />{{
							i18n.ts._wordMute.muteWordsDescription2
						}}</template
					>
				</FormTextarea>
				<FormSwitch v-model="hiddenSoftMutes" class="_formBlock"
					>{{ i18n.ts.hiddenSoftMutes
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></FormSwitch
				>
				<FormSwitch v-model="muteExcludeReplyQuote" class="_formBlock"
					>{{ i18n.ts.muteExcludeReplyQuote
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></FormSwitch
				>
				<FormSwitch v-model="muteExcludeNotification" class="_formBlock"
					>{{ i18n.ts.muteExcludeNotification
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></FormSwitch
				>
			</div>
			<div v-show="tab === 'hard'">
				<MkInfo class="_formBlock"
					>{{ i18n.ts._wordMute.hardDescription }}
					{{ i18n.ts.reflectMayTakeTime }}</MkInfo
				>
				<FormTextarea v-model="hardMutedWords" class="_formBlock">
					<span>{{ i18n.ts._wordMute.muteWords }}</span>
					<template #caption
						>{{ i18n.ts._wordMute.muteWordsDescription }}<br />{{
							i18n.ts._wordMute.muteWordsDescription2
						}}</template
					>
				</FormTextarea>
				<MkKeyValue
					v-if="hardWordMutedNotesCount != null"
					class="_formBlock"
				>
					<template #key>{{ i18n.ts._wordMute.mutedNotes }}</template>
					<template #value>{{
						number(hardWordMutedNotesCount)
					}}</template>
				</MkKeyValue>
			</div>
			<div v-show="tab === 'reaction'">
				<MkInfo class="_formBlock"
					>{{ i18n.ts._wordMute.emojiMutesDescription
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></MkInfo
				>
				<FormTextarea v-model="reactionMutedWords" class="_formBlock">
					<span>{{ i18n.ts._wordMute.muteWords }}</span>
					<template #caption
						>{{ i18n.ts._wordMute.reactionMuteWordsDescription
						}}<br />{{
							i18n.ts._wordMute.reactionMuteWordsDescription2
						}}</template
					>
				</FormTextarea>
				<FormSwitch v-model="remoteReactionMute" class="_formBlock"
					>{{ i18n.ts.remoteReactionMute
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></FormSwitch
				>
			</div>
		</div>
		<MkButton primary inline :disabled="!changed" @click="save()"
			><i class="ph-floppy-disk-back ph-bold ph-lg"></i>
			{{ i18n.ts.save }}</MkButton
		>
		<br />
		<div
			v-show="tab === 'soft'"
			class="description"
			style="white-space: pre-line"
		>
			<br /><span v-if="showMkkeySettingTips" class="_beta">{{
				i18n.ts.mkkey
			}}</span
			>{{ i18n.ts._wordMute.muteWordsDescription3 }}
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import FormTextarea from "@/components/form/textarea.vue";
import FormSwitch from "@/components/form/switch.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkTab from "@/components/MkTab.vue";
import * as os from "@/os";
import number from "@/filters/number";
import { defaultStore } from "@/store";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const render = (mutedWords) =>
	mutedWords
		.map((x) => {
			if (Array.isArray(x)) {
				return x.join(" ");
			} else {
				return x;
			}
		})
		.join("\n");

const showMkkeySettingTips = $computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

const tab = ref("soft");
const softMutedWords = ref(render(defaultStore.state.mutedWords));
const hardMutedWords = ref(render($i!.mutedWords));
const reactionMutedWords = ref(render(defaultStore.state.reactionMutedWords));
const remoteReactionMute = computed(
	defaultStore.makeGetterSetter("remoteReactionMute")
);
const hardWordMutedNotesCount = ref(null);
const hiddenSoftMutes = computed(
	defaultStore.makeGetterSetter("hiddenSoftMutes")
);
const muteExcludeReplyQuote = computed(
	defaultStore.makeGetterSetter("muteExcludeReplyQuote")
);
const muteExcludeNotification = computed(
	defaultStore.makeGetterSetter("muteExcludeNotification")
);
const changed = ref(false);

os.api("i/get-word-muted-notes-count", {}).then((response) => {
	hardWordMutedNotesCount.value = response?.count;
});

watch(softMutedWords, () => {
	changed.value = true;
});

watch(hardMutedWords, () => {
	changed.value = true;
});

watch(reactionMutedWords, () => {
	changed.value = true;
});

async function save() {
	const parseMutes = (mutes, tab) => {
		// split into lines, remove empty lines and unnecessary whitespace
		let lines = mutes
			.trim()
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "");

		// check each line if it is a RegExp or not
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const regexp = line.match(/^\/(.+)\/(.*)$/);
			if (regexp) {
				// check that the RegExp is valid
				try {
					new RegExp(regexp[1], regexp[2]);
					// note that regex lines will not be split by spaces!
				} catch (err: any) {
					// invalid syntax: do not save, do not reset changed flag
					os.alert({
						type: "error",
						title: i18n.ts.regexpError,
						text:
							i18n.t("regexpErrorDescription", {
								tab,
								line: i + 1,
							}) +
							"\n" +
							err.toString(),
					});
					// re-throw error so these invalid settings are not saved
					throw err;
				}
			} else {
				lines[i] = line.split(" ");
			}
		}

		return lines;
	};

	const parseMutesSimple = (mutes, tab) => {
		// split into lines, remove empty lines and unnecessary whitespace
		return mutes
			.trim()
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "");
	};

	let softMutes, hardMutes, reactionMutes;
	try {
		softMutes = parseMutes(softMutedWords.value, i18n.ts._wordMute.soft);
		hardMutes = parseMutes(hardMutedWords.value, i18n.ts._wordMute.hard);
		reactionMutes = parseMutesSimple(
			reactionMutedWords.value,
			i18n.ts.reaction
		);
	} catch (err) {
		// already displayed error message in parseMutes
		return;
	}

	defaultStore.set("mutedWords", softMutes);
	defaultStore.set("reactionMutedWords", reactionMutes);
	await os.api("i/update", {
		mutedWords: hardMutes,
	});

	changed.value = false;
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.wordMute,
	icon: "ph-speaker-x ph-bold ph-lg",
});
</script>
