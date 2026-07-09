import { AsyncComponentLoader, defineAsyncComponent, inject } from "vue";
import { throttle } from "throttle-debounce";
import { Router } from "@/nirax";
import { getScrollContainerApi, onScrollActivity } from "@/scripts/scroll-container";
import { $i, iAmModerator } from "@/account";
import MkLoading from "@/pages/_loading_.vue";
import MkError from "@/pages/_error_.vue";
import { api } from "@/os";
import { ui } from "@/config";

function getGuestTimelineStatus() {
	api("meta", {
		detail: false,
	}).then((meta) => {
		return meta.enableGuestTimeline;
	});
}

const guestTimeline = getGuestTimelineStatus();

const page = (loader: AsyncComponentLoader<any>) =>
	defineAsyncComponent({
		loader: loader,
		loadingComponent: MkLoading,
		errorComponent: MkError,
	});

export const routes = [
	{
		path: "/@:initUser/pages/:initPageName/view-source",
		component: page(() => import("./pages/page-editor/page-editor.vue")),
	},
	{
		path: "/@:username/pages/:pageName",
		component: page(() => import("./pages/page.vue")),
	},
	{
		path: "/@:username/categories/:categoryId",
		component: page(() => import("./pages/category.vue")),
	},
	{
		path: "/@:acct/following",
		component: page(() => import("./pages/user/following.vue")),
	},
	{
		path: "/@:acct/followers",
		component: page(() => import("./pages/user/followers.vue")),
	},
	{
		name: "user",
		path: "/@:acct/:page?",
		component: page(() => import("./pages/user/index.vue")),
	},
	{
		name: "note",
		path: "/notes/:noteId",
		component: page(() => import("./pages/note.vue")),
	},
	{
		name: "note-option",
		path: "/notes/:noteId/:option",
		component: page(() => import("./pages/note.vue")),
	},
	{
		path: "/clips/:clipId",
		component: page(() => import("./pages/clip.vue")),
	},
	{
		path: "/user-info/:userId",
		component: page(() => import("./pages/user-info.vue")),
	},
	{
		path: "/instance-info/:host",
		component: page(() => import("./pages/instance-info.vue")),
	},
	{
		name: "settings",
		path: "/settings",
		component: page(() => import("./pages/settings/index.vue")),
		loginRequired: true,
		children: [
                        {
                                path: "/profile",
                                name: "profile",
                                component: page(() => import("./pages/settings/profile.vue")),
                        },
                        {
                                path: "/profile/icon-generator",
                                name: "profile-icon-generator",
                                component: page(
                                        () =>
                                                import(
                                                        "./pages/settings/profile.icon-generator.vue"
                                                ),
                                ),
                        },
			{
				path: "/privacy",
				name: "privacy",
				component: page(() => import("./pages/settings/privacy.vue")),
			},
			{
				path: "/reaction",
				name: "reaction",
				component: page(() => import("./pages/settings/reaction.vue")),
			},
			{
				path: "/drive",
				name: "drive",
				component: page(() => import("./pages/settings/drive.vue")),
			},
			{
				path: "/notifications",
				name: "notifications",
				component: page(() => import("./pages/settings/notifications.vue")),
			},
			{
				path: "/email",
				name: "email",
				component: page(() => import("./pages/settings/email.vue")),
			},
			{
				path: "/integration",
				name: "integration",
				component: page(() => import("./pages/settings/integration.vue")),
			},
			{
				path: "/security",
				name: "security",
				component: page(() => import("./pages/settings/security.vue")),
			},
			{
				path: "/general",
				name: "general",
				component: page(() => import("./pages/settings/general.vue")),
			},
			{
				path: "/timeline",
				name: "timeline",
				component: page(() => import("./pages/settings/timeline.vue")),
			},
			{
				path: "/behavior",
				name: "behavior",
				component: page(() => import("./pages/settings/behavior.vue")),
			},
			{
				path: "/postform",
				name: "postform",
				component: page(() => import("./pages/settings/postform.vue")),
			},
			{
				path: "/appearance",
				name: "appearance",
				component: page(() => import("./pages/settings/appearance.vue")),
			},
			{
				path: "/fun",
				name: "fun",
				component: page(() => import("./pages/settings/fun.vue")),
			},
			{
				path: "/theme/install",
				name: "theme",
				component: page(() => import("./pages/settings/theme.install.vue")),
			},
			{
				path: "/theme/manage",
				name: "theme",
				component: page(() => import("./pages/settings/theme.manage.vue")),
			},
			{
				path: "/theme/editor",
				name: "theme",
				component: page(() => import("./pages/settings/theme.edit.vue")),
			},
			{
				path: "/theme",
				name: "theme",
				component: page(() => import("./pages/settings/theme.vue")),
			},
			{
				path: "/custom-css/edit/:snippetId",
				name: "custom-css-edit",
				component: page(
					() => import("./pages/settings/custom-css.edit.vue"),
				),
			},
			{
				path: "/custom-css",
				name: "custom-css",
				component: page(() => import("./pages/settings/custom-css.vue")),
			},
			{
				path: "/custom-katex-macro",
				name: "custom-katex-macro",
				component: page(
					() => import("./pages/settings/custom-katex-macro.vue"),
				),
			},
			{
				path: "/account-info",
				name: "account-info",
				component: page(() => import("./pages/settings/account-info.vue")),
			},
                        {
                                path: "/navbar",
                                name: "navbar",
                                component: page(() => import("./pages/settings/navbar.vue")),
                        },
                        {
                                path: "/deck-remote-emojis",
                                name: "deck-remote-emojis",
                                component: page(() => import("./pages/settings/deck-remote-emojis.vue")),
                        },
                        {
                                path: "/emoji-picker-order",
                                name: "emoji-picker-order",
                                component: page(() => import("./pages/settings/emoji-picker-order.vue")),
                        },
                        {
                                path: "/statusbar",
                                name: "statusbar",
                                component: page(() => import("./pages/settings/statusbar.vue")),
                        },
			{
				path: "/sounds",
				name: "sounds",
				component: page(() => import("./pages/settings/sounds.vue")),
			},
			{
				path: "/plugin/install",
				name: "plugin",
				component: page(() => import("./pages/settings/plugin.install.vue")),
			},
			{
				path: "/plugin",
				name: "plugin",
				component: page(() => import("./pages/settings/plugin.vue")),
			},
			{
				path: "/import-export",
				name: "import-export",
				component: page(() => import("./pages/settings/import-export.vue")),
			},
			{
				path: "/instance-mute",
				name: "instance-mute",
				component: page(() => import("./pages/settings/instance-mute.vue")),
			},
			{
				path: "/mute-block",
				name: "mute-block",
				component: page(() => import("./pages/settings/mute-block.vue")),
			},
			{
				path: "/word-mute",
				name: "word-mute",
				component: page(() => import("./pages/settings/word-mute.vue")),
			},
			{
				path: "/api",
				name: "api",
				component: page(() => import("./pages/settings/api.vue")),
			},
			{
				path: "/apps",
				name: "api",
				component: page(() => import("./pages/settings/apps.vue")),
			},
			{
				path: "/webhook/new-simple",
				name: "webhook",
				component: page(
					() => import("./pages/settings/webhook.new.simple.vue"),
				),
			},
			{
				path: "/webhook/edit/:webhookId",
				name: "webhook",
				component: page(() => import("./pages/settings/webhook.edit.vue")),
			},
			{
				path: "/webhook/new",
				name: "webhook",
				component: page(() => import("./pages/settings/webhook.new.vue")),
			},
			{
				path: "/webhook",
				name: "webhook",
				component: page(() => import("./pages/settings/webhook.vue")),
			},
			{
				path: "/deck",
				name: "deck",
				component: page(() => import("./pages/settings/deck.vue")),
			},
			{
				path: "/delete-account",
				name: "delete-account",
				component: page(() => import("./pages/settings/delete-account.vue")),
			},
			{
				path: "/preferences-backups",
				name: "preferences-backups",
				component: page(
					() => import("./pages/settings/preferences-backups.vue"),
				),
			},
			{
				path: "/migration",
				name: "migration",
				component: page(() => import("./pages/settings/migration.vue")),
			},
			{
				path: "/custom-css/edit/:snippetId",
				name: "custom-css-edit",
				component: page(
					() => import("./pages/settings/custom-css.edit.vue"),
				),
			},
			{
				path: "/custom-css",
				name: "general",
				component: page(() => import("./pages/settings/custom-css.vue")),
			},
			{
				path: "/custom-katex-macro",
				name: "general",
				component: page(
					() => import("./pages/settings/custom-katex-macro.vue"),
				),
			},
			{
				path: "/accounts",
				name: "profile",
				component: page(() => import("./pages/settings/accounts.vue")),
			},
			{
				path: "/account-info",
				name: "other",
				component: page(() => import("./pages/settings/account-info.vue")),
			},
			{
				path: "/delete-account",
				name: "other",
				component: page(() => import("./pages/settings/delete-account.vue")),
			},
			{
				path: "/other",
				name: "other",
				component: page(() => import("./pages/settings/other.vue")),
			},
			{
				path: "/mkkey-settings",
				name: "mkkey-settings",
				component: page(() => import("./pages/settings/mkkey-settings.vue")),
			},
			{
				path: "/",
				component: page(() => import("./pages/_empty_.vue")),
			},
		],
	},
	{
		path: "/reset-password/:token?",
		component: page(() => import("./pages/reset-password.vue")),
	},
	{
		path: "/signup-complete/:code",
		component: page(() => import("./pages/signup-complete.vue")),
	},
	{
		path: "/verify-email/:code",
		component: page(() => import("./pages/verify-email.vue")),
	},
	{
		path: "/announcements",
		component: page(() => import("./pages/announcements.vue")),
	},
	{
		path: "/about",
		component: page(() => import("./pages/about.vue")),
		hash: "initialTab",
	},
	{
		path: "/about-calckey",
		component: page(() => import("./pages/about-calckey.vue")),
	},
	{
		path: "/about-cluckey",
		component: page(() => import("./pages/about-calckey.vue")),
	},
	{
		path: "/theme-editor",
		component: page(() => import("./pages/theme-editor.vue")),
		loginRequired: true,
	},
	{
		path: "/explore/tags/:tag",
		component: page(() => import("./pages/explore.vue")),
	},
	{
		path: "/explore",
		component: page(() => import("./pages/explore.vue")),
	},
	{
		path: "/search",
		component: page(() => import("./pages/search.vue")),
		loginRequired: true,
		query: {
			q: "query",
			channel: "channel",
			user: "user",
		},
	},
	{
		path: "/authorize-follow",
		component: page(() => import("./pages/follow.vue")),
		loginRequired: true,
	},
	{
		path: "/share",
		component: page(() => import("./pages/share.vue")),
		loginRequired: true,
	},
	{
		path: "/api-console",
		component: page(() => import("./pages/api-console.vue")),
		loginRequired: true,
	},
	{
		path: "/mfm-cheat-sheet",
		component: page(() => import("./pages/mfm-cheat-sheet.vue")),
	},
	{
		path: "/errorlog",
		component: page(() => import("./pages/errorlog.vue")),
	},
	{
		path: "/scratchpad",
		component: page(() => import("./pages/scratchpad.vue")),
	},
	{
		path: "/preview",
		component: page(() => import("./pages/preview.vue")),
	},
	{
		path: "/auth/:token",
		component: page(() => import("./pages/auth.vue")),
	},
	{
		path: "/miauth/:session",
		component: page(() => import("./pages/miauth.vue")),
		query: {
			callback: "callback",
			name: "name",
			icon: "icon",
			permission: "permission",
		},
	},
	{
		path: "/tags/:tag",
		component: page(() => import("./pages/tag.vue")),
		loginRequired: true,
		query: {
			user: "user",
		},
	},
	{
		path: "/pages/new",
		component: page(() => import("./pages/page-editor/page-editor.vue")),
		loginRequired: true,
	},
	{
		path: "/pages/edit/:initPageId",
		component: page(() => import("./pages/page-editor/page-editor.vue")),
		loginRequired: true,
	},
	{
		path: "/pages",
		component: page(() => import("./pages/pages.vue")),
	},
	{
		path: "/categories",
		component: page(() => import("./pages/categories.vue")),
	},
	{
		path: "/categories/edit/:initCategoryId",
		component: page(() => import("./pages/category-edit.vue")),
		loginRequired: true,
	},
	{
		path: "/categories/new",
		component: page(() => import("./pages/category-edit.vue")),
		loginRequired: true,
	},
	{
		path: "/gallery/:postId/edit",
		component: page(() => import("./pages/gallery/edit.vue")),
		loginRequired: true,
	},
	{
		path: "/gallery/new",
		component: page(() => import("./pages/gallery/edit.vue")),
		loginRequired: true,
	},
	{
		path: "/gallery/:postId",
		component: page(() => import("./pages/gallery/post.vue")),
	},
	{
		path: "/gallery",
		component: page(() => import("./pages/gallery/index.vue")),
	},
	{
		path: "/channels/:channelId/edit",
		component: page(() => import("./pages/channel-editor.vue")),
		loginRequired: true,
	},
	{
		path: "/channels/new",
		component: page(() => import("./pages/channel-editor.vue")),
		loginRequired: true,
	},
	{
		path: "/channels/:channelId",
		component: page(() => import("./pages/channel.vue")),
	},
	{
		path: "/channels",
		component: page(() => import("./pages/channels.vue")),
	},
	{
		path: "/registry/keys/system/:path(*)?",
		component: page(() => import("./pages/registry.keys.vue")),
	},
	{
		path: "/registry/value/system/:path(*)?",
		component: page(() => import("./pages/registry.value.vue")),
	},
	{
		path: "/registry",
		component: page(() => import("./pages/registry.vue")),
	},
	{
		path: "/admin/file/:fileId",
		component: iAmModerator
			? page(() => import("./pages/admin-file.vue"))
			: page(() => import("./pages/not-found.vue")),
	},
	{
		path: "/admin",
		component: iAmModerator
			? page(() => import("./pages/admin/index.vue"))
			: page(() => import("./pages/not-found.vue")),
		children: [
			{
				path: "/overview",
				name: "overview",
				component: page(() => import("./pages/admin/overview.vue")),
			},
			{
				path: "/users",
				name: "users",
				component: page(() => import("./pages/admin/users.vue")),
			},
			{
				path: "/hashtags",
				name: "hashtags",
				component: page(() => import("./pages/admin/hashtags.vue")),
			},
			{
				path: "/emojis",
				name: "emojis",
				component: page(() => import("./pages/admin/emojis.vue")),
			},
			{
				path: "/emoji-import-requests",
				name: "emoji-import-requests",
				component: page(() => import("./pages/admin/emoji-import-requests.vue")),
			},
			{
				path: "/federation",
				name: "federation",
				component: page(() => import("./pages/admin/federation.vue")),
			},
			{
				path: "/queue",
				name: "queue",
				component: page(() => import("./pages/admin/queue.vue")),
			},
			{
				path: "/files",
				name: "files",
				component: page(() => import("./pages/admin/files.vue")),
			},
			{
				path: "/announcements",
				name: "announcements",
				component: page(() => import("./pages/admin/announcements.vue")),
			},
			{
				path: "/ads",
				name: "ads",
				component: page(() => import("./pages/admin/promotions.vue")),
			},
			{
				path: "/database",
				name: "database",
				component: page(() => import("./pages/admin/database.vue")),
			},
			{
				path: "/performance",
				name: "performance",
				component: page(() => import("./pages/admin/performance.vue")),
			},
			{
				path: "/abuses",
				name: "abuses",
				component: page(() => import("./pages/admin/abuses.vue")),
			},
			{
				path: "/settings",
				name: "settings",
				component: page(() => import("./pages/admin/settings.vue")),
			},
			{
				path: "/email-settings",
				name: "email-settings",
				component: page(() => import("./pages/admin/email-settings.vue")),
			},
			{
				path: "/object-storage",
				name: "object-storage",
				component: page(() => import("./pages/admin/object-storage.vue")),
			},
			{
				path: "/security",
				name: "security",
				component: page(() => import("./pages/admin/security.vue")),
			},
			{
				path: "/relays",
				name: "relays",
				component: page(() => import("./pages/admin/relays.vue")),
			},
			{
				path: "/integrations",
				name: "integrations",
				component: page(() => import("./pages/admin/integrations.vue")),
			},
			{
				path: "/instance-block",
				name: "instance-block",
				component: page(() => import("./pages/admin/instance-block.vue")),
			},
			{
				path: "/proxy-account",
				name: "proxy-account",
				component: page(() => import("./pages/admin/proxy-account.vue")),
			},
			{
				path: "/other-settings",
				name: "other-settings",
				component: page(() => import("./pages/admin/other-settings.vue")),
			},
			{
				path: "/other-settings",
				name: "other-settings",
				component: page(() => import("./pages/admin/custom-css.vue")),
			},
			{
				path: "/",
				component: page(() => import("./pages/_empty_.vue")),
			},
		],
	},
	{
		path: "/my/notifications",
		component: page(() => import("./pages/notifications.vue")),
		loginRequired: true,
	},
	{
		path: "/my/favorites",
		component: page(() => import("./pages/favorites.vue")),
		loginRequired: true,
	},
	{
		name: "messaging",
		path: "/my/messaging",
		component: page(() => import("./pages/messaging/index.vue")),
		loginRequired: true,
	},
	{
		path: "/my/messaging/:userAcct",
		component: page(() => import("./pages/messaging/messaging-room.vue")),
		loginRequired: true,
	},
	{
		path: "/my/messaging/group/:groupId",
		component: page(() => import("./pages/messaging/messaging-room.vue")),
		loginRequired: true,
	},
	{
		path: "/my/drive/folder/:folder",
		component: page(() => import("./pages/drive.vue")),
		loginRequired: true,
	},
	{
		path: "/my/drive",
		component: page(() => import("./pages/drive.vue")),
		loginRequired: true,
	},
	{
		path: "/my/follow-requests",
		component: page(() => import("./pages/follow-requests.vue")),
		loginRequired: true,
	},
	{
		path: "/my/lists/:listId",
		component: page(() => import("./pages/my-lists/list.vue")),
		loginRequired: true,
	},
	{
		path: "/my/lists",
		component: page(() => import("./pages/my-lists/index.vue")),
		loginRequired: true,
	},
	{
		path: "/my/clips",
		component: page(() => import("./pages/my-clips/index.vue")),
		loginRequired: true,
	},
	{
		path: "/my/groups",
		component: page(() => import("./pages/my-groups/index.vue")),
		loginRequired: true,
	},
	{
		path: "/my/groups/:groupId",
		component: page(() => import("./pages/my-groups/group.vue")),
		loginRequired: true,
	},
	{
		path: "/my/antennas/create",
		component: page(() => import("./pages/my-antennas/create.vue")),
		loginRequired: true,
	},
	{
		path: "/my/antennas/:antennaId",
		component: page(() => import("./pages/my-antennas/edit.vue")),
		loginRequired: true,
	},
	{
		path: "/my/antennas",
		component: page(() => import("./pages/my-antennas/index.vue")),
		loginRequired: true,
	},
	{
		path: "/my/emoji-import-requests",
		component: page(() => import("./pages/emoji-import-requests.vue")),
		loginRequired: true,
	},
	{
		path: "/timeline/list/:listId",
		component: page(() => import("./pages/user-list-timeline.vue")),
		loginRequired: true,
	},
	{
		path: "/timeline/antenna/:antennaId",
		component: page(() => import("./pages/antenna-timeline.vue")),
		loginRequired: true,
	},
	{
		path: "/emoji/:emoji",
		component: page(() => import("./components/MkCustomEmojiDetailed.vue")),
	},
	{
		path: "/emoji_license/:emoji",
		component: page(() => import("./components/MkCustomEmojiDetailed.vue")),
	},
	{
		path: "/emoji_dialog/:emoji",
		component: page(
			() => import("./components/MkCustomEmojiDetailedDialog.vue"),
		),
	},
	{
		path: "/light",
		component: page(() => import("./pages/external-app-redirect.vue")),
	},
	{
		path: "/cli",
		component: page(() => import("./pages/external-app-redirect.vue")),
	},
	{
		path: "/sc",
		component: page(() => import("./pages/external-app-redirect.vue")),
	},
	{
		name: "index",
		path: "/",
		component: $i
			? page(() => import("./pages/timeline.vue"))
			: page(() => import("./pages/welcome.vue")),
		globalCacheKey: "index",
	},
	{
		path: "/:(*)",
		component: page(() => import("./pages/not-found.vue")),
	},
];

