import { markRaw, ref } from "vue";
import { Storage } from "./pizzax";
import { Theme } from "./scripts/theme";

export const postFormActions = [];
export const userActions = [];
export const noteActions = [];
export const noteViewInterruptors = [];
export const notePostInterruptors = [];

const menuOptions = [
	"timeline",
	"notifications",
	"followRequests",
	"messaging",
	"explore",
	"pages",
	"clips",
	"channels",
	"search",
	"announcements",
	"reload",
];

// TODO: それぞれいちいちwhereとかdefaultというキーを付けなきゃいけないの冗長なのでなんとかする(ただ型定義が面倒になりそう)
//       あと、現行の定義の仕方なら「whereが何であるかに関わらずキー名の重複不可」という制約を付けられるメリットもあるからそのメリットを引き継ぐ方法も考えないといけない
export const defaultStore = markRaw(
	new Storage("base", {
		tutorial: {
			where: "account",
			default: 0,
			advanced: -1,
		},
		keepCw: {
			where: "account",
			default: true,
		},
		keepPostCw: {
			where: "account",
			default: true,
			createdAt: "2023/5/23",
			page: "general",
		},
		showFullAcct: {
			where: "account",
			default: false,
		},
		rememberNoteVisibility: {
			where: "account",
			default: false,
		},
		defaultNoteVisibility: {
			where: "account",
			default: "public",
		},
		defaultNoteLocalOnly: {
			where: "account",
			default: false,
		},
		defaultNoteLocalAndFollower: {
			where: "account",
			default: false,
			createdAt: "2023/5/11",
		},
		uploadFolder: {
			where: "account",
			default: null as string | null,
		},
		pastedFileName: {
			where: "account",
			default: "yyyy-MM-dd HH-mm-ss [{{number}}]",
		},
		keepOriginalUploading: {
			where: "account",
			default: true,
		},
		memo: {
			where: "account",
			default: null,
		},
		reactions: {
			where: "account",
			default: [
				":iine:",
				":igyo:",
				":tiken:",
				":pacochi_wakaru_cat:",
				":wakarimi:",
				":naruhodo:",
				":kusa:",
				":comfyyes:",
				":comfyno:",
				":sore:",
				":sorehasou:",
				":soudane:",
				":sore4:",
				":aruaru:",
				":saikou:",
				":arigato:",
				":otukaresama:",
				":kininaru:",
				":tashikani:",
				":yaruyan:",
				":oremoonajikimochi:",
				":watakushidattesoudesuwa:",
				":souiutokimoaru:",
				":ganbare_:",
				":ganbarone:",
				":ff14_BLU_1000Needles:",
				":iina_:",
				":oisisou:",
				":kanasiihanasi:",
				":shouganaihanashi:",
				":kowaihanashi:",
				":muzukashiihanashi_:",
				":ohayoo:",
				":taikin:",
				":oyasumi2:",
				":regretcar:",
				":tblob_avicii:",
			],
		},
		reactionsFolderName: {
			where: "account",
			default: "",
			createdAt: "2023/7/18",
			page: "reaction",
		},
		reactionsDefaultOpen: {
			where: 'account',
			default: true,
			createdAt: "2023/7/19",
			page: "reaction",
		},
		reactions2: {
			where: "account",
			default: [],
			createdAt: "2023/7/13",
			page: "reaction",
		},
		reactionsFolderName2: {
			where: "account",
			default: "",
			createdAt: "2023/7/18",
			page: "reaction",
		},
		reactions2DefaultOpen: {
			where: 'account',
			default: false,
			createdAt: "2023/7/19",
			page: "reaction",
		},
		reactions3: {
			where: "account",
			default: [],
			createdAt: "2023/7/13",
			page: "reaction",
		},
		reactionsFolderName3: {
			where: "account",
			default: "",
			createdAt: "2023/7/18",
			page: "reaction",
		},
		reactions3DefaultOpen: {
			where: 'account',
			default: false,
			createdAt: "2023/7/19",
			page: "reaction",
		},
		reactions4: {
			where: "account",
			default: [],
			createdAt: "2023/7/13",
			page: "reaction",
		},
		reactionsFolderName4: {
			where: "account",
			default: "",
			createdAt: "2023/7/18",
			page: "reaction",
		},
		reactions4DefaultOpen: {
			where: 'account',
			default: false,
			createdAt: "2023/7/19",
			page: "reaction",
		},
		reactions5: {
			where: "account",
			default: [],
			createdAt: "2023/7/13",
			page: "reaction",
		},
		reactionsFolderName5: {
			where: "account",
			default: "",
			createdAt: "2023/7/18",
			page: "reaction",
		},
		reactions5DefaultOpen: {
			where: 'account',
			default: false,
			createdAt: "2023/7/19",
			page: "reaction",
		},
		recentlyUsedDefaultOpen: {
			where: 'account',
			default: true,
			createdAt: "2023/7/19",
			page: "reaction",
		},
		hiddenRecent: {
			where: "account",
			default: false,
			createdAt: "2023/7/18",
			page: "reaction",
		},
		hiddenReactionDeckAndRecent: {
			where: "account",
			default: false,
			createdAt: "2023/6/30",
			page: "reaction",
		},
		doubleTapReaction: {
			where: "account",
			default: false,
			createdAt: "2023/7/18",
			page: "reaction",
		},
		mutedWords: {
			where: "account",
			default: [],
		},
		hiddenSoftMutes: {
			where: "account",
			default: false,
			createdAt: "2023/5/16",
			page: "word-mute",
		},
		muteExcludeReplyQuote: {
			where: "account",
			default: false,
			createdAt: "2023/6/12",
			page: "word-mute",
		},
		muteExcludeNotification: {
			where: "account",
			default: true,
			createdAt: "2023/6/12",
			page: "word-mute",
		},
		reactionMutedWords: {
			where: "account",
			default: [],
			createdAt: "2023/7/21",
			page: "word-mute",
		},
		mutedAds: {
			where: "account",
			default: [] as string[],
		},
		showAds: {
			where: "account",
			default: true,
		},
		enableAntennaTab: {
			where: "account",
			default: false,
			createdAt: "2023/6/12",
			page: "notifications",
		},
		localShowRenote: {
			where: "account",
			default: true,
		},
		remoteShowRenote: {
			where: "account",
			default: true,
		},
		showSelfRenoteToHome: {
			where: "account",
			default: true,
		},
		menu: {
			where: "deviceAccount",
			default: menuOptions,
		},
		visibility: {
			where: "deviceAccount",
			default: "public" as "public" | "home" | "followers" | "specified",
		},
		firstPostButtonVisibilityForce: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/16",
			page: "privacy",
		},
		firstPostWideButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		secondPostButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/2",
			page: "privacy",
		},
		secondPostVisibility: {
			where: "deviceAccount",
			default: "home" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
			advanced: "l-public" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
			createdAt: "2023/5/2",
			page: "privacy",
		},
		secondPostWideButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		thirdPostButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/3",
			page: "privacy",
		},
		thirdPostVisibility: {
			where: "deviceAccount",
			default: "l-public" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
			advanced: "home" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
			createdAt: "2023/5/3",
			page: "privacy",
		},
		thirdPostWideButton: {
			where: "deviceAccount",
			default: false,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		fourthPostButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		fourthPostVisibility: {
			where: "deviceAccount",
			default: "followers" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
			createdAt: "2023/5/26",
			page: "privacy",
		},
		fourthPostWideButton: {
			where: "deviceAccount",
			default: false,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		fifthPostButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		fifthPostVisibility: {
			where: "deviceAccount",
			default: "specified" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
			createdAt: "2023/5/26",
			page: "privacy",
		},
		fifthPostWideButton: {
			where: "deviceAccount",
			default: false,
			createdAt: "2023/5/26",
			page: "privacy",
		},
		channelSecondPostButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/16",
			page: "privacy",
		},
		localOnly: {
			where: "deviceAccount",
			default: false,
		},
		localAndFollower: {
			where: "deviceAccount",
			default: false,
			createdAt: "2023/5/11",
		},
		hiddenMFMHelp: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/16",
			page: "general",
		},
		hiddenCloseButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/26",
			page: "general",
		},
		hiddenMentionButton: {
			where: "deviceAccount",
			default: false,
			advanced: true,
			createdAt: "2023/5/25",
			page: "general",
		},
		hiddenAccountButton: {
			where: "deviceAccount",
			default: false,
			createdAt: "2023/10/23",
			page: "general",
		},
		CloseAllClearButton: {
			where: "deviceAccount",
			default: false,
			createdAt: "2023/10/23",
			page: "general",
		},
		openMentionWindow: {
			where: "deviceAccount",
			default: true,
			createdAt: "2023/5/25",
			page: "general",
		},
		statusbars: {
			where: "deviceAccount",
			default: [] as {
				name: string;
				id: string;
				type: string;
				size: "verySmall" | "small" | "medium" | "large" | "veryLarge";
				black: boolean;
				props: Record<string, any>;
			}[],
		},
		widgets: {
			where: "deviceAccount",
			default: [] as {
				name: string;
				id: string;
				place: string | null;
				data: Record<string, any>;
			}[],
		},
		tl: {
			where: "deviceAccount",
			default: {
				src: "social" as "home" | "local" | "social" | "global",
				arg: null,
			},
		},

		overridedDeviceKind: {
			where: "device",
			default: null as null | "smartphone" | "tablet" | "desktop" | "desktop-force",
		},
		showLocalPostsInTimeline: {
			where: "device",
			default: "home" as "home" | "social" | "both" | "none",
		},
		showLocalPostsInfoPopup: {
			where: "account",
			default: false,
			createdAt: "2023/7/28",
		},
		showInviteInfoPopupAccount: {
			where: "account",
			default: false,
			createdAt: "2023/8/7",
		},
		showInviteInfoPopupDevice: {
			where: "device",
			default: false,
			createdAt: "2023/8/7",
		},
		showMultiReactionInfoPopup: {
			where: "account",
			default: false,
			createdAt: "2023/10/24",
		},
		serverDisconnectedBehavior: {
			where: "device",
			default: "nothing" as "nothing" | "quiet" | "reload" | "dialog",
		},
		seperateRenoteQuote: {
			where: "device",
			default: true,
		},
		nsfw: {
			where: "device",
			default: "respect" as "respect" | "toCW" | "force" | "ignore",
		},
		animation: {
			where: "device",
			default: true,
		},
		animatedMfm: {
			where: "device",
			default: true,
		},
		animatedMfmWarnShown: {
			where: "device",
			default: false,
		},
		loadRawImages: {
			where: "device",
			default: true,
		},
		imageNewTab: {
			where: "device",
			default: false,
		},
		disableShowingAnimatedImages: {
			where: "device",
			default: false,
		},
		disablePagesScript: {
			where: "device",
			default: false,
		},
		useOsNativeEmojis: {
			where: "device",
			default: false,
		},
		useBigCustom: {
			where: "device",
			default: false,
			createdAt: "2023/6/1",
		},
		disableDrawer: {
			where: "device",
			default: false,
		},
		useBlurEffectForModal: {
			where: "device",
			default: false,
		},
		useBlurEffect: {
			where: "device",
			default: false,
		},
		showFixedPostForm: {
			where: "device",
			default: true,
			advanced: false,
		},
		enableInfiniteScroll: {
			where: "device",
			default: true,
		},
		useReactionPickerForContextMenu: {
			where: "device",
			default: false,
		},
		showGapBetweenNotesInTimeline: {
			where: "device",
			default: false,
		},
		darkMode: {
			where: "device",
			default: true,
		},
		instanceTicker: {
			where: "device",
			default: "always" as "none" | "remote" | "always",
		},
		reactionPickerSize: {
			where: "device",
			default: 3,
		},
		reactionPickerWidth: {
			where: "device",
			default: 3,
		},
		reactionPickerHeight: {
			where: "device",
			default: 3,
			advanced: 10,
		},
		usePickerSizePostForm: {
			where: "device",
			default: false,
			createdAt: "2023/8/29",
			page: "reaction",
		},
		emojiPickerUseDrawerForMobile: {
			where: "device",
			default: false,
		},
		reactionPickerUseDrawerForMobile: {
			where: "device",
			default: false,
			createdAt: "2023/4/25",
		},
		recentlyUsedEmojis: {
			where: "device",
			default: [] as string[],
		},
		recentlyUsedUsers: {
			where: "device",
			default: [] as string[],
		},
		defaultSideView: {
			where: "device",
			default: false,
		},
		menuDisplay: {
			where: "device",
			default: "sideFull" as "sideFull" | "sideIcon" | "top",
			advanced: "sideIcon" as "sideFull" | "sideIcon" | "top",
		},
		reportError: {
			where: "device",
			default: false,
		},
		squareAvatars: {
			where: "device",
			default: true,
		},
		postFormWithHashtags: {
			where: "device",
			default: false,
		},
		postFormHashtags: {
			where: "device",
			default: "",
		},
		postFormCw: {
			where: "device",
			default: "",
			createdAt: "2023/5/26",
		},
		themeInitial: {
			where: "device",
			default: true,
		},
		numberOfPageCache: {
			where: "device",
			default: 4,
		},
		enterSendsMessage: {
			where: "device",
			default: false,
		},
		openEmojiPicker: {
			where: "device",
			default: true,
			createdAt: "2023/5/25",
			page: "general",
		},
		notCloseEmojiPicker: {
			where: "device",
			default: true,
			createdAt: "2023/4/24",
			page: "general",
		},
		smartMFMInputer: {
			where: "device",
			default: true,
			createdAt: "2023/5/25",
			page: "general",
		},
		quickToggleSmartMFMInputer: {
			where: "device",
			default: false,
			createdAt: "2023/8/24",
			page: "general",
		},
		showUpdates: {
			where: "device",
			default: true,
		},
		showMiniUpdates: {
			where: "device",
			default: false,
			createdAt: "2023/6/1",
		},
		swipeOnDesktop: {
			where: "device",
			default: true,
		},
		swipeTouchAngle: {
			where: "device",
			default: 25,
			createdAt: "2023/8/7",
			page: "general",
		},
		swipeThreshold: {
			where: "device",
			default: 10,
			createdAt: "2023/8/7",
			page: "general",
		},
		swipeCenteredSlides: {
			where: "device",
			default: true,
			createdAt: "2023/8/7",
			page: "general",
		},
		showAdminUpdates: {
			where: "account",
			default: true,
		},
		woozyMode: {
			where: "device",
			default: false,
		},
		enableCustomKaTeXMacro: {
			where: "device",
			default: false,
		},
		enableEmojiReactions: {
			where: "account",
			default: true,
			createdAt: "2023/5/29",
		},
		showEmojiButton: {
			where: "account",
			default: true,
		},
		showEmojisInReactionNotifications: {
			where: "account",
			default: true,
		},
		favButtonReaction: {
			where: "account",
			default: "custom",
			advanced: "favorite",
			createdAt: "2023/5/9",
			page: "reaction",
		},
		favButtonReactionCustom: {
			where: "account",
			default: ":iine:",
			createdAt: "2023/5/9",
		},
		powerMode: {
			where: "device",
			default: false,
			advanced: true,
			createdAt: "2023/5/15",
			page: "general",
		},
		powerModeColorful: {
			where: "device",
			default: false,
			advanced: true,
			createdAt: "2023/5/15",
			page: "general",
		},
		powerModeNoShake: {
			where: "device",
			default: false,
			advanced: true,
			createdAt: "2023/5/15",
			page: "general",
		},
		developer: {
			where: "account",
			default: false,
			createdAt: "2023/5/26",
		},
		developerRenote: {
			where: "account",
			default: false,
			createdAt: "2023/5/29",
		},
		developerQuote: {
			where: "account",
			default: false,
			createdAt: "2023/5/29",
		},
		developerNoteMenu: {
			where: "account",
			default: false,
			createdAt: "2023/5/29",
		},
		developerTicker: {
			where: "account",
			default: false,
			createdAt: "2023/6/9",
		},
		completedReInit: {
			where: "device",
			default: false,
			createdAt: "2023/6/2",
		},
		hiddenActivityChart: {
			where: "device",
			default: false,
			createdAt: "2023/6/9",
			page: "general",
		},
		showRelationMark: {
			where: "account",
			default: false,
			advanced: true,
			createdAt: "2023/6/27",
			page: "general",
		},
		reactionAutoFocusSearchBar: {
			where: "device",
			default: !/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()),
			createdAt: "2023/7/3",
			page: "reaction",
		},
		postAutoFocusSearchBar: {
			where: "device",
			default: !/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()),
			createdAt: "2023/7/3",
			page: "general",
		},
		reactionShowUsername: {
			where: "device",
			default: false,
			createdAt: "2023/7/6",
			page: "general",
		},
		reactionShowShort: {
			where: "device",
			default: false,
			advanced: true,
			createdAt: "2023/7/6",
			page: "general",
		},
		japanCategory: {
			where: "account",
			default: true,
			createdAt: "2023/7/7",
			page: "reaction",
		},
		remoteEmojisFetch: {
			where: "device",
			default: "all" as "all" | "plus" | "keep" | "none" | "always",
			createdAt: "2023/7/10",
			page: "reaction",
		},
		keepFileName: {
			where: "account",
			default: false,
			createdAt: "2023/7/11",
			page: "drive",
		},
		enableDataSaverMode: {
			where: 'device',
			default: false,
			createdAt: "2023/7/11",
			page: "general",
		},
		autoSwitchDataSaver: {
			where: 'device',
			default: false,
			createdAt: "2023/8/15",
			page: "general",
		},
		recentRenoteId: {
			where: 'device',
			default: [],
			createdAt: "2023/7/18",
		},
		recentRenoteHidden: {
			where: 'account',
			default: true,
			createdAt: "2023/7/18",
			page: "general",
		},
		reactedRenoteHidden: {
			where: 'account',
			default: true,
			createdAt: "2023/7/18",
			page: "general",
		},
		showDetailNoteClick: {
			where: 'account',
			default: true,
			createdAt: "2023/7/18",
			page: "general",
		},
		alwaysPostButton: {
			where: 'device',
			default: false,
			createdAt: "2023/7/19",
			page: "general",
		},
		showMkkeySettingTips: {
			where: 'device',
			default: !/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()),
			createdAt: "2023/7/21",
			page: "general",
		},
		showSpotlight: {
			where: 'account',
			default: false,
			createdAt: "2023/7/23",
		},
		thirdTimelineType: {
			where: 'account',
			default: "media",
			createdAt: "2023/08/10",
			page: "general",
		},
		thirdTimelineListId: {
			where: 'account',
			default: "",
			createdAt: "2023/08/10",
		},
		fourthTimelineType: {
			where: 'account',
			default: "media",
			createdAt: "2023/10/21",
			page: "general",
		},
		fourthTimelineListId: {
			where: 'account',
			default: "",
			createdAt: "2023/10/21",
		},
		mobileThirdButton: {
			where: 'account',
			default: "reload",
			createdAt: "2023/7/25",
			page: "navbar",
		},
		noteAllCw: {
			where: 'device',
			default: false,
			createdAt: "2023/7/25",
			page: "general",
		},
		enableInstanceEmojiSearch: {
			where: 'account',
			default: false,
			createdAt: "2023/7/26",
			page: "reaction",
		},
		longLoading: {
			where: 'device',
			default: false,
			createdAt: "2023/7/28",
			page: "general",
		},
		plusInfoPostForm: {
			where: 'device',
			default: false,
			createdAt: "2023/7/28",
			page: "general",
		},
		dontShowNotSet: {
			where: 'account',
			default: false,
			createdAt: "2023/7/31",
			page: "mkkey-settings",
		},
		thumbnailCover: {
			where: 'device',
			default: false,
			createdAt: "2023/8/1",
			page: "general",
		},
		alwaysXExpand: {
			where: 'device',
			default: false,
			createdAt: "2023/8/2",
			page: "general",
		},
		disableAllIncludesSearch: {
			where: 'device',
			default: false,
			createdAt: "2023/8/3",
			page: "reaction",
		},
		showRemoteEmojiPostForm: {
			where: 'account',
			default: false,
			createdAt: "2023/8/21",
		},
		copyPostRemoteEmojiCode: {
			where: 'account',
			default: false,
			createdAt: "2023/9/25",
		},
		compactGrid: {
			where: 'device',
			default: false,
			createdAt: "2023/8/23",
			page: "general",
		},
		doContextMenu: {
			where: 'device',
			default: !/mobile|iphone|android/.test(navigator.userAgent.toLowerCase()) ? 'contextMenu' : 'doNothing',
			createdAt: "2023/8/24",
			page: "general",
		},
		showPreview: {
			where: 'device',
			default: true,
			createdAt: "2023/8/24",
		},
		alwaysInputFilename: {
			where: 'device',
			default: false,
			createdAt: "2023/8/25",
			page: "drive",
		},
		enabledAirReply: {
			where: 'account',
			default: false,
			createdAt: "2023/9/25",
			page: "general",
		},
		hiddenReactionNumber: {
			where: 'device',
			default: false,
			createdAt: "2023/9/29",
			page: "reaction",
		},
		userSelectFontFamily: {
			where: 'device',
			default: false,
			createdAt: "2023/9/29",
			page: "theme",
		},
		hiddenLTL: {
			where: 'device',
			default: false,
			createdAt: "2023/10/21",
			page: "general",
		},
		hiddenGTL: {
			where: 'device',
			default: false,
			createdAt: "2023/10/21",
			page: "general",
		},
		showLocalTimelineBelowPublic: {
			where: 'account',
			default: false,
			createdAt: "2023/11/9",
			page: "general",
		},
		noteReactionMenu: {
			where: 'device',
			default: true,
			createdAt: "2023/11/11",
			page: "general",
		},
		showReactionMenu: {
			where: 'device',
			default: false,
			createdAt: "2023/11/11",
			page: "reactions",
		},
	}),
);

