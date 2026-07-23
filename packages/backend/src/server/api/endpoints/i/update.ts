/**
 * @packageDocumentation
 *
 * 認証ユーザーのプロフィール・設定を更新する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/update`（POST `/api/i/update` で呼び出し）
 * - 認証必須。名前・説明・アバター・その他プロフィール項目を更新する。パラメータは任意。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import RE2 from "re2";
import * as mfm from "mfm-js";
import { JSDOM } from "jsdom";
import {
        publishMainStream,
        publishUserEvent,
        publishInternalEvent,
} from "@/services/stream.js";
import acceptAllFollowRequests from "@/services/following/requests/accept-all.js";
import { publishToFollowers } from "@/services/i/update.js";
import { extractCustomEmojisFromMfm } from "@/misc/extract-custom-emojis-from-mfm.js";
import { extractHashtags } from "@/misc/extract-hashtags.js";
import { updateUsertags } from "@/services/update-hashtag.js";
import { Users, DriveFiles, UserProfiles, Pages } from "@/models/index.js";
import type { User, ILocalUser } from "@/models/entities/user.js";
import type { UserProfile } from "@/models/entities/user-profile.js";
import { notificationTypes } from "@/types.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import { langmap } from "@/misc/langmap.js";
import { getHtml } from "@/misc/fetch.js";
import { safeForSql } from "@/misc/safe-for-sql.js";
import { HOUR } from "@/const.js";
import config from "@/config/index.js";
import { ApiError } from "../../error.js";
import define from "../../define.js";
import { isIncludeNgWord } from "@/misc/is-include-ng-word.js";
import { resolveUser } from "@/remote/resolve-user.js";
import { extractMentions } from "@/misc/extract-mentions.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:account",

	description:
		"自分のプロフィール・アカウント設定を更新する。名前・説明・アバター・バナー・ピン留めページ・通知設定など、変更したい項目だけ指定する。",

	limit: {
                duration: HOUR,
                max: 10,
        },

        errors: {
		noSuchAvatar: {
			message: "そのアイコンは存在しません。",
			code: "NO_SUCH_AVATAR",
			id: "539f3a45-f215-4f81-a9a8-31293640207f",
		},

		noSuchBanner: {
			message: "そのバナーは存在しません。",
			code: "NO_SUCH_BANNER",
			id: "0d8f5629-f210-41c2-9433-735831a58595",
		},

		avatarNotAnImage: {
			message: "アイコンとして指定されたファイルは画像ではありません。",
			code: "AVATAR_NOT_AN_IMAGE",
			id: "f419f9f8-2f4d-46b1-9fb4-49d3a2fd7191",
		},

		bannerNotAnImage: {
			message: "バナーとして指定されたファイルは画像ではありません。",
			code: "BANNER_NOT_AN_IMAGE",
			id: "75aedb19-2afd-4e6d-87fc-67941256fa60",
		},

		noSuchPage: {
			message: "そのpageは存在しません。",
			code: "NO_SUCH_PAGE",
			id: "8e01b590-7eb9-431b-a239-860e086c408e",
		},

		invalidRegexp: {
			message: "正規表現が正しくありません。",
			code: "INVALID_REGEXP",
			id: "0d786918-10df-41cd-8f33-8dec7d9a89a5",
		},

		detectBannedWords: {
			message: "禁止ワードが含まれています。",
			code: "DETECT_BANNED_WORDS",
			id: "56f35758-7dd5-468b-8439-5d6fb8ec9b8e",
		},

		noFixedName: {
			message: "名前を変更する前に自分を示す名前を入力する必要があります。",
			code: "NO_FIXED_NAME",
			id: "9a897e6e-6df9-c98b-9531-c6739f133acd",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "MeDetailed",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		name: { ...Users.nameSchema, nullable: true },
		description: { ...Users.descriptionSchema, nullable: true },
		followedMessage: { ...Users.followedMessageSchema, nullable: true },
		location: { ...Users.locationSchema, nullable: true },
		birthday: { ...Users.birthdaySchema, nullable: true },
		pinnedAge: {
			type: "integer",
			minimum: 6,
			maximum: 122,
			nullable: true,
		},
		lang: {
			type: "string",
			enum: [null, ...Object.keys(langmap)],
			nullable: true,
		},
		avatarId: { type: "string", format: "misskey:id", nullable: true },
		bannerId: { type: "string", format: "misskey:id", nullable: true },
		fields: {
			type: "array",
			minItems: 0,
			maxItems: 16,
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					value: { type: "string" },
				},
				required: ["name", "value"],
			},
		},
		isLocked: { type: "boolean" },
		isExplorable: { type: "boolean" },
		isRemoteExplorable: { type: "boolean" },
		hideOnlineStatus: { type: "boolean" },
		publicReactions: { type: "boolean" },
		carefulBot: { type: "boolean" },
		autoAcceptFollowed: { type: "boolean" },
		noCrawle: { type: "boolean" },
		preventAiLearning: { type: "boolean" },
		isBot: { type: "boolean" },
		isCat: { type: "boolean" },
		speakAsCat: { type: "boolean" },
		showTimelineReplies: { type: "boolean" },
		localShowRenote: { type: "boolean" },
		remoteShowRenote: { type: "boolean" },
		showSelfRenoteToHome: { type: "boolean" },
		injectFeaturedNote: { type: "boolean" },
		receiveAnnouncementEmail: { type: "boolean" },
		receiveUnreadSummaryEmail: { type: "boolean" },
		alwaysMarkNsfw: { type: "boolean" },
		autoSensitive: { type: "boolean" },
		ffVisibility: { type: "string", enum: ["public", "followers", "private"] },
		blockPostPublic: { type: "boolean" },
		blockPostHome: { type: "boolean" },
		blockPostNotLocal: { type: "boolean" },
		blockPostNotLocalPublic: { type: "boolean" },
		isSilentLocked: { type: "boolean" },
		isRemoteLocked: { type: "boolean" },
		isPublicLikeList: { type: "boolean" },
		disableNyaise: { type: "boolean" },
		pinnedPageId: { type: "string", format: "misskey:id", nullable: true },
		mutedWords: { type: "array" },
		reactionMutedWords: { type: "array" },
		rejectMuteReaction: { type: "boolean" },
		hideMutedAndBlockedUserReactions: { type: "boolean" },
		fixedName: { ...Users.nameSchema, nullable: true },
		mutedInstances: {
			type: "array",
			items: {
				type: "string",
			},
		},
		mutingNotificationTypes: {
			type: "array",
			items: {
				type: "string",
				enum: notificationTypes,
			},
		},
		emailNotificationTypes: {
			type: "array",
			items: {
				type: "string",
			},
		},
		/** 公開TLで警告ユーザ投稿を表示（閲覧者設定） */
		showWarnedUsersInPublicTimeline: { type: "boolean" },
		/** 未フォローの警告ユーザからのリアクションを受け入れる（投稿者設定・ローカルのみ有効） */
		receiveReactionsFromNonFollowedWarnedUsers: { type: "boolean" },
	},
} as const;

