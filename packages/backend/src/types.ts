export const notificationTypes = [
	"follow",
	"mention",
	"reply",
	"renote",
	"quote",
	"reaction",
	"unreadAntenna",
	"pollVote",
	"pollEnded",
	"receiveFollowRequest",
	"followRequestAccepted",
	"groupInvited",
	"app",
	"userWasUnfollowed",
	"wasForciblyUnfollowed",
	"followRequestRejected",
	"wasBlocked",
	"wasUnblocked",
	"followedAccountWasDeleted",
	"badge",
	// 絵文字の追加・インポート（・変更）申請のお知らせ。押すとその申請を開く
	"emojiRequest",
] as const;

export const noteVisibilities = [
	"public",
	"home",
	"followers",
	"specified",
	"hidden",
] as const;

export const mutedNoteReasons = ["word", "manual", "spam", "other"] as const;

export const ffVisibility = ["public", "followers", "private"] as const;
