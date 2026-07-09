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
import { apLogger } from "./logger.js";

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

type RemoteFollowerRow = {
	followeeId: User["id"];
	followerId: User["id"];
	followerSharedInbox: string | null;
	followerInbox: string;
};

const isFollowers = (recipe: any): recipe is IFollowersRecipe =>
	recipe.type === "Followers";

const isDirect = (recipe: any): recipe is IDirectRecipe =>
	recipe.type === "Direct";
//#endregion 型定義

//#region inbox収集ヘルパー
/**
 * Followings 行から inbox Map を構築する。
 * @param rows - Followings クエリ結果
 * @returns actorId ごとの inbox 集合
 * @internal
 */
export function buildFollowerInboxMapByActorIds(rows: RemoteFollowerRow[]) {
	const inboxesByActorIds = new Map<User["id"], Map<string, boolean>>();

	for (const row of rows) {
		const actorInboxes =
			inboxesByActorIds.get(row.followeeId) ?? new Map<string, boolean>();
		const inbox = row.followerSharedInbox || row.followerInbox;
		actorInboxes.set(inbox, row.followerSharedInbox !== null);
		inboxesByActorIds.set(row.followeeId, actorInboxes);
	}

	return inboxesByActorIds;
}

/**
 * inbox の積集合を返す。
 * @param source - 元 inbox 集合
 * @param target - 交差先 inbox 集合
 * @returns source と target に共通する inbox 集合
 * @internal
 */
export function intersectInboxes(
	source: Map<string, boolean>,
	target: Map<string, boolean>,
) {
	const intersection = new Map<string, boolean>();

	for (const [inbox, isSharedInbox] of source.entries()) {
		if (target.has(inbox)) {
			intersection.set(inbox, isSharedInbox);
		}
	}

	return intersection;
}

/**
 * 複数 actor のリモートフォロワー inbox を一括収集する。
 *
 * @remarks
 * - `unionFolloweeIds` を渡すと、対象 actor のフォロワーをその集合のフォロワー ID と積集合に絞る。
 *
 * @param actorIds - 収集対象 actor ID
 * @param options - union 条件
 * @returns actorId ごとの inbox 集合
 * @internal
 */
export async function collectRemoteFollowerInboxesByActorIds(
	actorIds: User["id"][],
	options?: { unionFolloweeIds?: User["id"][] },
) {
	const uniqueActorIds = Array.from(new Set(actorIds));
	const inboxesByActorIds = new Map<User["id"], Map<string, boolean>>();
	for (const actorId of uniqueActorIds) {
		inboxesByActorIds.set(actorId, new Map<string, boolean>());
	}
	if (uniqueActorIds.length === 0) return inboxesByActorIds;

	const unionFolloweeIds = options?.unionFolloweeIds ?? [];
	let unionFollowerIds: Set<User["id"]> | null = null;

	if (unionFolloweeIds.length > 0) {
		const unionFollowers = (await Followings.find({
			where: {
				followeeId: In(unionFolloweeIds),
				followerHost: Not(IsNull()),
			},
			select: {
				followerId: true,
			},
		})) as { followerId: User["id"] }[];
		unionFollowerIds = new Set(
			unionFollowers.map((follower) => follower.followerId).filter(Boolean),
		);
		if (unionFollowerIds.size === 0) return inboxesByActorIds;
	}

	const followers = (await Followings.find({
		where: {
			followeeId: In(uniqueActorIds),
			...(unionFollowerIds
				? { followerId: In(Array.from(unionFollowerIds)) }
				: {}),
			followerHost: Not(IsNull()),
		},
		select: {
			followeeId: true,
			followerId: true,
			followerSharedInbox: true,
			followerInbox: true,
		},
	})) as RemoteFollowerRow[];

	const batchedInboxes = buildFollowerInboxMapByActorIds(followers);
	for (const actorId of uniqueActorIds) {
		inboxesByActorIds.set(actorId, batchedInboxes.get(actorId) ?? new Map());
	}

	return inboxesByActorIds;
}
//#endregion inbox収集ヘルパー

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
			const batchedInboxes = await collectRemoteFollowerInboxesByActorIds(
				[this.actor.id],
				union.length > 0
					? { unionFolloweeIds: union.map((u) => u.id) }
					: undefined,
			);
			const actorInboxes = batchedInboxes.get(this.actor.id) ?? new Map();
			if (union.length > 0 && actorInboxes.size === 0) {
				apLogger.debug(
					`skip : no remote follower (${union.map((u) => u?.id).join(", ")})`,
				);
			} else {
				for (const [inbox, isSharedInbox] of actorInboxes.entries()) {
					inboxes.set(inbox, isSharedInbox);
				}
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

		apLogger.debug(
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
			apLogger.error(`Invalid Inbox ${inbox}`, { e: error });
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
