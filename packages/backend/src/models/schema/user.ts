/**
 * @packageDocumentation
 *
 * ユーザー（UserLite / UserDetailed 等）の API 用パック済みスキーマ定義。
 *
 * @internal
 */
/** ユーザー簡易（UserLite）の API 用パック済みスキーマ。 */
export const packedUserLiteSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			nullable: false,
			optional: false,
			format: "id",
			example: "xxxxxxxxxx",
			description: "ユーザーの ID。",
		},
		name: {
			type: "string",
			nullable: true,
			optional: false,
			example: "藍",
			description: "表示名。",
		},
		username: {
			type: "string",
			nullable: false,
			optional: false,
			example: "calc",
			description: "ユーザー名。",
		},
		host: {
			type: "string",
			nullable: true,
			optional: false,
			example: "misskey.example.com",
			description: "ローカルユーザーは null。",
		},
		avatarUrl: {
			type: "string",
			format: "url",
			nullable: true,
			optional: false,
			description: "アバター画像の URL。",
		},
		avatarBlurhash: {
			type: "any",
			nullable: true,
			optional: false,
			description: "アバターのブラーハッシュ。",
		},
		avatarColor: {
			type: "any",
			nullable: true,
			optional: false,
			default: null,
			description: "アバターの代表色。",
		},
		isAdmin: {
			type: "boolean",
			nullable: false,
			optional: true,
			default: false,
			description: "管理者か。",
		},
		isModerator: {
			type: "boolean",
			nullable: false,
			optional: true,
			default: false,
			description: "モデレーターか。",
		},
		isBot: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "Bot アカウントか。",
		},
		isCat: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "猫耳モードか。",
		},
		speakAsCat: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "にゃー語で投稿するか。",
		},
		isModerationWarning: {
			type: "boolean",
			nullable: false,
			optional: false,
			description: "モデレーション警告フラグ（false も常に送る）。",
		},
		isUsagePaused: {
			type: "boolean",
			nullable: false,
			optional: false,
			description: "一時利用停止（false も常に送る）。",
		},
		emojis: {
			type: "array",
			nullable: false,
			optional: false,
			items: {
				type: "object",
				nullable: false,
				optional: false,
				properties: {
					name: {
						type: "string",
						nullable: false,
						optional: false,
					},
					url: {
						type: "string",
						nullable: false,
						optional: false,
						format: "url",
					},
				},
			},
			description: "カスタム絵文字の配列。",
		},
		onlineStatus: {
			type: "string",
			format: "url",
			nullable: true,
			optional: false,
			description: "オンライン状態。",
			enum: [
				"unknown",
				"online",
				"half-online",
				"active",
				"half-active",
				"offline",
				"half-sleeping",
				"sleeping",
				"deep-sleeping",
				"super-sleeping",
			],
		},
	},
} as const;

export const packedUserDetailedNotMeOnlySchema = {
	type: "object",
	properties: {
		url: {
			type: "string",
			format: "url",
			nullable: true,
			optional: false,
		},
		uri: {
			type: "string",
			format: "uri",
			nullable: true,
			optional: false,
		},
		movedToUri: {
			type: "string",
			format: "uri",
			nullable: true,
			optional: false,
		},
		alsoKnownAs: {
			type: "array",
			format: "uri",
			nullable: true,
			optional: false,
		},
		createdAt: {
			type: "string",
			nullable: false,
			optional: false,
			format: "date-time",
		},
		updatedAt: {
			type: "string",
			nullable: true,
			optional: false,
			format: "date-time",
		},
		lastFetchedAt: {
			type: "string",
			nullable: true,
			optional: false,
			format: "date-time",
		},
		bannerUrl: {
			type: "string",
			format: "url",
			nullable: true,
			optional: false,
		},
		bannerBlurhash: {
			type: "any",
			nullable: true,
			optional: false,
		},
		bannerColor: {
			type: "any",
			nullable: true,
			optional: false,
			default: null,
		},
		isLocked: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		isSilenced: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		isSuspended: {
			type: "boolean",
			nullable: false,
			optional: false,
			example: false,
		},
		description: {
			type: "string",
			nullable: true,
			optional: false,
			example: "Hi masters, I am Ai!",
		},
		location: {
			type: "string",
			nullable: true,
			optional: false,
		},
		birthday: {
			type: "string",
			nullable: true,
			optional: false,
			example: "2018-03-12",
		},
		pinnedAge: {
			type: "number",
			nullable: true,
			optional: false,
			description: "ユーザーが固定した年齢（6-122）。未設定はnull",
		},
		lang: {
			type: "string",
			nullable: true,
			optional: false,
			example: "ja-JP",
		},
                fields: {
                        type: "array",
                        nullable: false,
                        optional: false,
                        items: {
                                type: "object",
                                nullable: false,
                                optional: false,
                                properties: {
                                        name: {
                                                type: "string",
                                                nullable: false,
                                                optional: false,
                                        },
                                        value: {
                                                type: "string",
                                                nullable: false,
                                                optional: false,
                                        },
                                },
                                maxLength: 4,
                        },
                },
                verifiedLinks: {
                        type: "array",
                        nullable: false,
                        optional: false,
                        items: {
                                type: "string",
                                nullable: false,
                                optional: false,
                                format: "url",
                        },
                },
                followersCount: {
                        type: "number",
                        nullable: false,
                        optional: false,
                },
		followingCount: {
			type: "number",
			nullable: false,
			optional: false,
		},
		notesCount: {
			type: "number",
			nullable: false,
			optional: false,
		},
		pinnedNoteIds: {
			type: "array",
			nullable: false,
			optional: false,
			items: {
				type: "string",
				nullable: false,
				optional: false,
				format: "id",
			},
		},
		pinnedNotes: {
			type: "array",
			nullable: false,
			optional: false,
			items: {
				type: "object",
				nullable: false,
				optional: false,
				ref: "Note",
			},
		},
		pinnedPageId: {
			type: "string",
			nullable: true,
			optional: false,
		},
		pinnedPage: {
			type: "object",
			nullable: true,
			optional: false,
			ref: "Page",
		},
		publicReactions: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		twoFactorEnabled: {
			type: "boolean",
			nullable: false,
			optional: false,
			default: false,
		},
		usePasswordLessLogin: {
			type: "boolean",
			nullable: false,
			optional: false,
			default: false,
		},
		securityKeys: {
			type: "boolean",
			nullable: false,
			optional: false,
			default: false,
		},
		//#region relations
		isFollowing: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isFollowed: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		hasPendingFollowRequestFromYou: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		needsFollowReconfirm: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		followReconfirmReason: {
			type: "string",
			nullable: true,
			optional: true,
			enum: ["followRequestRejected", "wasForciblyUnfollowed"],
		},
		hasPendingFollowRequestToYou: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isBlocking: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isBlocked: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isMuted: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isRenoteMuted: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isPushMuted: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		isFollowBlocking: {
			type: "boolean",
			nullable: false,
			optional: true,
		},
		muteTypes: {
			type: "array",
			nullable: false,
			optional: true,
			items: {
				type: "string",
				enum: [
					"all",
					"note",
					"renote",
					"notification",
					"push",
					"reaction",
					"message",
					"follow",
				],
			},
		},
		muteExpiresAt: {
			type: "string",
			format: "date-time",
			nullable: true,
			optional: true,
		},
		//#endregion
	},
} as const;

