import { IsNull, Not, In } from "typeorm";
import { Users, Followings } from "@/models/index.js";
import type { ILocalUser, IRemoteUser, User } from "@/models/entities/user.js";
import { deliver } from "@/queue/index.js";
import { skippedInstances } from "@/misc/skipped-instances.js";

//#region types
interface IRecipe {
	type: string;
}

interface IFollowersRecipe extends IRecipe {
	type: "Followers";
	union: ILocalUser | null;
}

interface IDirectRecipe extends IRecipe {
	type: "Direct";
	to: IRemoteUser;
}

const isFollowers = (recipe: any): recipe is IFollowersRecipe =>
	recipe.type === "Followers";

const isDirect = (recipe: any): recipe is IDirectRecipe =>
	recipe.type === "Direct";
//#endregion

export default class DeliverManager {
	private actor: { id: User["id"]; host: null };
	private activity: any;
	private recipes: IRecipe[] = [];

	/**
	 * Constructor
	 * @param actor Actor
	 * @param activity Activity to deliver
	 */
	constructor(actor: { id: User["id"]; host: null }, activity: any) {
		this.actor = actor;
		this.activity = activity;
	}

	/**
	 * Add recipe for followers deliver
	 */
	public addFollowersRecipe(union?: ILocalUser) {
		const deliver = {
			type: "Followers",
			union,
		} as IFollowersRecipe;

		this.addRecipe(deliver);
	}

	/**
	 * Add recipe for direct deliver
	 * @param to To
	 */
	public addDirectRecipe(to: IRemoteUser) {
		const recipe = {
			type: "Direct",
			to,
		} as IDirectRecipe;

		this.addRecipe(recipe);
	}

	/**
	 * Add recipe
	 * @param recipe Recipe
	 */
	public addRecipe(recipe: IRecipe) {
		this.recipes.push(recipe);
	}

	/**
	 * Execute delivers
	 */
	public async execute() {
		if (!Users.isLocalUser(this.actor)) return;

		const inboxes = new Set<string>();

		/*
		build inbox list

		Process follower recipes first to avoid duplication when processing
		direct recipes later.
		*/
		if (this.recipes.some((r) => isFollowers(r))) {
			// followers deliver
			const union = (this.recipes.filter((r) => isFollowers(r) && r.union && Users.isLocalUser(r.union)) as IFollowersRecipe[]).map((r) => r.union);
			const unionFollowerIds = new Set<string>();

			union.forEach(async (u) => {
				if (!u) return;
				const unionFollowers = (await Followings.find({
					where: {
						followeeId: u.id,
						followerHost: Not(IsNull()),
					},
					select: {
						followerId: true,
					},
				})) as {
					followerId: string;
				}[];

				unionFollowers.forEach((f) => {
					if (f?.followerId) {
						unionFollowerIds.add(f.followerId)
					} else if (typeof f === "string") {
						unionFollowerIds.add(f);
					} else {
						console.log(`error f : ${JSON.stringify(f,undefined,"\t")}`)
					}
				});
				console.log(`a ${this.actor.id} u ${u.id} : ${unionFollowerIds.size}`)
			})

			if (!union.length || unionFollowerIds.size) {
				// TODO: SELECT DISTINCT ON ("followerSharedInbox") "followerSharedInbox" みたいな問い合わせにすればよりパフォーマンス向上できそう
				// ただ、sharedInboxがnullなリモートユーザーも稀におり、その対応ができなさそう？
				const followers = (await Followings.find({
					where: {
						followeeId: this.actor.id,
						...(union.length ? {followerId: In(Array.from(unionFollowerIds))} : {}),
						followerHost: Not(IsNull()),
					},
					select: {
						followerSharedInbox: true,
						followerInbox: true,
					},
				})) as {
					followerSharedInbox: string | null;
					followerInbox: string;
				}[];

				for (const following of followers) {
					const inbox = following.followerSharedInbox || following.followerInbox;
					inboxes.add(inbox);
				}
			} else {
				console.log(`skip : no remote follower (${union.map((u) => {u?.id}).join(", ")})`)
			}
		}

		const inboxSize = inboxes.size;

		this.recipes
			.filter(
				(recipe): recipe is IDirectRecipe =>
					// followers recipes have already been processed
					isDirect(recipe) &&
					// check that shared inbox has not been added yet
					!(recipe.to.sharedInbox && inboxes.has(recipe.to.sharedInbox)) &&
					// check that they actually have an inbox
					recipe.to.inbox != null,
			)
			.forEach((recipe) => inboxes.add(recipe.to.inbox!));

		console.log(`deliver : ${inboxSize}${inboxes.size - inboxSize ? ` + ${inboxes.size - inboxSize}` : ""}`)
		
		// Validate Inboxes first
		const validInboxes = [];
		for (const inbox of inboxes) {
			try {
				validInboxes.push({
					inbox,
					host: new URL(inbox).host,
				});
			} catch (error) {
				console.error(error);
				console.error(`Invalid Inbox ${inbox}`);
			}
		}

		const instancesToSkip = await skippedInstances(
			// get (unique) list of hosts
			Array.from(new Set(validInboxes.map((valid) => valid.host))),
		);

		// deliver
		for (const valid of validInboxes) {
			// skip instances as indicated
			if (instancesToSkip.includes(valid.host)) continue;

			deliver(this.actor, this.activity, valid.inbox);
		}
	}
}

//#region Utilities
/**
 * Deliver activity to followers
 * @param activity Activity
 * @param from Followee
 */
export async function deliverToFollowers(
	actor: { id: ILocalUser["id"]; host: null },
	activity: any,
) {
	const manager = new DeliverManager(actor, activity);
	manager.addFollowersRecipe();
	await manager.execute();
}

/**
 * Deliver activity to user
 * @param activity Activity
 * @param to Target user
 */
export async function deliverToUser(
	actor: { id: ILocalUser["id"]; host: null },
	activity: any,
	to: IRemoteUser,
) {
	const manager = new DeliverManager(actor, activity);
	manager.addDirectRecipe(to);
	await manager.execute();
}
//#endregion
