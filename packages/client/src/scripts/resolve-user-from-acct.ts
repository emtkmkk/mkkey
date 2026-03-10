import * as Acct from "calckey-js/built/acct";
import type * as misskey from "calckey-js";
import * as os from "@/os";

const CACHE_TTL_MS = 1000 * 60 * 30;

type UserIdCacheEntry = {
	userId: string;
	cachedAt: number;
};

const userIdCache = new Map<string, UserIdCacheEntry>();

function normalizeAcct(acct: string): string {
	return acct.trim().toLowerCase();
}

export async function resolveUserFromAcct(
	acct: string,
): Promise<misskey.entities.UserDetailed> {
	const normalizedAcct = normalizeAcct(acct);
	const cached = userIdCache.get(normalizedAcct);
	if (cached != null && Date.now() - cached.cachedAt <= CACHE_TTL_MS) {
		return await os.api("users/show", { userId: cached.userId }).catch(async () => {
			userIdCache.delete(normalizedAcct);
			const user = await os.api("users/show", Acct.parse(acct));
			userIdCache.set(normalizedAcct, {
				userId: user.id,
				cachedAt: Date.now(),
			});
			return user;
		});
	}

	if (cached != null) {
		userIdCache.delete(normalizedAcct);
	}

	const user = await os.api("users/show", Acct.parse(acct));
	userIdCache.set(normalizedAcct, {
		userId: user.id,
		cachedAt: Date.now(),
	});
	return user;
}
