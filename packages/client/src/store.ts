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
		},
		keepCw: {
			where: "account",
			default: true,
		},
		keepPostCw: {
			where: "account",
			default: true,
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
				":ablobdj:",
			],
		},
		mutedWords: {
			where: "account",
			default: [],
		},
		hiddenSoftMutes: {
			where: "account",
			default: false,
		},
		mutedAds: {
			where: "account",
			default: [] as string[],
		},
		showAds: {
			where: "account",
			default: true,
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
		},
		firstPostWideButton: {
			where: "deviceAccount",
			default: false,
		},
		secondPostButton: {
			where: "deviceAccount",
			default: false,
		},
		secondPostVisibility: {
			where: "deviceAccount",
			default: "home" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
		},
		secondPostWideButton: {
			where: "deviceAccount",
			default: false,
		},
		thirdPostButton: {
			where: "deviceAccount",
			default: false,
		},
		thirdPostVisibility: {
			where: "deviceAccount",
			default: "l-public" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
		},
		thirdPostWideButton: {
			where: "deviceAccount",
			default: false,
		},
		fourthPostButton: {
			where: "deviceAccount",
			default: false,
		},
		fourthPostVisibility: {
			where: "deviceAccount",
			default: "followers" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
		},
		fourthPostWideButton: {
			where: "deviceAccount",
			default: false,
		},
		fifthPostButton: {
			where: "deviceAccount",
			default: false,
		},
		fifthPostVisibility: {
			where: "deviceAccount",
			default: "specified" as "public" | "l-public" | "home" | "l-home" | "followers" | "specified",
		},
		fifthPostWideButton: {
			where: "deviceAccount",
			default: false,
		},
		channelSecondPostButton: {
			where: "deviceAccount",
			default: false,
		},
		localOnly: {
			where: "deviceAccount",
			default: false,
		},
		localAndFollower: {
			where: "deviceAccount",
			default: false,
		},
		hiddenMFMHelp: {
			where: "deviceAccount",
			default: false,
		},
		hiddenCloseButton: {
			where: "deviceAccount",
			default: false,
		},
		hiddenMentionButton: {
			where: "deviceAccount",
			default: false,
		},
		openMentionWindow: {
			where: "deviceAccount",
			default: true,
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
			default: null as null | "smartphone" | "tablet" | "desktop",
		},
		showLocalPostsInTimeline: {
			where: "device",
			default: "home" as "home" | "social",
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
			default: "respect" as "respect" | "force" | "ignore",
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
		},
		emojiPickerUseDrawerForMobile: {
			where: "device",
			default: false,
		},
		reactionPickerUseDrawerForMobile: {
			where: "device",
			default: false,
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
		},
		notCloseEmojiPicker: {
			where: "device",
			default: true,
		},
		smartMFMInputer: {
			where: "device",
			default: true,
		},
		showUpdates: {
			where: "device",
			default: true,
		},
		showMiniUpdates: {
			where: "device",
			default: false,
		},
		swipeOnDesktop: {
			where: "device",
			default: false,
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
			default: "",
		},
		favButtonReactionCustom: {
			where: "account",
			default: "",
		},
		powerMode: {
			where: "device",
			default: false,
		},
		powerModeColorful: {
			where: "device",
			default: false,
		},
		powerModeNoShake: {
			where: "device",
			default: false,
		},
		developer: {
			where: "account",
			default: false,
		},
		developerRenote: {
			where: "account",
			default: false,
		},
		developerQuote: {
			where: "account",
			default: false,
		},
		developerNoteMenu: {
			where: "account",
			default: false,
		},
		completedReInit: {
			where: "device",
			default: false,
		}
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
