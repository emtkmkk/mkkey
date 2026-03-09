import DeliverManager from "@/remote/activitypub/deliver-manager.js";
import { Users } from "@/models/index.js";
import { In } from "typeorm";
import type { Note } from "@/models/entities/note.js";
import type { ILocalUser, IRemoteUser, User } from "@/models/entities/user.js";

export async function buildReactionDeliverManager(
	user: Pick<User, "id" | "host" | "isExplorable" | "isRemoteExplorable">,
	note: Note,
	activity: any,
	options?: {
		disableUnion?: boolean;
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

	if (user.isExplorable && user.isRemoteExplorable && note.isPublicLikeList) {
		if (["public", "home", "followers"].includes(note.visibility)) {
			if (note.userId !== user.id && note.userHost === null) {
				const u =
					options?.reactee !== undefined
						? options.reactee
						: await Users.findOneBy({ id: note.userId });
				if (u && Users.isLocalUser(u)) {
					if (options?.disableUnion) {
						dm.addFollowersRecipe();
					} else {
						dm.addFollowersRecipe(u);
					}
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
