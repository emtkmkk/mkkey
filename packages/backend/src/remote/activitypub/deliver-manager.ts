/**
 * @packageDocumentation
 *
 * ActivityPub 配信先の管理。Followers / Direct レシピを追加し、スキップ判定後にキューへ投入する。
 *
 * @remarks
 * - **役割**: ノート・リアクション等の配信時にフォロワー・Direct 先を解決し、deliver キューへ投入する。
 *
 * @see {@link queue/processors/deliver} 配信ジョブ
 * @internal
 */
import { IsNull, Not, In } from "typeorm";
import { Users, Followings } from "@/models/index.js";
import type { ILocalUser, IRemoteUser, User } from "@/models/entities/user.js";
import { deliver } from "@/queue/index.js";
import { skippedInstances } from "@/misc/skipped-instances.js";

//#region 型定義
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
//#endregion 型定義

export default class DeliverManager {
	private actor: { id: User["id"]; host: null };
	private activity: any;
	private recipes: IRecipe[] = [];

	/**
	 * @param actor - 配送元 Actor
	 * @param activity - 配送する Activity
	 */
	constructor(actor: { id: User["id"]; host: null }, activity: any) {
		this.actor = actor;
		this.activity = activity;
	}

	/** フォロワー配送用レシピを追加する */
	public addFollowersRecipe(union?: ILocalUser) {
		const deliver = {
			type: "Followers",
			union,
		} as IFollowersRecipe;

		this.addRecipe(deliver);
	}

	/**
	 * ダイレクト配送用レシピを追加する
	 * @param to - 配送先リモートユーザー
	 */
	public addDirectRecipe(to: IRemoteUser) {
		const recipe = {
			type: "Direct",
			to,
		} as IDirectRecipe;

		this.addRecipe(recipe);
	}

	/**
	 * レシピを追加する
	 * @param recipe - 追加するレシピ
	 */
	public addRecipe(recipe: IRecipe) {
		this.recipes.push(recipe);
	}

	/**
	 * 配信を実行する。
	 * @remarks レシピから inbox を収集し、スキップ判定後にキューへ投入する。完了は待たない。
	 */
	public async execute() {
		if (!Users.isLocalUser(this.actor)) return;

		const inboxes = await this.collectInboxes();

		await deliverToInboxes(this.actor, this.activity, inboxes);
	}

	/**
	 * レシピから inbox 一覧を収集する。
	 * @returns inbox URL と shared inbox フラグの Map。ローカルユーザーでない場合は空の Map。
	 */
	public async collectInboxes() {
		if (!Users.isLocalUser(this.actor)) return new Map<string, boolean>();

		const inboxes = new Map<string, boolean>();

		/*
		build inbox list

		Process follower recipes first to avoid duplication when processing
		direct recipes later.
		*/
		if (this.recipes.some((r) => isFollowers(r))) {
			// followers deliver
			const union = (
				this.recipes.filter(
					(r) => isFollowers(r) && r.union && Users.isLocalUser(r.union),
				) as IFollowersRecipe[]
			).map((r) => r.union);
			const unionFollowerIds = new Set<string>();

			for (const u of union) {
				if (!u) continue;

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
						unionFollowerIds.add(f.followerId);
					} else if (typeof f === "string") {
						unionFollowerIds.add(f);
					} else {
						console.log(`error f : ${JSON.stringify(f, undefined, "\t")}`);
					}
				});
				console.log(`a ${this.actor.id} u ${u.id} : ${unionFollowerIds.size}`);
			}

			if (!union.length || unionFollowerIds.size !== 0) {
				// TODO: SELECT DISTINCT ON ("followerSharedInbox") "followerSharedInbox" みたいな問い合わせにすればよりパフォーマンス向上できそう
				// ただ、sharedInboxがnullなリモートユーザーも稀におり、その対応ができなさそう？
				const followers = (await Followings.find({
					where: {
						followeeId: this.actor.id,
						...(union.length
							? { followerId: In(Array.from(unionFollowerIds)) }
							: {}),
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
					const inbox =
						following.followerSharedInbox || following.followerInbox;
					inboxes.set(inbox, following.followerSharedInbox !== null);
				}
			} else {
				console.log(
					`skip : no remote follower (${union.map((u) => u?.id).join(", ")})`,
				);
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
			.forEach((recipe) => inboxes.set(recipe.to.inbox!, false));

		console.log(
			`deliver : ${inboxSize}${
				inboxes.size - inboxSize ? ` + ${inboxes.size - inboxSize}` : ""
			}`,
		);

		return inboxes;
	}
}

//#region 配信ユーティリティ
/**
 * フォロワーに Activity を配信する。
 * @param actor - 配送元ローカルユーザー
 * @param activity - 配送する Activity
 * @internal
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
 * 指定ユーザーに Activity を配信する。
 * @param actor - 配送元ローカルユーザー
 * @param activity - 配送する Activity
 * @param to - 配送先リモートユーザー
 * @internal
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

/**
 * 複数の inbox に Activity を配信する。
 * @param actor - 配送元ローカルユーザー
 * @param activity - 配送する Activity
 * @param inboxes - inbox URL と shared inbox フラグの Map
 * @remarks スキップ対象インスタンスは配信しない。
 * @internal
 */
export async function deliverToInboxes(
	actor: { id: ILocalUser["id"]; host: null },
	activity: any,
	inboxes: Map<string, boolean>,
) {
	if (!Users.isLocalUser(actor)) return;

	if (inboxes.size === 0) return;

	// 先に inbox の有効性を検証する
	const validInboxes = [];
	for (const inbox of inboxes) {
		try {
			validInboxes.push({
				inbox,
				host: new URL(inbox[0]).host,
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

		deliver(actor, activity, valid.inbox[0], valid.inbox[1]);
	}
}
//#endregion 配信ユーティリティ