// TODO: 他のタブと永続化されたstateを同期

const PREFIX = "miux:";

type Plugin = {
	id: string;
	name: string;
	active: boolean;
	configData: Record<string, any>;
	token: string;
	ast: any[];
};

/**
 * 常にメモリにロードしておく必要がないような設定情報を保管するストレージ(非リアクティブ)
 */
import lightTheme from "@/themes/l-rosepinedawn.json5";
import darkTheme from "@/themes/d-rosepine.json5";

export class ColdDeviceStorage {
	public static default = {
		lightTheme,
		darkTheme,
		syncDeviceDarkMode: false,
		plugins: [] as Plugin[],
		mediaVolume: 0.5,
		sound_masterVolume: 0.3,
		sound_note: { type: "none", volume: 0 },
		sound_noteMy: { type: "syuilo/up", volume: 1 },
		sound_notification: { type: "syuilo/pope2", volume: 1 },
		sound_chat: { type: "syuilo/pope1", volume: 1 },
		sound_chatBg: { type: "syuilo/waon", volume: 1 },
		sound_antenna: { type: "syuilo/triple", volume: 1 },
		sound_channel: { type: "syuilo/square-pico", volume: 1 },
	};

	public static watchers = [];

	public static get<T extends keyof typeof ColdDeviceStorage.default>(
		key: T,
	): typeof ColdDeviceStorage.default[T] {
		// TODO: indexedDBにする
		//       ただしその際はnullチェックではなくキー存在チェックにしないとダメ
		//       (indexedDBはnullを保存できるため、ユーザーが意図してnullを格納した可能性がある)
		const value = localStorage.getItem(PREFIX + key);
		if (value == null) {
			return ColdDeviceStorage.default[key];
		} else {
			return JSON.parse(value);
		}
	}

