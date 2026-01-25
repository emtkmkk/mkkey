import DeliverManager from "@/remote/activitypub/deliver-manager.js";
import { Users } from "@/models/index.js";
import type { Note } from "@/models/entities/note.js";
import type { ILocalUser, IRemoteUser, User } from "@/models/entities/user.js";

export async function buildReactionDeliverManager(
	user: Pick<User, "id" | "host" | "isExplorable" | "isRemoteExplorable">,
	note: Note,
	activity: any,
	options?: {
		disableUnion?: boolean;
	},
) {
	const dm = new DeliverManager(user as ILocalUser, activity);

	if (note.userHost !== null) {
		const reactee = await Users.findOneBy({ id: note.userId });
		if (reactee && Users.isRemoteUser(reactee)) {
			dm.addDirectRecipe(reactee as IRemoteUser);
		}
	}

	if (user.isExplorable && user.isRemoteExplorable && note.isPublicLikeList) {
		if (["public", "home", "followers"].includes(note.visibility)) {
			if (note.userId !== user.id && note.userHost === null) {
				const u = await Users.findOneBy({ id: note.userId });
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
			const visibleUsers = await Promise.all(
				note.visibleUserIds.map((id) => Users.findOneBy({ id })),
			);
			for (const u of visibleUsers.filter((u) => u && Users.isRemoteUser(u))) {
				dm.addDirectRecipe(u as IRemoteUser);
			}
			const ccUsers = await Promise.all(
				note.ccUserIds.map((id) => Users.findOneBy({ id })),
			);
			for (const u of ccUsers.filter((u) => u && Users.isRemoteUser(u))) {
				dm.addDirectRecipe(u as IRemoteUser);
			}
		}
	}

	return dm;
}
