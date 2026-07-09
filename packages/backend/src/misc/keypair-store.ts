import { UserKeypairs } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import type { UserKeypair } from "@/models/entities/user-keypair.js";
import { Cache } from "./cache.js";
import { CACHE_MAX_USER } from "./cache-limits.js";

const cache = new Cache<UserKeypair>(Infinity, { maxEntries: CACHE_MAX_USER });

export async function getUserKeypair(userId: User["id"]): Promise<UserKeypair> {
	return await cache.fetch(userId, () =>
		UserKeypairs.findOneByOrFail({ userId: userId }),
	);
}
