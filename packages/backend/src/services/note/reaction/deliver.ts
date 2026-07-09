/**
 * @packageDocumentation
 *
 * リアクションの ActivityPub 配信を組み立てるサービス。
 *
 * @remarks
 * - **役割**: リアクション作成時に、Like アクティビティをリモートフォロワーへ配信する。
 *
 * @see {@link services/note/reaction/create} リアクション作成
 * @internal
 */

import DeliverManager from "@/remote/activitypub/deliver-manager.js";
import { Users } from "@/models/index.js";
import { In } from "typeorm";
import type { Note } from "@/models/entities/note.js";
import type { ILocalUser, IRemoteUser, User } from "@/models/entities/user.js";

/**
 * リアクションの連合配信対象かを判定する。
 *
 * @remarks
 * - `create.ts` の外側ゲートと `buildReactionDeliverManager` の条件を共通化する。
 *
 * @param user - リアクション実行ユーザー
 * @param note - 対象ノート
 * @returns 連合配信対象の場合は true
 * @internal
 */
export function isReactionFederationDeliverable(
	user: Pick<User, "host" | "isExplorable" | "isRemoteExplorable">,
	note: Pick<
		Note,
		"channelId" | "localOnly" | "visibility" | "isPublicLikeList"
	>,
) {
	if (!Users.isLocalUser(user)) return false;
	if (note.channelId && note.localOnly) return false;
	if (note.visibility === "hidden") return false;
	if (!user.isExplorable || !user.isRemoteExplorable || !note.isPublicLikeList) {
		return false;
	}

	return (
		["public", "home", "followers"].includes(note.visibility) ||
		note.visibility === "specified"
	);
}

export async function buildReactionDeliverManager(
	user: Pick<User, "id" | "host" | "isExplorable" | "isRemoteExplorable">,
	note: Note,
	activity: any,
	options?: {
		/** 事前取得したノート作者。渡すと findOneBy をスキップする */
		reactee?: User | null;
	},
) {
	const dm = new DeliverManager(user as ILocalUser, activity);

	if (note.userHost !== null) {
		const reactee =
			options?.reactee !== undefined
				? options.reactee
				: await Users.findOneBy({ id: note.userId });
		if (reactee && Users.isRemoteUser(reactee)) {
			dm.addDirectRecipe(reactee as IRemoteUser);
		}
	}

	if (isReactionFederationDeliverable(user, note)) {
		if (["public", "home", "followers"].includes(note.visibility)) {
			if (note.userId !== user.id && note.userHost === null) {
				const u =
					options?.reactee !== undefined
						? options.reactee
						: await Users.findOneBy({ id: note.userId });
				if (u && Users.isLocalUser(u)) {
					dm.addFollowersRecipe(u);
				}
			} else {
				dm.addFollowersRecipe();
			}
		} else if (note.visibility === "specified") {
			const visibleIds = note.visibleUserIds?.length
				? (note.visibleUserIds as User["id"][])
				: [];
			if (visibleIds.length > 0) {
				const visibleUsers = await Users.findBy({ id: In(visibleIds) });
				for (const u of visibleUsers.filter((u) => Users.isRemoteUser(u))) {
					dm.addDirectRecipe(u as IRemoteUser);
				}
			}
			const ccIds = note.ccUserIds?.length ? (note.ccUserIds as User["id"][]) : [];
			if (ccIds.length > 0) {
				const ccUsers = await Users.findBy({ id: In(ccIds) });
				for (const u of ccUsers.filter((u) => Users.isRemoteUser(u))) {
					dm.addDirectRecipe(u as IRemoteUser);
				}
			}
		}
	}

	return dm;
}
