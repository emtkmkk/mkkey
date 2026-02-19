import type Koa from "koa";
import Router from "@koa/router";
import { OAuth2 } from "oauth";
import { v4 as uuid } from "uuid";
import { IsNull } from "typeorm";
import { getJson } from "@/misc/fetch.js";
import config from "@/config/index.js";
import { publishMainStream } from "@/services/stream.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Users, UserProfiles } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { redisClient } from "../../../db/redis.js";
import signin from "../common/signin.js";

function getUserToken(ctx: Koa.BaseContext): string | null {
	return ((ctx.headers["cookie"] || "").match(/igi=(\w+)/) || [null, null])[1];
}

function compareOrigin(ctx: Koa.BaseContext): boolean {
	function getOrigin(url: string | string[] | undefined): string | null {
		if (typeof url !== "string") {
			return null;
		}

		try {
			return new URL(url).origin;
		} catch {
			return null;
		}
	}

	const requestOrigin = getOrigin(ctx.headers["origin"]) ?? getOrigin(ctx.headers["referer"]);
	const configuredOrigin = getOrigin(config.url);

	return requestOrigin != null && configuredOrigin != null && requestOrigin === configuredOrigin;
}

function getRedisValue(key: string): Promise<string | null> {
	return new Promise((resolve, reject) => {
		redisClient.get(key, (err, value) => {
			if (err) {
				reject(err);
				return;
			}

			resolve(value);
		});
	});
}

function deleteRedisKey(key: string): Promise<void> {
	return new Promise((resolve, reject) => {
		redisClient.del(key, (err) => {
			if (err) {
				reject(err);
				return;
			}

			resolve();
		});
	});
}

function parseJsonSafely<T>(value: string): T | null {
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

const router = new Router();
const GOOGLE_SCOPE = "openid profile email";

router.get("/disconnect/google", async (ctx) => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, "invalid origin");
		return;
	}

	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, "signin required");
		return;
	}

	const user = await Users.findOneByOrFail({
		host: IsNull(),
		token: userToken,
	});

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	profile.integrations.google = undefined;

	await UserProfiles.update(user.id, {
		integrations: profile.integrations,
	});

	ctx.body = "Googleの連携を解除しました :v:";

	publishMainStream(
		user.id,
		"meUpdated",
		await Users.pack(user, user, {
			detail: true,
			includeSecrets: true,
		}),
	);
});

async function getOAuth2() {
	const meta = await fetchMeta(true);

	if (
		meta.enableGoogleIntegration &&
		meta.googleClientId &&
		meta.googleClientSecret
	) {
		return new OAuth2(
			meta.googleClientId,
			meta.googleClientSecret,
			"https://accounts.google.com/",
			"o/oauth2/v2/auth",
			"token",
		);
	}

	return null;
}