export const mainRouter = new Router(
	routes,
	location.pathname + location.search + location.hash,
);

window.history.replaceState(
	{ key: mainRouter.getCurrentKey() },
	"",
	location.href,
);

// NOTE: スクロール位置は scroll-container API 経由で管理する（deck 対応済み）。
// UI シェルが provide する ScrollContainerApi を router が参照する。

const scrollPosStore = new Map<string, number>();

/** ユーザーが最後にスクロール操作した時刻（復元キャンセル判定用） */
let lastUserScrollAt = 0;

/** 復元処理中の履歴キー */
let restoringKey: string | null = null;

/** 現在の履歴キーにスクロール位置を保存する */
function saveScrollPosition(): void {
	const key = window.history.state?.key;
	if (key) {
		scrollPosStore.set(key, getScrollContainerApi().getScrollPosition());
	}
}

const saveScrollPositionThrottled = throttle(200, saveScrollPosition);

window.addEventListener(
	"scroll",
	() => {
		lastUserScrollAt = Date.now();
		saveScrollPositionThrottled();
	},
	{ passive: true },
);

// deck 列内スクロールも位置保存の対象にする
onScrollActivity(() => {
	lastUserScrollAt = Date.now();
	saveScrollPositionThrottled();
});

/** 順方向遷移時にページ先頭へスクロールする */
function scrollToTop(): void {
	getScrollContainerApi().scrollToTop("instant");
}

