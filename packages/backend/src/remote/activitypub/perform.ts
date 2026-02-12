import type { IObject } from "./type.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { performActivity } from "./kernel/index.js";
import { updatePerson } from "./models/person.js";

export default async (
	actor: CacheableRemoteUser,
	activity: IObject,
	userId: string,
): Promise<void> => {
	await performActivity(actor, activity, userId);

	// Update the remote user information if it is out of date
	if (actor.uri) {
		const lastFetchedAtTime = actor.lastFetchedAt
			? new Date(actor.lastFetchedAt).getTime()
			: null;

		if (
			lastFetchedAtTime == null ||
			Number.isNaN(lastFetchedAtTime) ||
			Date.now() - lastFetchedAtTime > 1000 * 60 * 60 * 24
		) {
			setImmediate(() => {
				updatePerson(actor.uri!);
			});
		}
	}
};
