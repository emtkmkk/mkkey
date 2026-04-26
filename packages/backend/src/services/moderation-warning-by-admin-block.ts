import { Blockings, Users } from "@/models/index.js";
import { publishInternalEvent } from "@/services/stream.js";
import type { CacheableUser, User } from "@/models/entities/user.js";

function shouldAutoModerationWarning(blocker: CacheableUser, blockee: CacheableUser): boolean {
	return Users.isRemoteUser(blocker) && Users.isLocalUser(blockee) && blockee.isAdmin;
}

async function publishUserModerationWarningChanged(userId: User["id"]): Promise<void> {
	await Users.invalidateMeDetailedBaseCache(userId);
	await Users.invalidateUserShowDetailedCache(userId);
	publishInternalEvent("localUserUpdated", { id: userId });
}

export async function setModerationWarningByAdminBlock(blocker: User, blockee: User): Promise<void> {
	if (!shouldAutoModerationWarning(blocker, blockee)) return;

	if (!blocker.isModerationWarning) {
		await Users.update(blocker.id, { isModerationWarning: true });
		await publishUserModerationWarningChanged(blocker.id);
	}
}

export async function unsetModerationWarningByAdminUnblock(
	blocker: CacheableUser,
	blockee: CacheableUser,
): Promise<void> {
	if (!shouldAutoModerationWarning(blocker, blockee)) return;

	const hasOtherAdminBlock =
		(await Blockings.createQueryBuilder("blocking")
			.innerJoin("user", "blockee", 'blockee.id = "blocking"."blockeeId"')
			.where('"blocking"."blockerId" = :blockerId', { blockerId: blocker.id })
			.andWhere('"blocking"."blockeeId" != :blockeeId', { blockeeId: blockee.id })
			.andWhere('"blockee"."host" IS NULL')
			.andWhere('"blockee"."isAdmin" = TRUE')
			.getCount()) > 0;

	if (hasOtherAdminBlock) return;

	const target = await Users.findOneBy({ id: blocker.id });
	if (target?.isModerationWarning) {
		await Users.update(blocker.id, { isModerationWarning: false });
		await publishUserModerationWarningChanged(blocker.id);
	}
}
