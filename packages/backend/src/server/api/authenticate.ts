/**
 * @packageDocumentation
 *
 * API およびストリーミング用の認証。トークンからユーザー・アプリを解決する。
 *
 * @remarks
 * - **役割**: Authorization ヘッダーまたはクエリのトークンから AccessToken を解決し、ユーザーとアプリを返す。
 * - API の api-handler とストリーミング接続の両方で利用される。
 * - `AUTH_USER_SELECT` はストリーム TL 等でも参照する。列を抜くと `undefined` になり、`!user.flag`（既定 true のフラグ）で誤って制限が掛かる。
 * - 既定 **false** のフラグは `!undefined` が制限側に寄るため事故は起きにくいが、明示比較（`=== false` / `!== true`）の方が安全。
 *
 * @see {@link api-handler} API 認証
 * @see {@link streaming} ストリーム接続認証
 * @internal
 */
import isNativeToken from "./common/is-native-token.js";
import type { CacheableLocalUser, ILocalUser } from "@/models/entities/user.js";
import { Users, AccessTokens, Apps } from "@/models/index.js";
import type { AccessToken } from "@/models/entities/access-token.js";
import { Cache } from "@/misc/cache.js";
import type { App } from "@/models/entities/app.js";
import { fetchAuthUserByTokenCache } from "@/services/user-cache.js";
import { maybeInvalidateDormantFollowerCacheOnActivity } from "@/remote/activitypub/dormant-follower-check.js";

const appCache = new Cache<App>(Infinity);

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthenticationError";
	}
}

const AUTH_USER_SELECT = {
	id: true,
	username: true,
	host: true,
	isSuspended: true,
	isAdmin: true,
	isModerator: true,
	driveCapacityOverrideMb: true,
	emojis: true,
	// ストリーム TL が参照するが、未選択だと undefined になり !flag で誤ってノートを落とす
	localShowRenote: true,
	remoteShowRenote: true,
	showTimelineReplies: true,
	showSelfRenoteToHome: true,
	// spotlight ストリームの閾値用（未選択だと undefined になり比較が壊れる）
	followingCount: true,
} as const;

/**
 * ログイン成功時に lastActiveDate を更新し、休眠だった場合のみ休眠スキップキャッシュを無効化する。
 */
async function updateLastActiveDateOnLogin(user: {
	id: CacheableLocalUser["id"];
	host: CacheableLocalUser["host"];
}): Promise<void> {
	const prev = await Users.findOneBy(
		{ id: user.id },
		{ select: ["lastActiveDate", "host"] },
	);
	await maybeInvalidateDormantFollowerCacheOnActivity(
		user.id,
		prev?.host ?? user.host ?? null,
		prev?.lastActiveDate ?? null,
	);
	Users.update(user.id, {
		lastActiveDate: new Date(),
	});
}

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

		await updateLastActiveDateOnLogin(user);
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

		await updateLastActiveDateOnLogin(user);

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