function restoreScrollPosition(key: string): void {
	const scrollPos = scrollPosStore.get(key) ?? 0;
	restoringKey = key;
	const restoreStartedAt = Date.now();

	getScrollContainerApi().setScrollPosition(scrollPos, "instant");

	// 遷移直後は sticky 高さ確定が遅れる場合があるため、レイアウト更新後に再試行する
	if (scrollPos !== 0) {
		const retryRestore = () => {
			if (restoringKey !== key) return;
			// ユーザーが復元開始後にスクロール操作した場合は中止
			if (lastUserScrollAt > restoreStartedAt) return;
			getScrollContainerApi().setScrollPosition(scrollPos, "instant");
			restoringKey = null;
		};

		const onStickyUpdated = () => {
			window.removeEventListener("mk:sticky-layout-updated", onStickyUpdated);
			retryRestore();
		};

		window.addEventListener("mk:sticky-layout-updated", onStickyUpdated, {
			once: true,
		});
		window.setTimeout(() => {
			window.removeEventListener("mk:sticky-layout-updated", onStickyUpdated);
			retryRestore();
		}, 150);
	} else {
		restoringKey = null;
	}
}

mainRouter.addListener("push", (ctx) => {
	try {
		saveScrollPosition();
		window.history.pushState({ key: ctx.key }, "", ctx.path);
		scrollToTop();
	} catch (error) {
		console.error("Error in push listener:", error);
	}
});

mainRouter.addListener("replace", (ctx) => {
	try {
		saveScrollPosition();
		window.history.replaceState({ key: ctx.key }, "", ctx.path);
		scrollToTop();
	} catch (error) {
		console.error("Error in replace listener:", error);
	}
});

mainRouter.addListener("same", () => {
	try {
		getScrollContainerApi().scrollToTop("smooth");
	} catch (error) {
		console.error("Error in same listener:", error);
	}
});

window.addEventListener("popstate", (event) => {
	try {
		saveScrollPosition();
		const key = event.state?.key;
		if (key) {
			mainRouter.replace(
				location.pathname + location.search + location.hash,
				key,
				false,
			);
			restoreScrollPosition(key);
		} else {
			getScrollContainerApi().scrollToTop("instant");
		}
	} catch (error) {
		console.error("Error in popstate listener:", error);
	}
});

window.addEventListener("load", () => {
	try {
		const key = window.history.state?.key;
		if (key) {
			restoreScrollPosition(key);
		}
	} catch (error) {
		console.error("Error in load event:", error);
	}
});
export function useRouter(): Router {
	return inject<Router | null>("router", null) ?? mainRouter;
}
