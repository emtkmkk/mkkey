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