	public static set<T extends keyof typeof ColdDeviceStorage.default>(
		key: T,
		value: typeof ColdDeviceStorage.default[T],
	): void {
		// 呼び出し側のバグ等で undefined が来ることがある
		// undefined を文字列として localStorage に入れると参照する際の JSON.parse でコケて不具合の元になるため無視
		if (value === undefined) {
			console.error(`attempt to store undefined value for key '${key}'`);
			return;
		}

		localStorage.setItem(PREFIX + key, JSON.stringify(value));

		for (const watcher of this.watchers) {
			if (watcher.key === key) watcher.callback(value);
		}
	}

	public static watch(key, callback) {
		this.watchers.push({ key, callback });
	}

	// TODO: VueのcustomRef使うと良い感じになるかも
	public static ref<T extends keyof typeof ColdDeviceStorage.default>(key: T) {
		const v = ColdDeviceStorage.get(key);
		const r = ref(v);
		// TODO: このままではwatcherがリークするので開放する方法を考える
		this.watch(key, (v) => {
			r.value = v;
		});
		return r;
	}

	/**
	 * 特定のキーの、簡易的なgetter/setterを作ります
	 * 主にvue場で設定コントロールのmodelとして使う用
	 */
	public static makeGetterSetter<
		K extends keyof typeof ColdDeviceStorage.default,
	>(key: K) {
		// TODO: VueのcustomRef使うと良い感じになるかも
		const valueRef = ColdDeviceStorage.ref(key);
		return {
			get: () => {
				return valueRef.value;
			},
			set: (value: unknown) => {
				const val = value;
				ColdDeviceStorage.set(key, val);
			},
		};
	}
}

// このファイルに書きたくないけどここに書かないと何故かVeturが認識しない
declare module "@vue/runtime-core" {
	interface ComponentCustomProperties {
		$store: typeof defaultStore;
	}
}