router.get("/connect/google", async (ctx) => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, "invalid origin");
		return;
	}

	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, "signin required");
		return;
	}

	const params = {
		redirect_uri: `${config.url}/api/go/cb`,
		scope: GOOGLE_SCOPE,
		state: uuid(),
		response_type: "code",
	};

	redisClient.set(userToken, JSON.stringify(params), "EX", 600);

	const oauth2 = await getOAuth2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get("/signin/google", async (ctx) => {
	const sessid = uuid();

	const params = {
		redirect_uri: `${config.url}/api/go/cb`,
		scope: GOOGLE_SCOPE,
		state: uuid(),
		response_type: "code",
	};

	ctx.cookies.set("signin_with_google_sid", sessid, {
		path: "/",
		secure: config.url.startsWith("https"),
		httpOnly: true,
	});

	redisClient.set(sessid, JSON.stringify(params), "EX", 600);

	const oauth2 = await getOAuth2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get("/go/cb", async (ctx) => {
	const userToken = getUserToken(ctx);
	const oauth2 = await getOAuth2();

	if (!oauth2) {
		ctx.throw(503, "google integration unavailable");
		return;
	}

	const code = ctx.query.code;
	if (!code || typeof code !== "string") {
		ctx.throw(400, "invalid session");
		return;
	}

	if (!userToken) {
		const sessid = ctx.cookies.get("signin_with_google_sid");
		if (!sessid) {
			ctx.throw(400, "invalid session");
			return;
		}

		const savedState = await getRedisValue(sessid);
		if (!savedState) {
			ctx.throw(400, "invalid session");
			return;
		}

		const savedStateObject = parseJsonSafely<{ redirect_uri: string; state: string }>(savedState);
		if (!savedStateObject) {
			ctx.throw(400, "invalid session");
			return;
		}

		const { redirect_uri, state } = savedStateObject;
		if (ctx.query.state !== state) {
			ctx.throw(400, "invalid session");
			return;
		}

		await deleteRedisKey(sessid);

		const { accessToken } = await new Promise<any>((res, rej) =>
			oauth2.getOAuthAccessToken(
				code,
				{ redirect_uri },
				(err, accessToken, refresh, result) => {
					if (err) {
						rej(err);
					} else if (result.error) {
						rej(result.error);
					} else {
						res({ accessToken });
					}
				},
			),
		);

		const { sub, name, email } = (await getJson(
			"https://www.googleapis.com/oauth2/v3/userinfo",
			"application/json",
			10 * 1000,
			{ Authorization: `Bearer ${accessToken}` },
		)) as Record<string, unknown>;

		if (typeof sub !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		const profile = await UserProfiles.createQueryBuilder()
			.where("\"integrations\"->'google'->>'id' = :id", { id: sub })
			.andWhere('"userHost" IS NULL')
			.getOne();

		if (!profile) {
			ctx.throw(
				404,
				`${typeof email === "string" ? email : sub}と連携しているMisskeyアカウントはありませんでした...`,
			);
			return;
		}

		await UserProfiles.update(profile.userId, {
			integrations: {
				...profile.integrations,
				google: {
					id: sub,
					accessToken,
					name: typeof name === "string" ? name : null,
					email: typeof email === "string" ? email : null,
				},
			},
		});

		signin(
			ctx,
			(await Users.findOneBy({ id: profile.userId })) as ILocalUser,
			true,
		);
		return;
	}

	const savedState = await getRedisValue(userToken);
	if (!savedState) {
		ctx.throw(400, "invalid session");
		return;
	}

	const savedStateObject = parseJsonSafely<{ redirect_uri: string; state: string }>(savedState);
	if (!savedStateObject) {
		ctx.throw(400, "invalid session");
		return;
	}

	const { redirect_uri, state } = savedStateObject;
	if (ctx.query.state !== state) {
		ctx.throw(400, "invalid session");
		return;
	}

	await deleteRedisKey(userToken);

	const { accessToken } = await new Promise<any>((res, rej) =>
		oauth2.getOAuthAccessToken(
			code,
			{ redirect_uri },
			(err, accessToken, refresh, result) => {
				if (err) {
					rej(err);
				} else if (result.error) {
					rej(result.error);
				} else {
					res({ accessToken });
				}
			},
		),
	);

	const { sub, name, email } = (await getJson(
		"https://www.googleapis.com/oauth2/v3/userinfo",
		"application/json",
		10 * 1000,
		{ Authorization: `Bearer ${accessToken}` },
	)) as Record<string, unknown>;

	if (typeof sub !== "string") {
		ctx.throw(400, "invalid session");
		return;
	}

	const user = await Users.findOneByOrFail({
		host: IsNull(),
		token: userToken,
	});
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	await UserProfiles.update(user.id, {
		integrations: {
			...profile.integrations,
			google: {
				id: sub,
				accessToken,
				name: typeof name === "string" ? name : null,
				email: typeof email === "string" ? email : null,
			},
		},
	});

	ctx.body = `Google: ${typeof email === "string" ? email : sub} を、Misskey: @${user.username} に接続しました！`;

	publishMainStream(
		user.id,
		"meUpdated",
		await Users.pack(user, user, {
			detail: true,
			includeSecrets: true,
		}),
	);
});

export default router;
