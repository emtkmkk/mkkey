export class comments1605408971051 {
	constructor() {
		this.name = "comments1605408971051";
	}
	async up(queryRunner) {
		await queryRunner.query(
			`COMMENT ON COLUMN "log"."createdAt" IS 'The created date of the Log.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."createdAt" IS 'The created date of the DriveFolder.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."name" IS 'The name of the DriveFolder.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."parentId" IS 'The parent folder ID. If null, it means the DriveFolder is located in root.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."createdAt" IS 'The created date of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."userHost" IS 'The host of owner. It will be null if the user in local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."md5" IS 'The MD5 hash of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."name" IS 'The file name of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."type" IS 'The content type (MIME) of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."size" IS 'The file size (bytes) of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."comment" IS 'The comment of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."blurhash" IS 'The BlurHash string.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."properties" IS 'The any properties of the DriveFile. For example, it includes image width/height.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."url" IS 'The URL of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."thumbnailUrl" IS 'The URL of the thumbnail of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."webpublicUrl" IS 'The URL of the webpublic of the DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."uri" IS 'The URI of the DriveFile. it will be null when the DriveFile is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."folderId" IS 'The parent folder ID. If null, it means the DriveFile is located in root.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."isSensitive" IS 'Whether the DriveFile is NSFW.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."isLink" IS 'Whether the DriveFile is direct link to remote server.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."createdAt" IS 'The created date of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."updatedAt" IS 'The updated date of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."username" IS 'The username of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."usernameLower" IS 'The username (lowercased) of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."name" IS 'The name of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."followersCount" IS 'The count of followers.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."followingCount" IS 'The count of following.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."notesCount" IS 'The count of notes.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."avatarId" IS 'The ID of avatar DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."bannerId" IS 'The ID of banner DriveFile.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isSuspended" IS 'Whether the User is suspended.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isSilenced" IS 'Whether the User is silenced.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isLocked" IS 'Whether the User is locked.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isBot" IS 'Whether the User is a bot.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isCat" IS 'Whether the User is a cat.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isAdmin" IS 'Whether the User is the admin.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."isModerator" IS 'Whether the User is a moderator.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."host" IS 'The host of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."inbox" IS 'The inbox URL of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."sharedInbox" IS 'The sharedInbox URL of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."featured" IS 'The featured URL of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."uri" IS 'The URI of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."token" IS 'The native access token of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."createdAt" IS 'The created date of the App.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."secret" IS 'The secret key of the App.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."name" IS 'The name of the App.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."description" IS 'The description of the App.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."permission" IS 'The permission of the App.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."callbackUrl" IS 'The callbackUrl of the App.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."createdAt" IS 'The created date of the AccessToken.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."lastUsedAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."session" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "access_token"."appId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "access_token"."name" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."description" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."iconUrl" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."createdAt" IS 'The created date of the Channel.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."name" IS 'The name of the Channel.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."description" IS 'The description of the Channel.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."bannerId" IS 'The ID of banner Channel.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."notesCount" IS 'The count of notes.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."usersCount" IS 'The count of users.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."createdAt" IS 'The created date of the Note.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."replyId" IS 'The ID of reply target.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."renoteId" IS 'The ID of renote target.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."userId" IS 'The ID of author.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."uri" IS 'The URI of a note. it will be null when the note is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."url" IS 'The human readable url of a note. it will be null when the note is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."channelId" IS 'The ID of source channel.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."userHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."replyUserId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."replyUserHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."renoteUserId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."renoteUserHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "poll_vote"."createdAt" IS 'The created date of the PollVote.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_reaction"."createdAt" IS 'The created date of the NoteReaction.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."createdAt" IS 'The created date of the NoteWatching.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."userId" IS 'The watcher ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."noteId" IS 'The target Note ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."noteUserId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_unread"."noteUserId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_unread"."noteChannelId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."createdAt" IS 'The created date of the FollowRequest.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeId" IS 'The followee user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerId" IS 'The follower user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."requestId" IS 'id of Follow Activity.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerSharedInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeSharedInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group"."createdAt" IS 'The created date of the UserGroup.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group"."userId" IS 'The ID of owner.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_invitation"."createdAt" IS 'The created date of the UserGroupInvitation.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_invitation"."userId" IS 'The user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_invitation"."userGroupId" IS 'The group ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."createdAt" IS 'The created date of the Notification.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."notifieeId" IS 'The ID of recipient user of the Notification.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."isRead" IS 'Whether the Notification is read.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."localDriveCapacityMb" IS 'Drive capacity of a local user (MB)'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."remoteDriveCapacityMb" IS 'Drive capacity of a remote user (MB)'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."maxNoteTextLength" IS 'Max allowed note text length in characters'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."createdAt" IS 'The created date of the Following.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeId" IS 'The followee user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerId" IS 'The follower user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerSharedInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeSharedInbox" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."caughtAt" IS 'The caught date of the Instance.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."host" IS 'The host of the Instance.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."usersCount" IS 'The count of the users of the Instance.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."notesCount" IS 'The count of the notes of the Instance.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."softwareName" IS 'The software of the Instance.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."softwareVersion" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."openRegistrations" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "instance"."name" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."description" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."maintainerName" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."maintainerEmail" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "instance"."iconUrl" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."faviconUrl" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."themeColor" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muting"."createdAt" IS 'The created date of the Muting.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muting"."muteeId" IS 'The mutee user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muting"."muterId" IS 'The muter user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "blocking"."createdAt" IS 'The created date of the Blocking.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "blocking"."blockeeId" IS 'The blockee user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "blocking"."blockerId" IS 'The blocker user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list"."createdAt" IS 'The created date of the UserList.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list"."name" IS 'The name of the UserList.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list_joining"."createdAt" IS 'The created date of the UserListJoining.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list_joining"."userId" IS 'The user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list_joining"."userListId" IS 'The list ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_joining"."createdAt" IS 'The created date of the UserGroupJoining.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_joining"."userId" IS 'The user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_joining"."userGroupId" IS 'The group ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_favorite"."createdAt" IS 'The created date of the NoteFavorite.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "abuse_user_report"."createdAt" IS 'The created date of the AbuseUserReport.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "abuse_user_report"."targetUserHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "abuse_user_report"."reporterHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "messaging_message"."createdAt" IS 'The created date of the MessagingMessage.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "messaging_message"."userId" IS 'The sender user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "messaging_message"."groupId" IS 'The recipient group ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "signin"."createdAt" IS 'The created date of the Signin.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "auth_session"."createdAt" IS 'The created date of the AuthSession.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "reversi_game"."createdAt" IS 'The created date of the ReversiGame.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "reversi_game"."startedAt" IS 'The started date of the ReversiGame.'`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "reversi_game"."form1" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "reversi_game"."form2" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "reversi_matching"."createdAt" IS 'The created date of the ReversiMatching.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_note_pining"."createdAt" IS 'The created date of the UserNotePinings.'`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "poll"."noteId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "poll"."noteVisibility" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "poll"."userId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "poll"."userHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_keypair"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_publickey"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "page"."createdAt" IS 'The created date of the Page.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "page"."updatedAt" IS 'The updated date of the Page.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "page"."userId" IS 'The ID of author.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."location" IS 'The location of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."birthday" IS 'The birthday (YYYY-MM-DD) of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."description" IS 'The description (bio) of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."url" IS 'Remote URL of the user.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."email" IS 'The email address of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."password" IS 'The password hash of the User. It will be null if the origin of the user is local.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."clientData" IS 'The client-specific data of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."room" IS 'The room data of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."userHost" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."id" IS 'Variable-length id given to navigator.credentials.get()'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."publicKey" IS 'Variable-length public key used to verify attestations (hex-encoded).'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."lastUsed" IS 'The date of the last time the UserSecurityKey was successfully validated.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."name" IS 'User-defined name for this key'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "attestation_challenge"."challenge" IS 'Hex-encoded sha256 hash of the challenge.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "attestation_challenge"."createdAt" IS 'The date challenge was created for expiry purposes.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "attestation_challenge"."registrationChallenge" IS 'Indicates that the challenge is only for registration purposes if true to prevent the challenge for being used as authentication.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "moderation_log"."createdAt" IS 'The created date of the ModerationLog.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "announcement"."createdAt" IS 'The created date of the Announcement.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "announcement"."updatedAt" IS 'The updated date of the Announcement.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "announcement_read"."createdAt" IS 'The created date of the AnnouncementRead.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "clip"."createdAt" IS 'The created date of the Clip.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "clip"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "clip"."name" IS 'The name of the Clip.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "clip"."description" IS 'The description of the Clip.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "clip_note"."noteId" IS 'The note ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "clip_note"."clipId" IS 'The clip ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna"."createdAt" IS 'The created date of the Antenna.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna"."userId" IS 'The owner ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna"."name" IS 'The name of the Antenna.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna_note"."noteId" IS 'The note ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna_note"."antennaId" IS 'The antenna ID.'`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "promo_note"."noteId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "promo_note"."userId" IS '[Denormalized]'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "promo_read"."createdAt" IS 'The created date of the PromoRead.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muted_note"."noteId" IS 'The note ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muted_note"."userId" IS 'The user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "muted_note"."reason" IS 'The reason of the MutedNote.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_following"."createdAt" IS 'The created date of the ChannelFollowing.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_following"."followeeId" IS 'The followee channel ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_following"."followerId" IS 'The follower user ID.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_note_pining"."createdAt" IS 'The created date of the ChannelNotePining.'`,
		);
	}
	async down(queryRunner) {
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_note_pining"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_following"."followerId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_following"."followeeId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel_following"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "muted_note"."reason" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "muted_note"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "muted_note"."noteId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "promo_read"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "promo_note"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "promo_note"."noteId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna_note"."antennaId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "antenna_note"."noteId" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "antenna"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "antenna"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "antenna"."createdAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "clip_note"."clipId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "clip_note"."noteId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "clip"."description" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "clip"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "clip"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "clip"."createdAt" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "announcement_read"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "announcement"."updatedAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "announcement"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "moderation_log"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "attestation_challenge"."registrationChallenge" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "attestation_challenge"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "attestation_challenge"."challenge" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."name" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."lastUsed" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."publicKey" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_security_key"."id" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."userHost" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."room" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."clientData" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."password" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."email" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user_profile"."url" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."description" IS 'The description (bio) of the User.'`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."birthday" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."location" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_profile"."userId" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "page"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "page"."updatedAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "page"."createdAt" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_publickey"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_keypair"."userId" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "poll"."userHost" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "poll"."userId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "poll"."noteVisibility" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "poll"."noteId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_note_pining"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "reversi_matching"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "reversi_game"."form2" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "reversi_game"."form1" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "reversi_game"."startedAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "reversi_game"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "auth_session"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "signin"."createdAt" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "messaging_message"."groupId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "messaging_message"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "messaging_message"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "abuse_user_report"."reporterHost" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "abuse_user_report"."targetUserHost" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "abuse_user_report"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_favorite"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_joining"."userGroupId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_joining"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_joining"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list_joining"."userListId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list_joining"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list_joining"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "user_list"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user_list"."userId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_list"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "blocking"."blockerId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "blocking"."blockeeId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "blocking"."createdAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "muting"."muterId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "muting"."muteeId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "muting"."createdAt" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."themeColor" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."faviconUrl" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "instance"."iconUrl" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."maintainerEmail" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."maintainerName" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."description" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "instance"."name" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."openRegistrations" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."softwareVersion" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."softwareName" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."notesCount" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "instance"."usersCount" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "instance"."host" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "instance"."caughtAt" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeSharedInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeHost" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerSharedInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerHost" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followerId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."followeeId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "following"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."maxNoteTextLength" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."remoteDriveCapacityMb" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "meta"."localDriveCapacityMb" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."isRead" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."notifieeId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "notification"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_invitation"."userGroupId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_invitation"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group_invitation"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "user_group"."userId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user_group"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeSharedInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeHost" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerSharedInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerInbox" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerHost" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."requestId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followerId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."followeeId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "follow_request"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_unread"."noteChannelId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_unread"."noteUserId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."noteUserId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."noteId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."userId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_watching"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note_reaction"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "poll_vote"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "note"."renoteUserHost" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "note"."renoteUserId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."replyUserHost" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."replyUserId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."userHost" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."channelId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."url" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."uri" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."renoteId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."replyId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "note"."createdAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."usersCount" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."notesCount" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."bannerId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "channel"."description" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."createdAt" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."iconUrl" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."description" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "access_token"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "access_token"."appId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."session" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."lastUsedAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "access_token"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "app"."callbackUrl" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "app"."permission" IS 'The permission of the App.'`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "app"."description" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "app"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "app"."secret" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "app"."userId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "app"."createdAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."token" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."uri" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."featured" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."sharedInbox" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."inbox" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."host" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isModerator" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isAdmin" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isCat" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isBot" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isLocked" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isSilenced" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."isSuspended" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."bannerId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."avatarId" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."notesCount" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."followingCount" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "user"."followersCount" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "user"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."usernameLower" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."username" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."updatedAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "user"."createdAt" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."isLink" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."isSensitive" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."folderId" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."uri" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."webpublicUrl" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."thumbnailUrl" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."url" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."properties" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."blurhash" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."comment" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."size" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."type" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."name" IS NULL`);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."md5" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."userHost" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "drive_file"."userId" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_file"."createdAt" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."parentId" IS NULL`,
		);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."userId" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "drive_folder"."name" IS NULL`);
		await queryRunner.query(
			`COMMENT ON COLUMN "drive_folder"."createdAt" IS NULL`,
		);
		await queryRunner.query(`COMMENT ON COLUMN "log"."createdAt" IS NULL`);
	}
}
