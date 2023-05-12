import {
	DriveFiles,
	Followings,
	NoteFavorites,
	NoteReactions,
	Notes,
	PageLikes,
	PollVotes,
	Users,
	MessagingMessages,
} from "@/models/index.js";
import { awaitAll } from "@/prelude/await-all.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";

export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: true,

	description: "Show statistics about a user.",

	errors: {
		noSuchUser: {
			message: "No such user.",
			code: "NO_SUCH_USER",
			id: "9e638e45-3b25-4ef7-8f95-07e8498f1819",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			notesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			repliesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			renotesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			repliedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			renotedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pollVotesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pollVotedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			localFollowingCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			remoteFollowingCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			localFollowersCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			remoteFollowersCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			followingCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			followersCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			sentReactionsCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			receivedReactionsCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			noteFavoritesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pageLikesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			pageLikedCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			driveFilesCount: {
				type: "integer",
				optional: false,
				nullable: false,
			},
			driveUsage: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "Drive usage in bytes",
			},
			notesPostDays: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "Number of days you have posted one or more notes",
			},
			power: {
				type: "integer",
				optional: false,
				nullable: false,
				description: "powerrrrrrrrrrrrrr",
			},
			powerRank: {
				type: "string",
				optional: false,
				nullable: false,
				description: "powerrrrrrrrrrrrrr",
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });
	if (user == null) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	let now = new Date();
	let mkk = new Date(2023,4,5);
	
	const elapsedDays =  Math.min(Math.ceil(now.getTime() - user.createdAt / 86400),Math.ceil(now.getTime() - mkk.getTime() / 86400));
			
	const sendMessageCount = await MessagingMessages.createQueryBuilder("messaging_message")
			.where("messaging_message.userId = :userId", { userId: user.id })
			.getCount();
			
	const readMessageCount = await MessagingMessages.createQueryBuilder("messaging_message")
			.where(" :userId  = ANY(messaging_message.reads) ", { userId: user.id })
			.getCount();
			
	const notesPostDaysMkk = (await Notes.createQueryBuilder("note")
			.select("count(distinct date_trunc('day',note.\"createdAt\")) count")
			.where("note.userId = :userId", { userId: user.id })
			.andWhere("note.visibility <> 'hidden'")
			.andWhere("'misshaialert' <> ALL(note.tags)")
			.getRawOne()).count;
			
	const result = await awaitAll({
		notesCount: Notes.createQueryBuilder("note")
			.where("note.userId = :userId", { userId: user.id })
			.getCount(),
		repliesCount: Notes.createQueryBuilder("note")
			.where("note.userId = :userId", { userId: user.id })
			.andWhere("note.replyId IS NOT NULL")
			.getCount(),
		renotesCount: Notes.createQueryBuilder("note")
			.where("note.userId = :userId", { userId: user.id })
			.andWhere("note.renoteId IS NOT NULL")
			.getCount(),
		repliedCount: Notes.createQueryBuilder("note")
			.where("note.replyUserId = :userId", { userId: user.id })
			.getCount(),
		renotedCount: Notes.createQueryBuilder("note")
			.where("note.renoteUserId = :userId", { userId: user.id })
			.getCount(),
		pollVotesCount: PollVotes.createQueryBuilder("vote")
			.where("vote.userId = :userId", { userId: user.id })
			.getCount(),
		pollVotedCount: PollVotes.createQueryBuilder("vote")
			.innerJoin("vote.note", "note")
			.where("note.userId = :userId", { userId: user.id })
			.getCount(),
		localFollowingCount: Followings.createQueryBuilder("following")
			.where("following.followerId = :userId", { userId: user.id })
			.andWhere("following.followeeHost IS NULL")
			.getCount(),
		remoteFollowingCount: Followings.createQueryBuilder("following")
			.where("following.followerId = :userId", { userId: user.id })
			.andWhere("following.followeeHost IS NOT NULL")
			.getCount(),
		localFollowersCount: Followings.createQueryBuilder("following")
			.where("following.followeeId = :userId", { userId: user.id })
			.andWhere("following.followerHost IS NULL")
			.getCount(),
		remoteFollowersCount: Followings.createQueryBuilder("following")
			.where("following.followeeId = :userId", { userId: user.id })
			.andWhere("following.followerHost IS NOT NULL")
			.getCount(),
		sentReactionsCount: NoteReactions.createQueryBuilder("reaction")
			.where("reaction.userId = :userId", { userId: user.id })
			.getCount(),
		receivedReactionsCount: NoteReactions.createQueryBuilder("reaction")
			.innerJoin("reaction.note", "note")
			.where("note.userId = :userId", { userId: user.id })
			.getCount(),
		noteFavoritesCount: NoteFavorites.createQueryBuilder("favorite")
			.where("favorite.userId = :userId", { userId: user.id })
			.getCount(),
		pageLikesCount: PageLikes.createQueryBuilder("like")
			.where("like.userId = :userId", { userId: user.id })
			.getCount(),
		pageLikedCount: PageLikes.createQueryBuilder("like")
			.innerJoin("like.page", "page")
			.where("page.userId = :userId", { userId: user.id })
			.getCount(),
		driveFilesCount: DriveFiles.createQueryBuilder("file")
			.where("file.userId = :userId", { userId: user.id })
			.getCount(),
		driveUsage: DriveFiles.calcDriveUsageOf(user),
		notesPostDays: (await Notes.createQueryBuilder("note")
			.select("count(distinct date_trunc('day',note.\"createdAt\")) count")
			.where("note.userId = :userId", { userId: user.id })
			.andWhere("'misshaialert' <> ALL(note.tags)")
			.getRawOne()).count,
	});
	
	result.followingCount =
		result.localFollowingCount + result.remoteFollowingCount;
	result.followersCount =
		result.localFollowersCount + result.remoteFollowersCount;
		
	result.power = 
		Math.floor((result.notesPostDays * 482 +
		result.notesCount * 18 +
		result.repliesCount * 7 +
		result.renotesCount * -11 +
		result.repliedCount * 3 +
		result.renotedCount * 3 +
		result.pollVotesCount * 7 +
		result.pollVotedCount * 3 +
		result.pageLikesCount * 33 +
		result.pageLikedCount * 27 +
		result.sentReactionsCount * 7 +
		result.receivedReactionsCount * 3 +
		result.driveFilesCount * 6 + 
		sendMessageCount * 11 +
		readMessageCount * 2
		) * ( 1 + 
		result.followingCount * 0.0005 +
		result.followersCount * 0.0015));
		
	const powerMkk = 
		Math.floor((notesPostDaysMkk * 482 +
		result.notesCount * 18 +
		result.repliesCount * 7 +
		result.renotesCount * -11 +
		result.repliedCount * 3 +
		result.renotedCount * 3 +
		result.pollVotesCount * 7 +
		result.pollVotedCount * 3 +
		result.pageLikesCount * 33 +
		result.pageLikedCount * 27 +
		result.sentReactionsCount * 7 +
		result.receivedReactionsCount * 3 +
		result.driveFilesCount * 6 + 
		sendMessageCount * 11 +
		readMessageCount * 2
		) * ( 1 + 
		result.followingCount * 0.0005 +
		result.followersCount * 0.0015) / elapsedDays);
		
	const rankBorder = [50,250,500,750,1000,1500,2000,2500,3000,4000,5000,6000];
	const rankName = ["G","F","E","D","C","B","B+","A","A+","AA","AA+","AAA","AAA+"];
	const suffixIncBorder = rankBorder.slice(-1)[0] - rankBorder.slice(-2)[0];
	
	if (powerMkk >= rankBorder.slice(-1)[0] + suffixIncBorder) {
		result.powerRank = rankName.slice(-1)[0] + Math.floor((powerMkk - rankBorder.slice(-2)[0]) / suffixIncBorder);
	} else {
		const clearBorder = rankBorder.filter(x => x <= powerMkk);
		result.powerRank = rankName[clearBorder.length];
	}

	return result;
});
