import isNativeToken from "./common/is-native-token.js";
import type { CacheableLocalUser, ILocalUser } from "@/models/entities/user.js";
import { Users, AccessTokens, Apps } from "@/models/index.js";
import type { AccessToken } from "@/models/entities/access-token.js";
import { Cache } from "@/misc/cache.js";
import type { App } from "@/models/entities/app.js";
import { fetchAuthUserByTokenCache } from "@/services/user-cache.js";

const appCache = new Cache<App>(Infinity);

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthenticationError";
	}
}

const AUTH_USER_SELECT = {
	id: true,
	host: true,
	isSuspended: true,
	isAdmin: true,
	isModerator: true,
} as const;

export default async (
	authorization: string | null | undefined,
	bodyToken: string | null,
): Promise<
	[CacheableLocalUser | null | undefined, AccessToken | null | undefined]
> => {
	let token: string | null = null;

	// check if there is an authorization header set
	if (authorization != null) {
		if (bodyToken != null) {
			throw new AuthenticationError("using multiple authorization schemes");
		}

		// check if OAuth 2.0 Bearer tokens are being used
		// Authorization schemes are case insensitive
		if (authorization.substring(0, 7).toLowerCase() === "bearer ") {
			token = authorization.substring(7);
		} else {
			throw new AuthenticationError("unsupported authentication scheme");
		}
	} else if (bodyToken != null) {
		token = bodyToken;
	} else {
		return [null, null];
	}

	if (isNativeToken(token)) {
		const user = await fetchAuthUserByTokenCache(token, async () => {
			const authUser = await Users.findOne({
				where: { token },
				select: AUTH_USER_SELECT,
			});
			return authUser as ILocalUser | null;
		});

		if (user == null) {
			throw new AuthenticationError("unknown token");
		}

		return [user, null];
	} else {
		const accessToken = await AccessTokens.findOne({
			where: [
				{
					hash: token.toLowerCase(), // app
				},
				{
					token: token, // miauth
				},
			],
		});

		if (accessToken == null) {
			throw new AuthenticationError("unknown token");
		}

		AccessTokens.update(accessToken.id, {
			lastUsedAt: new Date(),
		});

		const user = await fetchAuthUserByTokenCache(token, async () => {
			const authUser = await Users.findOne({
				where: {
					id: accessToken.userId,
				},
				select: AUTH_USER_SELECT,
			});
			return authUser as CacheableLocalUser | null;
		});

		if (user == null) {
			throw new AuthenticationError("unknown token");
		}

		if (accessToken.appId) {
			const app = await appCache.fetch(accessToken.appId, () =>
				Apps.findOneByOrFail({ id: accessToken.appId! }),
			);

			return [
				user,
				{
					id: accessToken.id,
					permission: app.permission,
				} as AccessToken,
			];
		} else {
			return [user, accessToken];
		}
	}
};