export default define(meta, paramDef, async (ps, _user, token) => {
	const user = await Users.findOneByOrFail({ id: _user.id });
	const isSecure = token == null;

	const updates = {} as Partial<User>;
	const profileUpdates = {} as Partial<UserProfile>;

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	if (ps.name != null) {
		if (_user.name && _user.name !== ps.name && !ps.fixedName && !_user.fixedName)
			throw new ApiError(meta.errors.noFixedName);
		if (!_user.isAdmin && ps.name.toLowerCase().includes("admin"))
			throw new ApiError(meta.errors.detectBannedWords, {
				reason: "You are not the admin.",
			});
		if (
			!(_user.isAdmin || _user.isModerator) &&
			ps.name.toLowerCase().includes("moderator")
		)
			throw new ApiError(meta.errors.detectBannedWords, {
				reason: "You are not a moderator.",
			});
		if (isIncludeNgWord(ps.name))
			throw new ApiError(meta.errors.detectBannedWords);
		updates.name = ps.name;
	}
	if (ps.description != null) {
		if (!_user.isAdmin && ps.description.toLowerCase().includes("admin"))
			throw new ApiError(meta.errors.detectBannedWords, {
				reason: "You are not the admin.",
			});
		if (
			!(_user.isAdmin || _user.isModerator) &&
			ps.description.toLowerCase().includes("moderator")
		)
			throw new ApiError(meta.errors.detectBannedWords);
		if (isIncludeNgWord(ps.description))
			throw new ApiError(meta.errors.detectBannedWords);
		profileUpdates.description = ps.description;
	}
	if (ps.fixedName != null) {
		if (!_user.isAdmin && ps.name.toLowerCase().includes("admin"))
			throw new ApiError(meta.errors.detectBannedWords, {
				reason: "You are not the admin.",
			});
		if (
			!(_user.isAdmin || _user.isModerator) &&
			ps.name.toLowerCase().includes("moderator")
		)
			throw new ApiError(meta.errors.detectBannedWords, {
				reason: "You are not a moderator.",
			});
		if (isIncludeNgWord(ps.name))
			throw new ApiError(meta.errors.detectBannedWords);
		updates.fixedName = ps.fixedName;
	}
	if (ps.lang !== undefined) profileUpdates.lang = ps.lang;
	if (ps.location !== undefined) profileUpdates.location = ps.location;
	if (ps.birthday !== undefined) profileUpdates.birthday = ps.birthday;
	if (ps.pinnedAge !== undefined) {
		profileUpdates.pinnedAge =
			ps.pinnedAge != null && ps.pinnedAge >= 6 && ps.pinnedAge <= 122
				? ps.pinnedAge
				: null;
	}
	if (ps.ffVisibility !== undefined)
		profileUpdates.ffVisibility = ps.ffVisibility;
	if (ps.followedMessage !== undefined) profileUpdates.followedMessage = ps.followedMessage;
	if (ps.avatarId !== undefined) updates.avatarId = ps.avatarId;
	if (ps.bannerId !== undefined) updates.bannerId = ps.bannerId;
	if (ps.mutedWords !== undefined) {
		// 正規表現の構文を検証する
		ps.mutedWords
			.filter((x) => !Array.isArray(x))
			.forEach((x) => {
				const regexp = x.match(/^\/(.+)\/(.*)$/);
				if (!regexp) throw new ApiError(meta.errors.invalidRegexp);

				try {
					new RE2(regexp[1], regexp[2]);
				} catch (err) {
					throw new ApiError(meta.errors.invalidRegexp);
				}
			});

		profileUpdates.mutedWords = ps.mutedWords;
		profileUpdates.enableWordMute = ps.mutedWords.length > 0;
		profileUpdates.reactionMutedWords = ps.reactionMutedWords;
	}
	if (ps.reactionMutedWords !== undefined) {
		// 正規表現の構文を検証する
		ps.reactionMutedWords
			.filter((x) => !Array.isArray(x))
			.forEach((x) => {
				const regexp = x.match(/^\/(.+)\/(.*)$/);
				if (!regexp) throw new ApiError(meta.errors.invalidRegexp);

				try {
					new RE2(regexp[1], regexp[2]);
				} catch (err) {
					throw new ApiError(meta.errors.invalidRegexp);
				}
			});

		profileUpdates.enableReactionMute = ps.reactionMutedWords.length > 0;
		profileUpdates.reactionMutedWords = ps.reactionMutedWords;
	}

	if (ps.rejectMuteReaction !== undefined) {
		profileUpdates.rejectMuteReaction = ps.rejectMuteReaction;
	}
	if (ps.hideMutedAndBlockedUserReactions !== undefined) {
		profileUpdates.hideMutedAndBlockedUserReactions =
			ps.hideMutedAndBlockedUserReactions;
	}
	if (ps.mutedInstances !== undefined)
		profileUpdates.mutedInstances = ps.mutedInstances;
	if (ps.mutingNotificationTypes !== undefined)
		profileUpdates.mutingNotificationTypes =
			ps.mutingNotificationTypes as typeof notificationTypes[number][];
	if (typeof ps.isLocked === "boolean") updates.isLocked = ps.isLocked;
	if (typeof ps.isExplorable === "boolean")
		updates.isExplorable = ps.isExplorable;
	if (typeof ps.isRemoteExplorable === "boolean")
		updates.isRemoteExplorable = ps.isRemoteExplorable;
	if (typeof ps.hideOnlineStatus === "boolean")
		updates.hideOnlineStatus = ps.hideOnlineStatus;
	if (typeof ps.publicReactions === "boolean")
		profileUpdates.publicReactions = ps.publicReactions;
	if (typeof ps.isBot === "boolean") updates.isBot = ps.isBot;
	if (typeof ps.showTimelineReplies === "boolean")
		updates.showTimelineReplies = ps.showTimelineReplies;
	if (typeof ps.localShowRenote === "boolean")
		updates.localShowRenote = ps.localShowRenote;
	if (typeof ps.remoteShowRenote === "boolean")
		updates.remoteShowRenote = ps.remoteShowRenote;
	if (typeof ps.showSelfRenoteToHome === "boolean")
		updates.showSelfRenoteToHome = ps.showSelfRenoteToHome;
	if (typeof ps.carefulBot === "boolean")
		profileUpdates.carefulBot = ps.carefulBot;
	if (typeof ps.autoAcceptFollowed === "boolean")
		profileUpdates.autoAcceptFollowed = ps.autoAcceptFollowed;
	if (typeof ps.noCrawle === "boolean") profileUpdates.noCrawle = ps.noCrawle;
	if (typeof ps.preventAiLearning === "boolean")
		profileUpdates.preventAiLearning = ps.preventAiLearning;
	if (typeof ps.isCat === "boolean") updates.isCat = ps.isCat;
	if (typeof ps.speakAsCat === "boolean") updates.speakAsCat = ps.speakAsCat;
	if (typeof ps.injectFeaturedNote === "boolean")
		profileUpdates.injectFeaturedNote = ps.injectFeaturedNote;
	if (typeof ps.receiveAnnouncementEmail === "boolean")
		profileUpdates.receiveAnnouncementEmail = ps.receiveAnnouncementEmail;
	if (typeof ps.receiveUnreadSummaryEmail === "boolean")
		profileUpdates.receiveUnreadSummaryEmail = ps.receiveUnreadSummaryEmail;
	if (typeof ps.alwaysMarkNsfw === "boolean")
		profileUpdates.alwaysMarkNsfw = ps.alwaysMarkNsfw;
	if (typeof ps.autoSensitive === "boolean")
		profileUpdates.autoSensitive = ps.autoSensitive;
	if (typeof ps.blockPostPublic === "boolean")
		updates.blockPostPublic = ps.blockPostPublic;
	if (typeof ps.blockPostHome === "boolean")
		updates.blockPostHome = ps.blockPostHome;
	if (typeof ps.blockPostNotLocal === "boolean")
		updates.blockPostNotLocal = ps.blockPostNotLocal;
	if (typeof ps.blockPostNotLocalPublic === "boolean")
		updates.blockPostNotLocalPublic = ps.blockPostNotLocalPublic;
	if (typeof ps.isSilentLocked === "boolean") {
		updates.isSilentLocked = ps.isSilentLocked;
	}
	if (typeof ps.isRemoteLocked === "boolean") {
		updates.isRemoteLocked = ps.isRemoteLocked;
	}
	if (typeof ps.isPublicLikeList === "boolean") {
		updates.isPublicLikeList = ps.isPublicLikeList;
	}
	if (typeof ps.disableNyaise === "boolean") {
		updates.disableNyaise = ps.disableNyaise;
	}
	if (typeof ps.showDonateBadges === "boolean")
		profileUpdates.showDonateBadges = ps.showDonateBadges;
	if (ps.emailNotificationTypes !== undefined)
		profileUpdates.emailNotificationTypes = ps.emailNotificationTypes;
	if (typeof ps.showWarnedUsersInPublicTimeline === "boolean") {
		profileUpdates.showWarnedUsersInPublicTimeline =
			ps.showWarnedUsersInPublicTimeline;
	}
	if (typeof ps.receiveReactionsFromNonFollowedWarnedUsers === "boolean") {
		profileUpdates.receiveReactionsFromNonFollowedWarnedUsers =
			ps.receiveReactionsFromNonFollowedWarnedUsers;
	}

	if (ps.avatarId) {
		const avatar = await DriveFiles.findOneBy({ id: ps.avatarId });

		if (avatar == null || avatar.userId !== user.id)
			throw new ApiError(meta.errors.noSuchAvatar);
		if (!avatar.type.startsWith("image/"))
			throw new ApiError(meta.errors.avatarNotAnImage);
	}

	if (ps.bannerId) {
		const banner = await DriveFiles.findOneBy({ id: ps.bannerId });

		if (banner == null || banner.userId !== user.id)
			throw new ApiError(meta.errors.noSuchBanner);
		if (!banner.type.startsWith("image/"))
			throw new ApiError(meta.errors.bannerNotAnImage);
	}

	if (ps.pinnedPageId) {
		const page = await Pages.findOneBy({ id: ps.pinnedPageId });

		if (page == null || page.userId !== user.id)
			throw new ApiError(meta.errors.noSuchPage);

		profileUpdates.pinnedPageId = page.id;
	} else if (ps.pinnedPageId === null) {
		profileUpdates.pinnedPageId = null;
	}

        if (ps.fields) {
                profileUpdates.fields = ps.fields
                        .filter((x) => typeof x.name === "string" && typeof x.value === "string")
                        .map((x) => ({
                                name: x.name.trim(),
                                value: x.value.trim(),
                        }))
                        .filter((x) => x.name !== "" && x.value !== "");
        }

	//#region 絵文字・タグ

	let emojis = [] as string[];
	let tags = [] as string[];

	const newName = updates.name === undefined ? user.name : updates.name;
	const newDescription =
		profileUpdates.description === undefined
			? profile.description
			: profileUpdates.description;
	const newLocation =
		profileUpdates.location === undefined
			? profile.location
			: profileUpdates.location;
	const newField =
		profileUpdates.fields === undefined
			? profile.fields
			: profileUpdates.fields;
	const newFollowedMessage =
		profileUpdates.followedMessage === undefined
			? profile.followedMessage
			: profileUpdates.followedMessage;

	if (newName != null) {
		let _newName = newName;
		if (/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/.test(_newName)) {
			// 他鯖絵文字が入っている場合、@以下をトリミングする
			_newName = _newName.replaceAll(
				/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/gi,
				":$1:",
			);
			updates.name = _newName;
		}
		const tokens = mfm.parseSimple(_newName);
		emojis = emojis.concat(extractCustomEmojisFromMfm(tokens!));
	}

	if (newDescription != null) {
		let _newDescription = newDescription;
		if (/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/.test(_newDescription)) {
			// 他鯖絵文字が入っている場合、@以下をトリミングする
			_newDescription = _newDescription.replaceAll(
				/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/gi,
				":$1:",
			);
			profileUpdates.description = _newDescription;
		}
		const tokens = mfm.parse(_newDescription);
		emojis = emojis.concat(extractCustomEmojisFromMfm(tokens!));
		tags = extractHashtags(tokens!)
			.map((tag) => normalizeForSearch(tag))
			.splice(0, 32);
	}

	if (newLocation != null) {
		let _newLocation = newLocation;
		if (/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/.test(_newLocation)) {
			// 他鯖絵文字が入っている場合、@以下をトリミングする
			_newLocation = _newLocation.replaceAll(
				/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/gi,
				":$1:",
			);
			profileUpdates.location = _newLocation;
		}
		const tokens = mfm.parseSimple(_newLocation);
		emojis = emojis.concat(extractCustomEmojisFromMfm(tokens!));
	}

	if (newField != null) {
		newField.forEach((x) => {
			const nameTokens = mfm.parseSimple(x.name);
			emojis = emojis.concat(extractCustomEmojisFromMfm(nameTokens!));
			const valueTokens = mfm.parseSimple(x.value);
			emojis = emojis.concat(extractCustomEmojisFromMfm(valueTokens!));
		});
	}

	if (newFollowedMessage != null) {
		emojis = emojis.concat(extractCustomEmojisFromMfm(mfm.parseSimple(newFollowedMessage)));
	}


	updates.emojis = emojis;
	updates.tags = tags;

	// ハッシュタグ更新
	updateUsertags(user, tags);
	//#endregion

	if (Object.keys(updates).length > 0) await Users.update(user.id, updates);

	await UserProfiles.update(user.id, {
		...profileUpdates,
		verifiedLinks: [],
	});

	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);

	const updatedProfile = await UserProfiles.findOneByOrFail({ userId: user.id });

	const iObj = await Users.pack<true, true>(user.id, user, {
		detail: true,
		includeSecrets: isSecure,
	});

	// meUpdated イベントを発行する
	publishMainStream(user.id, "meUpdated", iObj);
	publishUserEvent(
		user.id,
		"updateUserProfile",
		updatedProfile,
	);

	// meUpdated イベントを発行する
	publishInternalEvent("localUserUpdated", { id: user.id });

	// 鍵垢を解除したとき、溜まっていたフォローリクエストがあるならすべて承認
	// しないで欲しいので回避
	/*
	if (user.isLocked && ps.isLocked === false) {
		acceptAllFollowRequests(user);
	}
	*/

	// フォロワーにUpdateを配信
	publishToFollowers(user.id);

	if (Users.isLocalUser(user)) {
		updatedProfile.fields
			.map((field) => getVerifiedLinkCandidate(field.value))
			.filter((value): value is VerifiedLinkCandidate => value != null)
			.forEach((value) => {
				void verifyLink(value.url, value.original, user);
			});

		void verifyMutualMentions(updatedProfile.fields, user);
	}

	return iObj;
});

