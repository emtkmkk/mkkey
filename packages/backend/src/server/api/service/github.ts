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
	return ((ctx.headers["cookie"] || "").match(/(?:^|;\s*)igi=([^;]+)/) || [null, null])[1];
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

function setRedisValue(key: string, value: string, expiresInSeconds: number): Promise<void> {
	return new Promise((resolve, reject) => {
		redisClient.set(key, value, "EX", expiresInSeconds, (err) => {
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

// Init router
const router = new Router();

router.get("/disconnect/github", async (ctx) => {
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

	profile.integrations.github = undefined;

	await UserProfiles.update(user.id, {
		integrations: profile.integrations,
	});

	ctx.body = "GitHubの連携を解除しました :v:";

	// Publish i updated event
	publishMainStream(
		user.id,
		"meUpdated",
		await Users.pack(user, user, {
			detail: true,
			includeSecrets: true,
		}),
	);
});

async function getOath2() {
	const meta = await fetchMeta(true);

	if (
		meta.enableGithubIntegration &&
		meta.githubClientId &&
		meta.githubClientSecret
	) {
		return new OAuth2(
			meta.githubClientId,
			meta.githubClientSecret,
			"https://github.com/",
			"login/oauth/authorize",
			"login/oauth/access_token",
		);
	} else {
		return null;
	}
}

router.get("/connect/github", async (ctx) => {
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
		redirect_uri: `${config.url}/api/gh/cb`,
		scope: ["read:user"],
		state: uuid(),
	};

	await setRedisValue(userToken, JSON.stringify(params), 600);
	await setRedisValue(`github:connect:state:${params.state}`, JSON.stringify(params), 600);

	const oauth2 = await getOath2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get("/signin/github", async (ctx) => {
	const previousSessid = ctx.cookies.get("signin_with_github_sid");
	if (previousSessid) {
		const previousStateRaw = await getRedisValue(previousSessid);
		await deleteRedisKey(previousSessid);

		const previousState = previousStateRaw
			? parseJsonSafely<{ state: string }>(previousStateRaw)
			: null;
		if (previousState) {
			await deleteRedisKey(`github:signin:state:${previousState.state}`);
		}
	}

	const sessid = uuid();
	const state = uuid();

	const params = {
		redirect_uri: `${config.url}/api/gh/cb`,
		scope: ["read:user"],
		state,
	};

	ctx.cookies.set("signin_with_github_sid", sessid, {
		path: "/",
		secure: config.url.startsWith("https"),
		httpOnly: true,
	});

	await setRedisValue(sessid, JSON.stringify(params), 600);
	await setRedisValue(`github:signin:state:${state}`, JSON.stringify(params), 600);

	const oauth2 = await getOath2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get("/gh/cb", async (ctx) => {
	const userToken = getUserToken(ctx);

	const oauth2 = await getOath2();

	if (!userToken) {
		const code = ctx.query.code;

		if (!code || typeof code !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		const callbackState = ctx.query.state;
		if (!callbackState || typeof callbackState !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		const sessid = ctx.cookies.get("signin_with_github_sid");
		const savedStateByCookie = sessid ? await getRedisValue(sessid) : null;
		const savedState =
			savedStateByCookie ??
			(await getRedisValue(`github:signin:state:${callbackState}`));

		if (!savedState) {
			if (sessid) {
				await deleteRedisKey(sessid);
			}
			await deleteRedisKey(`github:signin:state:${callbackState}`);
			ctx.throw(400, "invalid session");
			return;
		}

		const savedStateObject = parseJsonSafely<{
			redirect_uri: string;
			state: string;
		}>(savedState);

		if (!savedStateObject) {
			ctx.throw(400, "invalid session");
			return;
		}

		const { redirect_uri, state } = savedStateObject;

		if (callbackState !== state) {
			ctx.throw(400, "invalid session");
			return;
		}

		try {
			const { accessToken } = await new Promise<any>((res, rej) =>
				oauth2!.getOAuthAccessToken(
					code,
					{
						redirect_uri,
					},
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

			const { login, id } = (await getJson(
				"https://api.github.com/user",
				"application/vnd.github.v3+json",
				10 * 1000,
				{
					Authorization: `bearer ${accessToken}`,
				},
			)) as Record<string, unknown>;
			if (typeof login !== "string" || typeof id !== "string") {
				ctx.throw(400, "invalid session");
				return;
			}

			const link = await UserProfiles.createQueryBuilder()
				.where("\"integrations\"->'github'->>'id' = :id", { id: id })
				.andWhere('"userHost" IS NULL')
				.getOne();

			if (link == null) {
				ctx.throw(
					404,
					`@${login}と連携しているMisskeyアカウントはありませんでした...`,
				);
				return;
			}

			signin(
				ctx,
				(await Users.findOneBy({ id: link.userId })) as ILocalUser,
				true,
			);
		} finally {
			if (sessid) {
				await deleteRedisKey(sessid);
			}
			await deleteRedisKey(`github:signin:state:${callbackState}`);
		}
	} else {
		const code = ctx.query.code;
		const callbackState = ctx.query.state;

		if (!code || typeof code !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		if (!callbackState || typeof callbackState !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		const savedStateByUserToken = await getRedisValue(userToken);
		const savedStateByState = await getRedisValue(`github:connect:state:${callbackState}`);
		const savedState = savedStateByUserToken ?? savedStateByState;

		if (!savedState) {
			ctx.throw(400, "invalid session");
			return;
		}

		const savedStateObject = parseJsonSafely<{
			redirect_uri: string;
			state: string;
		}>(savedState);

		if (!savedStateObject) {
			ctx.throw(400, "invalid session");
			return;
		}

		const { redirect_uri, state } = savedStateObject;

		if (callbackState !== state) {
			ctx.throw(400, "invalid session");
			return;
		}

		try {
			const { accessToken } = await new Promise<any>((res, rej) =>
				oauth2!.getOAuthAccessToken(
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

			const { login, id } = (await getJson(
				"https://api.github.com/user",
				"application/vnd.github.v3+json",
				10 * 1000,
				{
					Authorization: `bearer ${accessToken}`,
				},
			)) as Record<string, unknown>;

			if (typeof login !== "string" || typeof id !== "string") {
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
					github: {
						accessToken: accessToken,
						id: id,
						login: login,
					},
				},
			});

			ctx.body = `GitHub: @${login} を、Misskey: @${user.username} に接続しました！`;

			// Publish i updated event
			publishMainStream(
				user.id,
				"meUpdated",
				await Users.pack(user, user, {
					detail: true,
					includeSecrets: true,
				}),
			);
		} finally {
			await deleteRedisKey(userToken);
			await deleteRedisKey(`github:connect:state:${callbackState}`);
		}
	}
});

export default router;
