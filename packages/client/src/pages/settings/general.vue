<template>
	<div class="_formRoot">
		<FormSelect v-model="lang" class="_formBlock">
			<template #label>{{ i18n.ts.uiLanguage }}</template>
			<option v-for="x in langs" :key="x[0]" :value="x[0]">
				{{ x[1] }}
			</option>
		</FormSelect>

		<FormSection>
			<template #label>{{ i18n.ts.timeline }}</template>
			<FormRadios v-model="showLocalPostsInTimeline" v-if="!['classic','deck'].includes(ui)" class="_formBlock">
				<template #label>{{ i18n.ts.showLocalPosts }}</template>
				<option value="home">
					<i class="ph-handshake ph-bold ph-lg" />
					{{ i18n.ts.homeTimeline }}
				</option>
				<option value="social">
					<i class="ph-house ph-bold ph-lg" />
					{{ i18n.ts.socialTimeline }}
				</option>
				<option value="both">
					<i class="ph-house ph-bold ph-lg" />
					<i class="ph-handshake ph-bold ph-lg" />
					{{ i18n.ts.bothTimeline }}
				</option>
				<option value="none">
					{{ i18n.ts.hidden }}
				</option>
			</FormRadios>
			<FormSwitch v-if="!['classic', 'deck'].includes(ui)" v-model="hiddenLTL" class="_formBlock">{{
				i18n.ts.hiddenLTL
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch
				v-model="blockPostPublic"
				v-if="hiddenLTL"
				class="_formBlock"
				@update:modelValue="save()"
				>{{ i18n.ts.blockPostPublic
				}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span><template #caption>{{
					i18n.ts.blockPostPublicDescription
				}}{{
					i18n.ts.hiddenLTLDescription
				}}</template></FormSwitch
			>
			<FormSwitch v-if="!['classic', 'deck'].includes(ui)" v-model="hiddenGTL" class="_formBlock">{{
				i18n.ts.hiddenGTL
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSelect v-if="!['classic','deck'].includes(ui)" v-model="thirdTimelineType" class="_formBlock">
				<template #label>{{ i18n.ts.thirdTimelineType }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="media">{{ i18n.ts._timelines.media }}</option>
				<option value="spotlight">{{ i18n.ts._timelines.spotlight }}</option>
				<option v-if="developer" value="list">{{ i18n.ts._timelines.list }}</option>
				<option v-if="developer" value="antenna">{{ i18n.ts._timelines.antenna }}</option>
				<option value="hidden">{{ i18n.ts.hidden }}</option>
			</FormSelect>
			<FormInput
				v-if="!['classic','deck'].includes(ui) && ['list','antenna'].includes(thirdTimelineType) && developer"
				v-model="thirdTimelineListId"
				class="_formBlock"
				:small="true"
				:placeholder="`リスト / アンテナの内部ID (10文字)`"
				style="margin: 0 0 !important"
			>
				<template #label>{{ i18n.ts.thirdTimelineListId }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			</FormInput>
			<!--<FormSelect v-if="!['classic', 'deck'].includes(ui)" v-model="fourthTimelineType" class="_formBlock">
				<template #label>{{ i18n.ts.fourthTimelineType }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="media">{{ i18n.ts._timelines.media }}</option>
				<option value="spotlight">{{ i18n.ts._timelines.spotlight }}</option>
				<option v-if="developer" value="list">{{ i18n.ts._timelines.list }}</option>
				<option v-if="developer" value="antenna">{{ i18n.ts._timelines.antenna }}</option>
				<option value="hidden">{{ i18n.ts.hidden }}</option>
			</FormSelect>
			<FormInput
				v-if="!['classic', 'deck'].includes(ui) && ['list', 'antenna'].includes(fourthTimelineType) && developer"
				v-model="fourthTimelineListId"
				class="_formBlock"
				:small="true"
				:placeholder="`リスト / アンテナの内部ID (10文字)`"
				style="margin: 0 0 !important"
			>
				<template #label>{{ i18n.ts.fourthTimelineListId }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			</FormInput>-->
			<FormSwitch v-model="showFixedPostForm" class="_formBlock">{{
				i18n.ts.showFixedPostForm
			}}</FormSwitch>
			<FormSwitch v-model="recentRenoteHidden" class="_formBlock">{{
				i18n.ts.recentRenoteHidden
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="reactedRenoteHidden" class="_formBlock">{{
				i18n.ts.reactedRenoteHidden
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showLocalTimelineBelowPublic" class="_formBlock">{{
				i18n.ts.showLocalTimelineBelowPublic
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="localShowRenote" class="_formBlock" @update:modelValue="save()">{{
				i18n.ts.localShowRenote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="remoteShowRenote" class="_formBlock" @update:modelValue="save()">{{
				i18n.ts.remoteShowRenote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showSelfRenoteToHome" class="_formBlock" @update:modelValue="save()">{{
				i18n.ts.showSelfRenoteToHome
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showTimelineReplies" class="_formBlock" @update:modelValue="save()"
				>{{ i18n.ts.flagShowTimelineReplies
				}}<template #caption
					>{{ i18n.ts.flagShowTimelineRepliesDescription }}
					{{ i18n.ts.reflectMayTakeTime }}</template
				></FormSwitch
			>

			<FormSelect v-model="nsfw" class="_formBlock">
				<template #label>{{ i18n.ts.nsfw }}</template>
				<option value="respect">{{ i18n.ts._nsfw.respect }}</option>
				<option value="ignore">{{ i18n.ts._nsfw.ignore }}</option>
				<option value="force">{{ i18n.ts._nsfw.force }}</option>
				<option value="toCW">{{ i18n.ts._nsfw.toCW }}</option>
			</FormSelect>
			<FormSwitch v-model="noteAllCw" class="_formBlock">{{
				i18n.ts.noteAllCw
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
		</FormSection>

		<FormSection>
			<template #label>{{ i18n.ts.behavior }}</template>
			<FormSwitch v-model="imageNewTab" class="_formBlock">{{
				i18n.ts.openImageInNewTab
			}}</FormSwitch>
			<FormSwitch v-model="enableInfiniteScroll" class="_formBlock">{{
				i18n.ts.enableInfiniteScroll
			}}</FormSwitch>
			<FormSelect v-model="doContextMenu" class="_formBlock">
				<template #label>{{ i18n.ts.doContextMenu }}</template>
				<option value="contextMenu">{{ i18n.ts.contextMenu }}</option>
				<option value="reactionPicker">{{ i18n.ts.reactionPicker }}</option>
				<option value="doNothing">{{ i18n.ts.doNothing }}</option>
			</FormSelect>
			<FormSwitch v-if="!['classic','deck'].includes(ui)" v-model="alwaysPostButton" class="_formBlock">{{
				i18n.ts.alwaysPostButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="swipeOnDesktop" class="_formBlock">{{
				i18n.ts.swipeOnDesktop
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showDetailNoteClick" class="_formBlock">{{
				i18n.ts.showDetailNoteClick
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="noteReactionMenu" class="_formBlock">{{
				i18n.ts.noteReactionMenu
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="enableDataSaverMode" :disabled="autoSwitchDataSaver" class="_formBlock">{{
				i18n.ts.dataSaver
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="autoSwitchDataSaver" :disabled="!supportAutoDataSaver" class="_formBlock">{{
				i18n.ts.autoSwitchDataSaver
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="enabledAirReply" class="_formBlock">{{
				i18n.ts.enabledAirReply
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="hiddenActivityChart" class="_formBlock">{{
				i18n.ts.hiddenActivityChart
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="diablePagesScript" class="_formBlock">{{
				i18n.ts.disablePagesScript
			}}</FormSwitch>
			<FormSwitch v-model="longLoading" class="_formBlock">{{
				i18n.ts.longLoading
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="copyPostRemoteEmojiCode" class="_formBlock">{{
				i18n.ts.copyPostRemoteEmojiCode
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="developerRenote" class="_formBlock">{{
				i18n.ts.developerRenote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="developerQuote" class="_formBlock">{{
				i18n.ts.developerQuote
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="developerNoteMenu" class="_formBlock">{{
				i18n.ts.developerNoteMenu
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

			<FormSelect v-model="serverDisconnectedBehavior" class="_formBlock">
				<template #label>{{ i18n.ts.whenServerDisconnected }}</template>
				<option value="reload">
					{{ i18n.ts._serverDisconnectedBehavior.reload }}
				</option>
				<option value="dialog">
					{{ i18n.ts._serverDisconnectedBehavior.dialog }}
				</option>
				<option value="quiet">
					{{ i18n.ts._serverDisconnectedBehavior.quiet }}
				</option>
				<option value="nothing">
					{{ i18n.ts._serverDisconnectedBehavior.nothing }}
				</option>
			</FormSelect>
		</FormSection>

		<FormSection>
			<template #label>{{ i18n.ts.postForm }}</template>
			<FormSwitch v-model="enterSendsMessage" class="_formBlock">{{
				i18n.ts.enterSendsMessage
			}}</FormSwitch>
			<FormSwitch v-model="plusInfoPostForm" class="_formBlock">{{
				i18n.ts.plusInfoPostForm
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="openEmojiPicker" class="_formBlock">{{
				i18n.ts.openEmojiPicker
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="openEmojiPicker" v-model="postAutoFocusSearchBar" class="_formBlock">{{
				i18n.ts.postAutoFocusSearchBar
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="openEmojiPicker" v-model="notCloseEmojiPicker" class="_formBlock">{{
				i18n.ts.notCloseEmojiPicker
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="developer" v-model="showRemoteEmojiPostForm" class="_formBlock">{{
				i18n.ts.showRemoteEmojiPostForm
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="usePickerSizePostForm" class="_formBlock">
				{{ i18n.ts.usePickerSizePostForm }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span>
			</FormSwitch>
			<FormSwitch v-model="hiddenMentionButton" class="_formBlock">{{
				i18n.ts.hiddenMentionButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="!hiddenMentionButton" v-model="openMentionWindow" class="_formBlock">{{
				i18n.ts.openMentionWindow
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="hiddenCloseButton" class="_formBlock">{{
				i18n.ts.hiddenCloseButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="!hiddenCloseButton" v-model="CloseAllClearButton" class="_formBlock">{{
				i18n.ts.CloseAllClearButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="hiddenAccountButton" class="_formBlock">{{
				i18n.ts.hiddenAccountButton
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="hiddenMFMHelp" class="_formBlock">{{
				i18n.ts.hiddenMFMHelp
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="smartMFMInputer" class="_formBlock">{{
				i18n.ts.smartMFMInputer
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="quickToggleSmartMFMInputer" class="_formBlock">{{
				i18n.ts.quickToggleSmartMFMInputer
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch
				v-model="keepPostCw"
				class="_formBlock"
				>{{ i18n.ts.keepPostCw }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch
			>
			<FormSwitch
				v-model="keepCw"
				class="_formBlock"
				>{{ i18n.ts.keepCw }}</FormSwitch
			>
			<FormSwitch v-model="emojiPickerUseDrawerForMobile" class="_formBlock">{{
				i18n.ts.emojiPickerUseDrawerForMobile
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
		</FormSection>

		<FormSection>
			<template #label>{{ i18n.ts.appearance }}</template>
			<FormSwitch v-model="autoplayMfm" class="_formBlock">
				{{ i18n.ts._mfm.alwaysPlay }}
				<template #caption>
					<i class="ph-warning ph-bold ph-lg" style="color: var(--warn)"></i>
					{{ i18n.ts._mfm.warn }}
				</template>
			</FormSwitch>
			<FormSwitch v-model="reduceAnimation" class="_formBlock">{{
				i18n.ts.reduceUiAnimation
			}}</FormSwitch>
			<FormSwitch v-model="useBlurEffect" class="_formBlock">{{
				i18n.ts.useBlurEffect
			}}</FormSwitch>
			<FormSwitch v-model="useBlurEffectForModal" class="_formBlock">{{
				i18n.ts.useBlurEffectForModal
			}}</FormSwitch>
			<FormSwitch
				v-model="showGapBetweenNotesInTimeline"
				class="_formBlock"
				>{{ i18n.ts.showGapBetweenNotesInTimeline }}</FormSwitch
			>
			<FormSwitch v-model="alwaysXExpand" class="_formBlock">{{
				i18n.ts.alwaysXExpand
			}}</FormSwitch>
			<FormSwitch v-model="showRelationMark" class="_formBlock">{{
				i18n.ts.showRelationMark
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="loadRawImages" class="_formBlock">{{
				i18n.ts.loadRawImages
			}}</FormSwitch>
			<FormSwitch v-model="thumbnailCover" class="_formBlock">{{
				i18n.ts.thumbnailCover
			}}</FormSwitch>
			<FormSwitch v-model="compactGrid" class="_formBlock">{{
				i18n.ts.compactGrid
			}}</FormSwitch>
			<FormSwitch
				v-model="disableShowingAnimatedImages"
				class="_formBlock"
				>{{ i18n.ts.disableShowingAnimatedImages }}</FormSwitch
			>
			<FormSwitch v-model="squareAvatars" class="_formBlock">{{
				i18n.ts.squareAvatars
			}}</FormSwitch>
			<FormSwitch
				v-model="reactionShowUsername"
				class="_formBlock"
			>
				{{ i18n.ts.reactionShowUsername }}
			<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch
				v-model="reactionShowShort"
				class="_formBlock"
			>
				{{ i18n.ts.reactionShowShort }}
			<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="seperateRenoteQuote" class="_formBlock">{{
				i18n.ts.seperateRenoteQuote
			}}</FormSwitch>
			<FormSwitch v-model="useSystemFont" class="_formBlock">{{
				i18n.ts.useSystemFont
			}}</FormSwitch>
			<FormSwitch v-model="useOsNativeEmojis" class="_formBlock">
				{{ i18n.ts.useOsNativeEmojis }}
				<div>
					<Mfm :key="useOsNativeEmojis" text="🍮🍦🍭🍩🍰🍫🍬🥞🍪" />
				</div>
			</FormSwitch>
			<FormSelect v-model="customFont">
				<template #label>{{ i18n.ts.customFont }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option :value="null">{{ i18n.ts.default }}</option>
				<option v-for="[name, font] of Object.entries(fontList)" :value="name">{{ font.name }}</option>
			</FormSelect>
			<FormSwitch
				v-model="randomCustomFont"
				class="_formBlock"
			>
				{{ i18n.ts.randomCustomFont }}
			<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch
				v-if="includesRandomEsenapaj || customFont === 'esenapaj' && randomCustomFont"
				v-model="includesRandomEsenapaj"
				class="_formBlock"
			>
				{{ i18n.ts.includesRandomEsenapaj }}
			<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="disableDrawer" class="_formBlock">{{
				i18n.ts.disableDrawer
			}}</FormSwitch>
			<FormSwitch v-model="showAds" class="_formBlock">{{
				i18n.ts.showAds
			}}</FormSwitch>
			<FormSwitch v-model="showMkkeySettingTips" class="_formBlock">{{
				i18n.ts.showMkkeySettingTips
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-model="showUpdates" class="_formBlock">{{
				i18n.ts.showUpdates
			}}</FormSwitch>
			<FormSwitch v-if="developer" v-model="showMiniUpdates" class="_formBlock">{{
				i18n.ts.showMiniUpdates
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch
				v-if="$i?.isAdmin"
				v-model="showAdminUpdates"
				class="_formBlock"
				>{{ i18n.ts.showAdminUpdates }}</FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label>{{ i18n.ts.power }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<FormSwitch v-model="powerMode" class="_formBlock">{{
				i18n.ts.powerMode
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeColorful" class="_formBlock">{{
				i18n.ts.powerModeColorful
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
			<FormSwitch v-if="powerMode" v-model="powerModeNoShake" class="_formBlock">{{
				i18n.ts.powerModeNoShake
			}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>
		</FormSection>

		<FormSection>
			<template #label></template>
			<FormRadios v-model="overridedDeviceKind" class="_formBlock">
				<template #label>{{ i18n.ts.overridedDeviceKind }}</template>
				<option :value="null">{{ i18n.ts.auto }}</option>
				<option value="smartphone">
					<i class="ph-device-mobile ph-bold ph-lg" />
					{{ i18n.ts.smartphone }}
				</option>
				<option value="tablet">
					<i class="ph-device-tablet ph-bold ph-lg" />
					{{ i18n.ts.tablet }}
				</option>
				<option value="desktop">
					<i class="ph-desktop ph-bold ph-lg" /> {{ i18n.ts.desktop }}
				</option>
				<option value="desktop-force">
					<i class="ph-desktop ph-bold ph-lg" />
					{{ i18n.ts.desktopForce }}
				</option>
			</FormRadios>

			<FormRadios v-model="fontSize" class="_formBlock">
				<template #label>{{ i18n.ts.fontSize }}</template>
				<option value="-5">
					<span style="font-size: 11px">11</span>
				</option>
				<option :value="-3">
					<span style="font-size: 13px">13</span>
				</option>
				<option value="-2">
					<span style="font-size: 14px">14</span>
				</option>
				<option value="-1">
					<span style="font-size: 15px">15</span>
				</option>
				<option value="null">
					<span style="font-size: 16px">16</span>
				</option>
				<option value="1">
					<span style="font-size: 17px">17</span>
				</option>
				<option value="2">
					<span style="font-size: 18px">18</span>
				</option>
				<option value="3">
					<span style="font-size: 19px">19</span>
				</option>
				<option value="5">
					<span style="font-size: 21px">21</span>
				</option>
			</FormRadios>

			<FormRadios v-model="avatarSize" class="_formBlock">
				<template #label>{{ i18n.ts.avatarSize }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
				<option value="-2">
					極小
				</option>
				<option value="-1">
					小
				</option>
				<option value="null">
					中
				</option>
				<option value="1">
					大
				</option>
				<option value="2">
					特大
				</option>
				<option value="-3">
					豆粒
				</option>
				<option value="-4">
					非表示
				</option>
				<option value="f-1">
					固定（小）
				</option>
				<option value="f">
					固定（中）
				</option>
				<option value="f1">
					固定（大）
				</option>
			</FormRadios>
		</FormSection>

		<FormSelect v-model="instanceTicker" class="_formBlock">
			<template #label>{{ i18n.ts.instanceTicker }}</template>
			<option value="none">{{ i18n.ts._instanceTicker.none }}</option>
			<option value="remote">{{ i18n.ts._instanceTicker.remote }}</option>
			<option value="always">{{ i18n.ts._instanceTicker.always }}</option>
		</FormSelect>

		<FormSwitch v-if="developer" v-model="developerTicker" class="_formBlock">{{
			i18n.ts.developerTicker
		}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

		<FormSelect v-if="!isMobile" v-model="remoteEmojisFetch" class="_formBlock">
			<template #label>{{ i18n.ts.remoteEmojisFetch }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<option value="always">{{ i18n.ts._remoteEmojisFetchForPc.always }}</option>
			<option value="all">{{ i18n.ts._remoteEmojisFetchForPc.all }}</option>
			<option value="plus">{{ i18n.ts._remoteEmojisFetchForPc.plus }}</option>
			<option value="keep">{{ i18n.ts._remoteEmojisFetchForPc.keep }}</option>
			<option value="none">{{ i18n.ts._remoteEmojisFetchForPc.none }}</option>
		</FormSelect>
		<FormSelect v-else v-model="remoteEmojisFetch" class="_formBlock">
			<template #label>{{ i18n.ts.remoteEmojisFetch }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
			<option value="all">{{ i18n.ts._remoteEmojisFetch.all }}</option>
			<option value="plus">{{ i18n.ts._remoteEmojisFetch.plus }}</option>
			<option value="keep">{{ i18n.ts._remoteEmojisFetch.keep }}</option>
			<option value="none">{{ i18n.ts._remoteEmojisFetch.none }}</option>
			<option value="always">{{ i18n.ts._remoteEmojisFetch.always }}</option>
		</FormSelect>

		<FormRange
			v-model="numberOfPageCache"
			:min="1"
			:max="10"
			:step="1"
			easing
			class="_formBlock"
		>
			<template #label>{{ i18n.ts.numberOfPageCache }}</template>
			<template #caption>{{
				i18n.ts.numberOfPageCacheDescription
			}}</template>
		</FormRange>

		<FormRange
			v-model="swipeTouchAngle"
			:min="1"
			:max="90"
			:step="1"
			easing
			class="_formBlock"
		>
			<template #label>{{ i18n.ts.swipeTouchAngle }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
		</FormRange>

		<FormRange
			v-model="swipeThreshold"
			:min="0"
			:max="200"
			:step="2"
			easing
			class="_formBlock"
		>
			<template #label>{{ i18n.ts.swipeThreshold }}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></template>
		</FormRange>

		<FormSwitch v-model="swipeCenteredSlides" class="_formBlock">{{
			i18n.ts.swipeCenteredSlides
		}}<span v-if="showMkkeySettingTips" class="_beta">{{ i18n.ts.mkkey }}</span></FormSwitch>

		<FormLink to="/settings/deck" class="_formBlock">{{
			i18n.ts.deck
		}}</FormLink>

		<FormLink to="/settings/custom-css" class="_formBlock"
			><template #icon><i class="ph-code ph-bold ph-lg"></i></template
			>{{ i18n.ts.customCss }}</FormLink
		>

		<FormLink to="/settings/custom-katex-macro" class="_formBlock"
			><template #icon><i class="ph-radical ph-bold ph-lg"></i></template
			>{{ i18n.ts.customKaTeXMacro }}</FormLink
		>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { $i } from "@/account";
import FormInput from "@/components/form/input.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSelect from "@/components/form/select.vue";
import FormRadios from "@/components/form/radios.vue";
import FormRange from "@/components/form/range.vue";
import FormSection from "@/components/form/section.vue";
import FormLink from "@/components/form/link.vue";
import MkLink from "@/components/MkLink.vue";
import { ui, langs } from "@/config";
import { defaultStore } from "@/store";
import * as os from "@/os";
import { unisonReload } from "@/scripts/unison-reload";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { deviceKind } from "@/scripts/device-kind";
import { isSupportNavigatorConnection } from '@/scripts/datasaver';
import { fontList } from '@/scripts/font';

const DESKTOP_THRESHOLD = 1100;
const MOBILE_THRESHOLD = 500;

// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので deviceKind === 'desktop' の判定は行わない
const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = ref(
	deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD
);
window.addEventListener("resize", () => {
	isMobile.value =
		deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
});

const lang = ref(localStorage.getItem("lang"));
const fontSize = ref(localStorage.getItem("fontSize"));
const avatarSize = ref(localStorage.getItem("avatarSize"));
const useSystemFont = ref(localStorage.getItem("useSystemFont") != null);

const supportAutoDataSaver = computed(() => isSupportNavigatorConnection());

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

const overridedDeviceKind = computed(
	defaultStore.makeGetterSetter("overridedDeviceKind")
);
const showLocalPostsInTimeline = computed(
	defaultStore.makeGetterSetter("showLocalPostsInTimeline")
);
const serverDisconnectedBehavior = computed(
	defaultStore.makeGetterSetter("serverDisconnectedBehavior")
);
const reduceAnimation = computed(
	defaultStore.makeGetterSetter(
		"animation",
		(v) => !v,
		(v) => !v
	)
);
const useBlurEffectForModal = computed(
	defaultStore.makeGetterSetter("useBlurEffectForModal")
);
const useBlurEffect = computed(defaultStore.makeGetterSetter("useBlurEffect"));
const showGapBetweenNotesInTimeline = computed(
	defaultStore.makeGetterSetter("showGapBetweenNotesInTimeline")
);
const showAds = computed(defaultStore.makeGetterSetter("showAds"));
const autoplayMfm = computed(
	defaultStore.makeGetterSetter(
		"animatedMfm",
		(v) => !v,
		(v) => !v
	)
);
const useOsNativeEmojis = computed(
	defaultStore.makeGetterSetter("useOsNativeEmojis")
);
const disableDrawer = computed(defaultStore.makeGetterSetter("disableDrawer"));
const emojiPickerUseDrawerForMobile = computed(defaultStore.makeGetterSetter("emojiPickerUseDrawerForMobile"));
const disableShowingAnimatedImages = computed(
	defaultStore.makeGetterSetter("disableShowingAnimatedImages")
);
const showRelationMark = computed(defaultStore.makeGetterSetter("showRelationMark"));
const loadRawImages = computed(defaultStore.makeGetterSetter("loadRawImages"));
const imageNewTab = computed(defaultStore.makeGetterSetter("imageNewTab"));
const nsfw = computed(defaultStore.makeGetterSetter("nsfw"));
const disablePagesScript = computed(
	defaultStore.makeGetterSetter("disablePagesScript")
);
const showFixedPostForm = computed(
	defaultStore.makeGetterSetter("showFixedPostForm")
);
const numberOfPageCache = computed(
	defaultStore.makeGetterSetter("numberOfPageCache")
);
const instanceTicker = computed(
	defaultStore.makeGetterSetter("instanceTicker")
);
const enableInfiniteScroll = computed(
	defaultStore.makeGetterSetter("enableInfiniteScroll")
);
const enterSendsMessage = computed(
	defaultStore.makeGetterSetter("enterSendsMessage")
);
const openEmojiPicker = computed(
	defaultStore.makeGetterSetter("openEmojiPicker")
);
const postAutoFocusSearchBar = computed(
	defaultStore.makeGetterSetter("postAutoFocusSearchBar")
);
const notCloseEmojiPicker = computed(
	defaultStore.makeGetterSetter("notCloseEmojiPicker")
);
const hiddenMFMHelp = computed(
	defaultStore.makeGetterSetter("hiddenMFMHelp")
);
const hiddenMentionButton = computed(
	defaultStore.makeGetterSetter("hiddenMentionButton")
);
const hiddenCloseButton = computed(
	defaultStore.makeGetterSetter("hiddenCloseButton")
);
const hiddenAccountButton = computed(
	defaultStore.makeGetterSetter("hiddenAccountButton")
);
const CloseAllClearButton = computed(
	defaultStore.makeGetterSetter("CloseAllClearButton")
);
const openMentionWindow = computed(
	defaultStore.makeGetterSetter("openMentionWindow")
);
const useReactionPickerForContextMenu = computed(
	defaultStore.makeGetterSetter("useReactionPickerForContextMenu")
);
const doContextMenu = computed(
	defaultStore.makeGetterSetter("doContextMenu")
);
const seperateRenoteQuote = computed(
	defaultStore.makeGetterSetter("seperateRenoteQuote")
);
const powerMode = computed(
	defaultStore.makeGetterSetter("powerMode")
);
const powerModeColorful = computed(
	defaultStore.makeGetterSetter("powerModeColorful")
);
const powerModeNoShake = computed(
	defaultStore.makeGetterSetter("powerModeNoShake")
);
const squareAvatars = computed(defaultStore.makeGetterSetter("squareAvatars"));
const showUpdates = computed(defaultStore.makeGetterSetter("showUpdates"));
const swipeOnDesktop = computed(
	defaultStore.makeGetterSetter("swipeOnDesktop")
);
const showAdminUpdates = computed(
	defaultStore.makeGetterSetter("showAdminUpdates")
);
const smartMFMInputer = computed(
	defaultStore.makeGetterSetter("smartMFMInputer")
);
const quickToggleSmartMFMInputer = computed(
	defaultStore.makeGetterSetter("quickToggleSmartMFMInputer")
);
const developer = computed(
	defaultStore.makeGetterSetter("developer")
);
const developerRenote = computed(
	defaultStore.makeGetterSetter("developerRenote")
);
const developerQuote = computed(
	defaultStore.makeGetterSetter("developerQuote")
);
const developerNoteMenu = computed(
	defaultStore.makeGetterSetter("developerNoteMenu")
);
const developerTicker = computed(
	defaultStore.makeGetterSetter("developerTicker")
);
const copyPostRemoteEmojiCode = computed(
	defaultStore.makeGetterSetter("copyPostRemoteEmojiCode")
);
const showMiniUpdates = computed(
	defaultStore.makeGetterSetter("showMiniUpdates")
);
const hiddenActivityChart = computed(
	defaultStore.makeGetterSetter("hiddenActivityChart")
);
const reactionShowUsername = $computed(
	defaultStore.makeGetterSetter("reactionShowUsername")
);
const reactionShowShort = $computed(
	defaultStore.makeGetterSetter("reactionShowShort")
);
const remoteEmojisFetch = $computed(
	defaultStore.makeGetterSetter("remoteEmojisFetch")
);
const enableDataSaverMode = $computed(
	defaultStore.makeGetterSetter("enableDataSaverMode")
);
const recentRenoteHidden = $computed(
	defaultStore.makeGetterSetter("recentRenoteHidden")
);
const reactedRenoteHidden = $computed(
	defaultStore.makeGetterSetter("reactedRenoteHidden")
);
const showDetailNoteClick = $computed(
	defaultStore.makeGetterSetter("showDetailNoteClick")
);
const alwaysPostButton = $computed(
	defaultStore.makeGetterSetter("alwaysPostButton")
);
const customFont = $computed(
	defaultStore.makeGetterSetter("customFont")
);
const randomCustomFont = $computed(
	defaultStore.makeGetterSetter("randomCustomFont")
);
const includesRandomEsenapaj = $computed(
	defaultStore.makeGetterSetter("includesRandomEsenapaj")
);
const showSpotlight = computed(defaultStore.makeGetterSetter("showSpotlight"));
let keepCw = $computed(defaultStore.makeGetterSetter("keepCw"));
let keepPostCw = $computed(defaultStore.makeGetterSetter("keepPostCw"));
let localShowRenote = $ref($i.localShowRenote);
let remoteShowRenote = $ref($i.remoteShowRenote);
let showSelfRenoteToHome = $ref($i.showSelfRenoteToHome);
let showTimelineReplies = $ref($i.showTimelineReplies);
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);
const noteAllCw = $computed(
	defaultStore.makeGetterSetter("noteAllCw")
);
const longLoading = $computed(
	defaultStore.makeGetterSetter("longLoading")
);
const plusInfoPostForm = $computed(
	defaultStore.makeGetterSetter("plusInfoPostForm")
);
const thumbnailCover = $computed(
	defaultStore.makeGetterSetter("thumbnailCover")
);
const alwaysXExpand = $computed(
	defaultStore.makeGetterSetter("alwaysXExpand")
);
const swipeTouchAngle = $computed(
	defaultStore.makeGetterSetter("swipeTouchAngle")
);
const swipeThreshold = $computed(
	defaultStore.makeGetterSetter("swipeThreshold")
);
const swipeCenteredSlides = $computed(
	defaultStore.makeGetterSetter("swipeCenteredSlides")
);
const thirdTimelineType = $computed(
	defaultStore.makeGetterSetter("thirdTimelineType")
);
const thirdTimelineListId = $computed(
	defaultStore.makeGetterSetter("thirdTimelineListId")
);
const fourthTimelineType = $computed(
	defaultStore.makeGetterSetter("fourthTimelineType")
);
const fourthTimelineListId = $computed(
	defaultStore.makeGetterSetter("fourthTimelineListId")
);
const hiddenLTL = $computed(
	defaultStore.makeGetterSetter("hiddenLTL")
);
const hiddenGTL = $computed(
	defaultStore.makeGetterSetter("hiddenGTL")
);
const autoSwitchDataSaver = $computed(
	defaultStore.makeGetterSetter("autoSwitchDataSaver")
);
const showRemoteEmojiPostForm = $computed(
	defaultStore.makeGetterSetter("showRemoteEmojiPostForm")
);
const compactGrid = $computed(
	defaultStore.makeGetterSetter("compactGrid")
);
const usePickerSizePostForm = $computed(
	defaultStore.makeGetterSetter("usePickerSizePostForm")
);
const enabledAirReply = computed(
	defaultStore.makeGetterSetter("enabledAirReply")
);
const showLocalTimelineBelowPublic = computed(
	defaultStore.makeGetterSetter('showLocalTimelineBelowPublic')
);
const noteReactionMenu = $computed(
	defaultStore.makeGetterSetter('noteReactionMenu')
);
let blockPostPublic = $ref($i.blockPostPublic);

function save() {
	os.api("i/update", {
		localShowRenote: !!localShowRenote,
		remoteShowRenote: !!remoteShowRenote,
		showSelfRenoteToHome: !!showSelfRenoteToHome,
		showTimelineReplies: !!showTimelineReplies,
		blockPostPublic: !!blockPostPublic,
	});
}

watch(lang, () => {
	localStorage.setItem("lang", lang.value as string);
	localStorage.removeItem("locale");
});

watch(fontSize, () => {
	if (fontSize.value == null) {
		localStorage.removeItem("fontSize");
	} else {
		localStorage.setItem("fontSize", fontSize.value);
	}
});

watch(avatarSize, () => {
	if (avatarSize.value == null) {
		localStorage.removeItem("avatarSize");
	} else {
		localStorage.setItem("avatarSize", avatarSize.value);
	}
});

watch(useSystemFont, () => {
	if (useSystemFont.value) {
		localStorage.setItem("useSystemFont", "t");
	} else {
		localStorage.removeItem("useSystemFont");
	}
});

watch(
	[
		lang,
		fontSize,
		avatarSize,
		useSystemFont,
		enableInfiniteScroll,
		squareAvatars,
		showGapBetweenNotesInTimeline,
		instanceTicker,
		overridedDeviceKind,
		showLocalPostsInTimeline,
		showAds,
		showUpdates,
		swipeOnDesktop,
		seperateRenoteQuote,
		showAdminUpdates,
		developerTicker,
		hiddenActivityChart,
		remoteEmojisFetch,
	],
	async () => {
		await reloadAsk();
	}
);

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.general,
	icon: "ph-gear-six ph-bold ph-lg",
});
</script>