async function verifyLink(url: string, original: string, user: ILocalUser) {
	if (!safeForSql(url)) return;

	try {
		const html = await getHtml(url);
		const { window } = new JSDOM(html);
		const doc = window.document;

		const myLink = `${config.url}/@${user.username}`;

		const anchorElements = Array.from(doc.getElementsByTagName("a"));
		const linkElements = Array.from(doc.getElementsByTagName("link"));

		const includesMyLink = anchorElements.some((a) => a.href === myLink);
		const includesRelMeLinks = [...anchorElements, ...linkElements].some((link) => {
			if (link.href !== myLink) return false;
			if (typeof link.rel === "string" && link.rel !== "") {
				if (link.rel === "me") return true;
				return link.rel.split(/\s+/).includes("me");
			}
			return (link.relList as DOMTokenList | undefined)?.contains("me") ?? false;
		});

		if (includesMyLink || includesRelMeLinks) {
			await UserProfiles.createQueryBuilder("profile")
				.update()
				.where("userId = :userId", { userId: user.id })
				.andWhere("NOT :original = ANY(\"verifiedLinks\")", {
					original,
				})
				.set({
					verifiedLinks: () => 'array_append("verifiedLinks", :original)',
				})
				.setParameters({ original })
				.execute();
		}
	} catch (err) {
		// リンク検証中のエラーは無視する
	}
}

