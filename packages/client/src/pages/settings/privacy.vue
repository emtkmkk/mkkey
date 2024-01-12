<template>
	<div class="_formRoot">
		<FormSwitch
			v-model="isLocked"
			:disabled="isRemoteLocked"
			class="_formBlock"
			@update:modelValue="save()"
			>{{ i18n.ts.makeFollowManuallyApprove
			}}<template #caption>{{
				i18n.ts.lockedAccountInfo
			}}</template></FormSwitch
		>
		<FormSwitch
			v-model="isRemoteLocked"
			:disabled="!(!isLocked && !blockPostNotLocal)"
			class="_formBlock"
			@update:modelValue="save()"
			>{{ i18n.ts.makeFollowManuallyApproveToRemote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
				i18n.ts.lockedAccountToRemoteInfo
			}}</template></FormSwitch
		>
		<FormSwitch
			:disabled="!(isLocked || isRemoteLocked || blockPostNotLocal)"
			v-model="autoAcceptFollowed"
			class="_formBlock"
			@update:modelValue="save()"
			>{{ i18n.ts.autoAcceptFollowed }}</FormSwitch
		>
		<FormSwitch
			:disabled="!(isLocked || isRemoteLocked || blockPostNotLocal)"
			v-model="isSilentLocked"
			class="_formBlock"
			@update:modelValue="save()"
			>{{ i18n.ts.makeFollowManuallyApproveSilent
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
				i18n.ts.lockedAccountInfoSilent
			}}</template></FormSwitch
		>

		<FormSection>
			<FormSwitch
				v-model="blockPostPublic"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.blockPostPublic
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
					i18n.ts.blockPostPublicDescription
				}}</template></FormSwitch
			>
			<FormSwitch
				v-model="blockPostHome"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.blockPostHome
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
					i18n.ts.blockPostHomeDescription
				}}</template></FormSwitch
			>
			<FormSwitch
				v-model="blockPostNotLocal"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.blockPostNotLocal
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
					i18n.ts.blockPostNotLocalDescription
				}}</template></FormSwitch
			>
			<FormSwitch
				v-model="blockPostNotLocalPublic"
				:disabled="!blockPostNotLocal"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.blockPostNotLocalPublic
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
					i18n.ts.blockPostNotLocalPublicDescription
				}}</template></FormSwitch
			>
		</FormSection>

		<FormSwitch
			v-model="publicReactions"
			class="_formBlock"
			@update:modelValue="save()"
		>
			{{ i18n.ts.makeReactionsPublic }}
			<template #caption>{{
				i18n.ts.makeReactionsPublicDescription
			}}</template>
		</FormSwitch>

		<FormSelect
			v-model="ffVisibility"
			class="_formBlock"
			@update:modelValue="save()"
		>
			<template #label>{{ i18n.ts.ffVisibility }}</template>
			<option value="public">{{ i18n.ts._ffVisibility.public }}</option>
			<option value="followers">
				{{ i18n.ts._ffVisibility.followers }}
			</option>
			<option value="private">{{ i18n.ts._ffVisibility.private }}</option>
			<template #caption>{{ i18n.ts.ffVisibilityDescription }}</template>
		</FormSelect>

		<FormSwitch
			v-model="noCrawle"
			class="_formBlock"
			@update:modelValue="save()"
		>
			{{ i18n.ts.noCrawle }}
			<template #caption>{{ i18n.ts.noCrawleDescription }}</template>
		</FormSwitch>
		<FormSwitch v-model="preventAiLearning" @update:model-value="save()">
			{{ i18n.ts.preventAiLearning }}<span class="_beta">{{ i18n.ts.beta }}</span>
			<template #caption>{{ i18n.ts.preventAiLearningDescription }}</template>
		</FormSwitch>
		<FormSwitch
			v-model="isExplorable"
			class="_formBlock"
			@update:modelValue="save()"
		>
			{{ i18n.ts.makeExplorable }}
			<template #caption>{{
				i18n.ts.makeExplorableDescription
			}}</template>
		</FormSwitch>
		<FormSwitch
			v-model="isRemoteBlockExplorable"
			:disabled="!isExplorable"
			class="_formBlock"
			@update:modelValue="save()"
		>
			{{ i18n.ts.makeNotExplorableRemote }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			<template #caption>{{
				i18n.ts.makeNotExplorableRemoteDescription
			}}</template>
		</FormSwitch>

		<FormSection>
			<FormSwitch
				v-model="rememberNoteVisibility"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.rememberNoteVisibility }}</FormSwitch
			>
			<FormFolder v-if="!rememberNoteVisibility" class="_formBlock">
				<template #label>{{ i18n.ts.defaultNoteVisibility }}</template>
				<template v-if="defaultNoteVisibility === 'public'" #suffix>{{
					i18n.ts._visibility.public
				}}</template>
				<template
					v-else-if="defaultNoteVisibility === 'home'"
					#suffix
					>{{ i18n.ts._visibility.home }}</template
				>
				<template
					v-else-if="defaultNoteVisibility === 'followers'"
					#suffix
					>{{ i18n.ts._visibility.followers }}</template
				>
				<template
					v-else-if="defaultNoteVisibility === 'specified'"
					#suffix
					>{{ i18n.ts._visibility.specified }}</template
				>

				<FormSelect v-model="defaultNoteVisibility" class="_formBlock">
					<option value="public">
						{{ i18n.ts._visibility.public }}
					</option>
					<option value="home">{{ i18n.ts._visibility.home }}</option>
					<option value="followers">
						{{ i18n.ts._visibility.followers }}
					</option>
					<option value="specified">
						{{ i18n.ts._visibility.specified }}
					</option>
				</FormSelect>
				<FormSwitch v-model="defaultNoteLocalAndFollower" class="_formBlock">{{
					i18n.ts._visibility.localAndFollower
				}}</FormSwitch>
				<FormSwitch v-model="defaultNoteLocalOnly" class="_formBlock">{{
					i18n.ts._visibility.localOnlyChannel
				}}</FormSwitch>
				<br />
				<FormSwitch v-model="firstPostButtonVisibilityForce" class="_formBlock">{{
					i18n.ts.firstPostButtonVisibilityForce
				}}</FormSwitch>
			</FormFolder>

			<FormFolder class="_formBlock">
				<template #label>{{ i18n.ts.secondPostButton }}</template>
				<template v-if="secondPostButton == false" #suffix>{{
					i18n.ts.buttonNone
				}}</template>
				<template v-if="secondPostButton == true && secondPostVisibility === 'public'" #suffix>{{
					i18n.ts._visibility.public
				}}</template>
				<template
					v-else-if="secondPostButton == true && secondPostVisibility === 'l-public'"
					#suffix
					>{{ i18n.ts._visibility.localAndFollower }}</template
				>
				<template
					v-else-if="secondPostButton == true && secondPostVisibility === 'home'"
					#suffix
					>{{ i18n.ts._visibility.home }}</template
				>
				<template
					v-else-if="secondPostButton == true && secondPostVisibility === 'l-home'"
					#suffix
					>{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}</template
				>
				<template
					v-else-if="secondPostButton == true && secondPostVisibility === 'followers'"
					#suffix
					>{{ i18n.ts._visibility.followers }}</template
				>
				<template
					v-else-if="secondPostButton == true && secondPostVisibility === 'specified'"
					#suffix
					>{{ i18n.ts._visibility.specified }}</template
				>

				<FormSwitch v-model="secondPostButton" class="_formBlock">{{
					i18n.ts.secondPostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
				<FormSwitch v-if="secondPostButton" v-model="firstPostWideButton" class="_formBlock">{{
					i18n.ts.wideFirstPostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
				<FormSwitch v-if="secondPostButton" v-model="secondPostWideButton" class="_formBlock">{{
					i18n.ts.widePostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

				<FormSelect v-model="secondPostVisibility" class="_formBlock">
					<option value="public">
						{{ i18n.ts._visibility.public }}
					</option>
					<option value="l-public">
						{{ i18n.ts._visibility.localAndFollower }}
					</option>
					<option value="home">
						{{ i18n.ts._visibility.home }}
					</option>
					<option value="l-home">
						{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}
					</option>
					<option value="followers">
						{{ i18n.ts._visibility.followers }}
					</option>
					<option value="specified">
						{{ i18n.ts._visibility.specified }}
					</option>
				</FormSelect>
			</FormFolder>
			<FormFolder v-if="secondPostButton" class="_formBlock">
				<template #label>{{ i18n.ts.thirdPostButton }}</template>
				<template v-if="thirdPostButton == false" #suffix>{{
					i18n.ts.buttonNone
				}}</template>
				<template v-if="thirdPostButton == true && thirdPostVisibility === 'public'" #suffix>{{
					i18n.ts._visibility.public
				}}</template>
				<template
					v-else-if="thirdPostButton == true && thirdPostVisibility === 'l-public'"
					#suffix
					>{{ i18n.ts._visibility.localAndFollower }}</template
				>
				<template
					v-else-if="thirdPostButton == true && thirdPostVisibility === 'home'"
					#suffix
					>{{ i18n.ts._visibility.home }}</template
				>
				<template
					v-else-if="thirdPostButton == true && thirdPostVisibility === 'l-home'"
					#suffix
					>{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}</template
				>
				<template
					v-else-if="thirdPostButton == true && thirdPostVisibility === 'followers'"
					#suffix
					>{{ i18n.ts._visibility.followers }}</template
				>
				<template
					v-else-if="thirdPostButton == true && thirdPostVisibility === 'specified'"
					#suffix
					>{{ i18n.ts._visibility.specified }}</template
				>

				<FormSwitch v-model="thirdPostButton" class="_formBlock">{{
					i18n.ts.thirdPostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
				<FormSwitch v-if="thirdPostButton" v-model="thirdPostWideButton" class="_formBlock">{{
					i18n.ts.widePostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

				<FormSelect v-model="thirdPostVisibility" class="_formBlock">
					<option value="public">
						{{ i18n.ts._visibility.public }}
					</option>
					<option value="l-public">
						{{ i18n.ts._visibility.localAndFollower }}
					</option>
					<option value="home">
						{{ i18n.ts._visibility.home }}
					</option>
					<option value="l-home">
						{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}
					</option>
					<option value="followers">
						{{ i18n.ts._visibility.followers }}
					</option>
					<option value="specified">
						{{ i18n.ts._visibility.specified }}
					</option>
				</FormSelect>
			</FormFolder>
			<FormFolder v-if="secondPostButton && thirdPostButton" class="_formBlock">
				<template #label>{{ i18n.ts.fourthPostButton }}</template>
				<template v-if="fourthPostButton == false" #suffix>{{
					i18n.ts.buttonNone
				}}</template>
				<template v-if="fourthPostButton == true && fourthPostVisibility === 'public'" #suffix>{{
					i18n.ts._visibility.public
				}}</template>
				<template
					v-else-if="fourthPostButton == true && fourthPostVisibility === 'l-public'"
					#suffix
					>{{ i18n.ts._visibility.localAndFollower }}</template
				>
				<template
					v-else-if="fourthPostButton == true && fourthPostVisibility === 'home'"
					#suffix
					>{{ i18n.ts._visibility.home }}</template
				>
				<template
					v-else-if="fourthPostButton == true && fourthPostVisibility === 'l-home'"
					#suffix
					>{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}</template
				>
				<template
					v-else-if="fourthPostButton == true && fourthPostVisibility === 'followers'"
					#suffix
					>{{ i18n.ts._visibility.followers }}</template
				>
				<template
					v-else-if="fourthPostButton == true && fourthPostVisibility === 'specified'"
					#suffix
					>{{ i18n.ts._visibility.specified }}</template
				>

				<FormSwitch v-model="fourthPostButton" class="_formBlock">{{
					i18n.ts.fourthPostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
				<FormSwitch v-if="fourthPostButton" v-model="fourthPostWideButton" class="_formBlock">{{
					i18n.ts.widePostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

				<FormSelect v-model="fourthPostVisibility" class="_formBlock">
					<option value="public">
						{{ i18n.ts._visibility.public }}
					</option>
					<option value="l-public">
						{{ i18n.ts._visibility.localAndFollower }}
					</option>
					<option value="home">
						{{ i18n.ts._visibility.home }}
					</option>
					<option value="l-home">
						{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}
					</option>
					<option value="followers">
						{{ i18n.ts._visibility.followers }}
					</option>
					<option value="specified">
						{{ i18n.ts._visibility.specified }}
					</option>
				</FormSelect>
			</FormFolder>
			<FormFolder v-if="secondPostButton && thirdPostButton && fourthPostButton" class="_formBlock">
				<template #label>{{ i18n.ts.fifthPostButton }}</template>
				<template v-if="fifthPostButton == false" #suffix>{{
					i18n.ts.buttonNone
				}}</template>
				<template v-if="fifthPostButton == true && fifthPostVisibility === 'public'" #suffix>{{
					i18n.ts._visibility.public
				}}</template>
				<template
					v-else-if="fifthPostButton == true && fifthPostVisibility === 'l-public'"
					#suffix
					>{{ i18n.ts._visibility.localAndFollower }}</template
				>
				<template
					v-else-if="fifthPostButton == true && fifthPostVisibility === 'home'"
					#suffix
					>{{ i18n.ts._visibility.home }}</template
				>
				<template
					v-else-if="fifthPostButton == true && fifthPostVisibility === 'l-home'"
					#suffix
					>{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}</template
				>
				<template
					v-else-if="fifthPostButton == true && fifthPostVisibility === 'followers'"
					#suffix
					>{{ i18n.ts._visibility.followers }}</template
				>
				<template
					v-else-if="fifthPostButton == true && fifthPostVisibility === 'specified'"
					#suffix
					>{{ i18n.ts._visibility.specified }}</template
				>

				<FormSwitch v-model="fifthPostButton" class="_formBlock">{{
					i18n.ts.fifthPostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
				<FormSwitch v-if="fifthPostButton" v-model="fifthPostWideButton" class="_formBlock">{{
					i18n.ts.widePostButton
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

				<FormSelect v-model="fifthPostVisibility" class="_formBlock">
					<option value="public">
						{{ i18n.ts._visibility.public }}
					</option>
					<option value="l-public">
						{{ i18n.ts._visibility.localAndFollower }}
					</option>
					<option value="home">
						{{ i18n.ts._visibility.home }}
					</option>
					<option value="l-home">
						{{ `${i18n.ts._visibility.localAndFollower} (${i18n.ts._visibility.home})` }}
					</option>
					<option value="followers">
						{{ i18n.ts._visibility.followers }}
					</option>
					<option value="specified">
						{{ i18n.ts._visibility.specified }}
					</option>
				</FormSelect>
			</FormFolder>
		</FormSection>

		<FormSwitch
			v-model="channelSecondPostButton"
			class="_formBlock"
			@update:modelValue="save()"
			>{{ i18n.ts.channelSecondPostButton }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
		>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSelect from "@/components/form/select.vue";
import FormSection from "@/components/form/section.vue";
import FormFolder from "@/components/form/folder.vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import { definePageMetadata } from "@/scripts/page-metadata";

let isLocked = $ref($i.isLocked);
let isSilentLocked = $ref($i.isSilentLocked);
let isRemoteLocked = $ref($i.isRemoteLocked);
let blockPostPublic = $ref($i.blockPostPublic);
let blockPostHome = $ref($i.blockPostHome);
let blockPostNotLocal = $ref($i.blockPostNotLocal);
let blockPostNotLocalPublic = $ref($i.blockPostNotLocalPublic);
let autoAcceptFollowed = $ref($i.autoAcceptFollowed);
let noCrawle = $ref($i.noCrawle);
let isExplorable = $ref($i.isExplorable);
let isRemoteBlockExplorable = $ref(!$i.isRemoteExplorable);
let hideOnlineStatus = $ref($i.hideOnlineStatus);
let publicReactions = $ref($i.publicReactions);
let ffVisibility = $ref($i.ffVisibility);
let preventAiLearning = $ref($i.preventAiLearning);

let defaultNoteVisibility = $computed(
	defaultStore.makeGetterSetter("defaultNoteVisibility")
);
let defaultNoteLocalOnly = $computed(
	defaultStore.makeGetterSetter("defaultNoteLocalOnly")
);
let defaultNoteLocalAndFollower = $computed(
	defaultStore.makeGetterSetter("defaultNoteLocalAndFollower")
);
let rememberNoteVisibility = $computed(
	defaultStore.makeGetterSetter("rememberNoteVisibility")
);
let firstPostButtonVisibilityForce = $computed(
	defaultStore.makeGetterSetter("firstPostButtonVisibilityForce")
);
let firstPostWideButton = $computed(
	defaultStore.makeGetterSetter("firstPostWideButton")
);
let secondPostButton = $computed(
	defaultStore.makeGetterSetter("secondPostButton")
);
let secondPostVisibility = $computed(
	defaultStore.makeGetterSetter("secondPostVisibility")
);
let secondPostWideButton = $computed(
	defaultStore.makeGetterSetter("secondPostWideButton")
);
let thirdPostButton = $computed(
	defaultStore.makeGetterSetter("thirdPostButton")
);
let thirdPostVisibility = $computed(
	defaultStore.makeGetterSetter("thirdPostVisibility")
);
let thirdPostWideButton = $computed(
	defaultStore.makeGetterSetter("thirdPostWideButton")
);
let fourthPostButton = $computed(
	defaultStore.makeGetterSetter("fourthPostButton")
);
let fourthPostVisibility = $computed(
	defaultStore.makeGetterSetter("fourthPostVisibility")
);
let fourthPostWideButton = $computed(
	defaultStore.makeGetterSetter("fourthPostWideButton")
);
let fifthPostButton = $computed(
	defaultStore.makeGetterSetter("fifthPostButton")
);
let fifthPostVisibility = $computed(
	defaultStore.makeGetterSetter("fifthPostVisibility")
);
let fifthPostWideButton = $computed(
	defaultStore.makeGetterSetter("fifthPostWideButton")
);
let channelSecondPostButton = $computed(
	defaultStore.makeGetterSetter("channelSecondPostButton")
);
const showMkkeySettingTips = $computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

function save() {
	os.api("i/update", {
		isLocked: !!isLocked,
		isSilentLocked: !!isSilentLocked,
		isRemoteLocked: !!isRemoteLocked,
		autoAcceptFollowed: !!autoAcceptFollowed,
		blockPostPublic: !!blockPostPublic,
		blockPostHome: !!blockPostHome,
		blockPostNotLocal: !!blockPostNotLocal,
		blockPostNotLocalPublic: !!blockPostNotLocalPublic,
		noCrawle: !!noCrawle,
		isExplorable: !!isExplorable,
		isRemoteExplorable: !isRemoteBlockExplorable,
		publicReactions: !!publicReactions,
		preventAiLearning: !!preventAiLearning,
		ffVisibility: ffVisibility,
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.privacy,
	icon: "ph-lock-open ph-bold ph-lg",
});
</script>