export const packedMeDetailedOnlySchema = {
	type: "object",
	properties: {
		avatarId: {
			type: "string",
			nullable: true,
			optional: false,
			format: "id",
		},
		bannerId: {
			type: "string",
			nullable: true,
			optional: false,
			format: "id",
		},
		injectFeaturedNote: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		receiveAnnouncementEmail: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		receiveUnreadSummaryEmail: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		alwaysMarkNsfw: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		autoSensitive: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		carefulBot: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		autoAcceptFollowed: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		noCrawle: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		preventAiLearning: {
			type: "boolean",
			nullable: true,
			optional: false,
		},
		isExplorable: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		isDeleted: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hideOnlineStatus: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadSpecifiedNotes: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadMentions: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadAnnouncement: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadAntenna: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadChannel: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadMessagingMessage: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasUnreadNotification: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		hasPendingReceivedFollowRequest: {
			type: "boolean",
			nullable: false,
			optional: false,
		},
		integrations: {
			type: "object",
			nullable: true,
			optional: false,
		},
		mutedWords: {
			type: "array",
			nullable: false,
			optional: false,
			items: {
				type: "array",
				nullable: false,
				optional: false,
				items: {
					type: "string",
					nullable: false,
					optional: false,
				},
			},
		},
		mutedInstances: {
			type: "array",
			nullable: true,
			optional: false,
			items: {
				type: "string",
				nullable: false,
				optional: false,
			},
		},
		mutingNotificationTypes: {
			type: "array",
			nullable: true,
			optional: false,
			items: {
				type: "string",
				nullable: false,
				optional: false,
			},
		},
		emailNotificationTypes: {
			type: "array",
			nullable: true,
			optional: false,
			items: {
				type: "string",
				nullable: false,
				optional: false,
			},
		},
		needsModerationWarningPopup: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "警告ポップアップを表示すべきときのみ true（/i で付与）。",
		},
		hideMutedAndBlockedUserReactions: {
			type: "boolean",
			nullable: false,
			optional: false,
			description:
				"ミュート・双方向ブロック対象のリアクションを表示件数から差し引くか。",
		},
		showWarnedUsersInPublicTimeline: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "公開TLで警告投稿を見る設定が ON のときのみ。",
		},
		showWarnedUsersInPublicTimelineEffective: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "実効が true のときのみ（ログイン時は生設定と同値）。",
		},
		receiveReactionsFromNonFollowedWarnedUsers: {
			type: "boolean",
			nullable: false,
			optional: true,
			description: "警告ユーザからのリアクション受容が ON のときのみ。",
		},
		//#region secrets
		email: {
			type: "string",
			nullable: true,
			optional: true,
		},
		emailVerified: {
			type: "boolean",
			nullable: true,
			optional: true,
		},
		securityKeysList: {
			type: "array",
			nullable: false,
			optional: true,
			items: {
				type: "object",
				nullable: false,
				optional: false,
			},
		},
		//#endregion
	},
} as const;

export const packedUserDetailedNotMeSchema = {
	type: "object",
	allOf: [
		{
			type: "object",
			ref: "UserLite",
		},
		{
			type: "object",
			ref: "UserDetailedNotMeOnly",
		},
	],
} as const;

export const packedMeDetailedSchema = {
	type: "object",
	allOf: [
		{
			type: "object",
			ref: "UserLite",
		},
		{
			type: "object",
			ref: "UserDetailedNotMeOnly",
		},
		{
			type: "object",
			ref: "MeDetailedOnly",
		},
	],
} as const;

export const packedUserDetailedSchema = {
	oneOf: [
		{
			type: "object",
			ref: "UserDetailedNotMe",
		},
		{
			type: "object",
			ref: "MeDetailed",
		},
	],
} as const;

export const packedUserSchema = {
	oneOf: [
		{
			type: "object",
			ref: "UserLite",
		},
		{
			type: "object",
			ref: "UserDetailed",
		},
	],
} as const;