type VerifiedLinkCandidate = {
	url: string;
	original: string;
};

function getVerifiedLinkCandidate(value: string): VerifiedLinkCandidate | null {
	const tokens = mfm.parse(value) ?? [];
	const urls: string[] = [];

	const walk = (node: mfm.MfmNode) => {
		if (node.type === "url" || node.type === "link") {
			const url = node.props?.url;
			if (typeof url === "string") urls.push(url);
		}
		if (node.children) {
			for (const child of node.children) {
				walk(child);
			}
		}
	};

	for (const node of tokens) {
		walk(node);
	}

	if (urls.length !== 1) return null;
	if (!urls[0].startsWith("https://")) return null;
	return {
		url: urls[0],
		original: value,
	};
}

async function verifyMutualMentions(fields: UserProfile["fields"], user: ILocalUser) {
	const selfAcct = `@${user.username}@${config.host}`.toLowerCase();

	const mentions = fields.flatMap((field) => {
		const tokens = mfm.parse(field.value) ?? [];

		return extractMentions(tokens).map((mention) => ({
			mention,
			original: field.value,
		}));
	});

	await Promise.all(
		mentions.map(async ({ mention, original }) => {
			const host = mention.host ?? config.host;

			try {
				const target = await resolveUser(mention.username, host);
				const targetProfile = await UserProfiles.findOneBy({
					userId: target.id,
				});

				if (!targetProfile) return;

				const hasSelfMention = targetProfile.fields.some((field) => {
					const tokens = mfm.parse(field.value) ?? [];

					return extractMentions(tokens).some((selfMention) => {
						const selfHost = selfMention.host ?? config.host;
						const acct = `@${selfMention.username}@${selfHost}`.toLowerCase();

						return acct === selfAcct;
					});
				});

				if (!hasSelfMention) return;

				await UserProfiles.createQueryBuilder("profile")
					.update()
					.where("userId = :userId", { userId: user.id })
					.andWhere("NOT :value = ANY(\"verifiedLinks\")", { value: original })
					.set({
						verifiedLinks: () => 'array_append("verifiedLinks", :value)',
					})
					.setParameters({ value: original })
					.execute();
			} catch (err) {
				// 無視
			}
		}),
	);
}
