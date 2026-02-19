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

// Init router
const router = new Router();

router.get("/disconnect/discord", async (ctx) => {
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

	profile.integrations.discord = undefined;

	await UserProfiles.update(user.id, {
		integrations: profile.integrations,
	});

	ctx.body = "Discordの連携を解除しました :v:";

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

async function getOAuth2() {
	const meta = await fetchMeta(true);

	if (meta.enableDiscordIntegration) {
		return new OAuth2(
			meta.discordClientId!,
			meta.discordClientSecret!,
			"https://discord.com/",
			"api/oauth2/authorize",
			"api/oauth2/token",
		);
	} else {
		return null;
	}
}

router.get("/connect/discord", async (ctx) => {
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
		redirect_uri: `${config.url}/api/dc/cb`,
		scope: ["identify"],
		state: uuid(),
		response_type: "code",
	};

	await setRedisValue(userToken, JSON.stringify(params), 600);
	await setRedisValue(
		`discord:connect:state:${params.state}`,
		JSON.stringify(params),
		600,
	);

	const oauth2 = await getOAuth2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get("/signin/discord", async (ctx) => {
	const previousSessid = ctx.cookies.get("signin_with_discord_sid");
	if (previousSessid) {
		const previousStateRaw = await getRedisValue(previousSessid);
		await deleteRedisKey(previousSessid);

		const previousState = previousStateRaw
			? parseJsonSafely<{ state: string }>(previousStateRaw)
			: null;
		if (previousState) {
			await deleteRedisKey(`discord:signin:state:${previousState.state}`);
		}
	}

	const sessid = uuid();
	const state = uuid();

	const params = {
		redirect_uri: `${config.url}/api/dc/cb`,
		scope: ["identify"],
		state,
		response_type: "code",
	};

	ctx.cookies.set("signin_with_discord_sid", sessid, {
		path: "/",
		secure: config.url.startsWith("https"),
		httpOnly: true,
	});

	await setRedisValue(sessid, JSON.stringify(params), 600);
	await setRedisValue(`discord:signin:state:${state}`, JSON.stringify(params), 600);

	const oauth2 = await getOAuth2();
	ctx.redirect(oauth2!.getAuthorizeUrl(params));
});

router.get("/dc/cb", async (ctx) => {
	const userToken = getUserToken(ctx);

	const oauth2 = await getOAuth2();

	if (!userToken) {
		const code = ctx.query.code;

		if (!code || typeof code !== "string") {
			ctx.throw(400, "invalid session - 2");
			return;
		}

		const callbackState = ctx.query.state;
		if (!callbackState || typeof callbackState !== "string") {
			ctx.throw(400, "invalid session - 1");
			return;
		}

		const sessid = ctx.cookies.get("signin_with_discord_sid");
		const savedStateByCookie = sessid ? await getRedisValue(sessid) : null;
		const savedState =
			savedStateByCookie ??
			(await getRedisValue(`discord:signin:state:${callbackState}`));

		if (!savedState) {
			if (sessid) {
				await deleteRedisKey(sessid);
			}
			await deleteRedisKey(`discord:signin:state:${callbackState}`);
			ctx.throw(400, "invalid session - 3");
			return;
		}

		const savedStateObject = parseJsonSafely<{ redirect_uri: string; state: string }>(savedState);
		if (!savedStateObject) {
			ctx.throw(400, "invalid session - 3");
			return;
		}

		const { redirect_uri, state } = savedStateObject;

		if (callbackState !== state) {
			ctx.throw(400, "invalid session - 3");
			return;
		}

		try {
			const { accessToken, refreshToken, expiresDate } = await new Promise<any>(
				(res, rej) =>
					oauth2!.getOAuthAccessToken(
						code,
						{
							grant_type: "authorization_code",
							redirect_uri,
						},
						(err, accessToken, refreshToken, result) => {
							if (err) {
								rej(err);
							} else if (result.error) {
								rej(result.error);
							} else {
								res({
									accessToken,
									refreshToken,
									expiresDate: Date.now() + Number(result.expires_in) * 1000,
								});
							}
						},
					),
			);

			const { id, username, discriminator } = (await getJson(
				"https://discord.com/api/users/@me",
				"*/*",
				10 * 1000,
				{
					Authorization: `Bearer ${accessToken}`,
				},
			)) as Record<string, unknown>;

			if (
				typeof id !== "string" ||
				typeof username !== "string" ||
				typeof discriminator !== "string"
			) {
				ctx.throw(400, "invalid session - 4");
				return;
			}

			const profile = await UserProfiles.createQueryBuilder()
				.where("\"integrations\"->'discord'->>'id' = :id", { id: id })
				.andWhere('"userHost" IS NULL')
				.getOne();

			if (profile == null) {
				ctx.throw(
					404,
					`@${username}#${discriminator}と連携しているMisskeyアカウントはありませんでした...`,
				);
				return;
			}

			await UserProfiles.update(profile.userId, {
				integrations: {
					...profile.integrations,
					discord: {
						id: id,
						accessToken: accessToken,
						refreshToken: refreshToken,
						expiresDate: expiresDate,
						username: username,
						discriminator: discriminator,
					},
				},
			});

			signin(
				ctx,
				(await Users.findOneBy({ id: profile.userId })) as ILocalUser,
				true,
			);
		} finally {
			if (sessid) {
				await deleteRedisKey(sessid);
			}
			await deleteRedisKey(`discord:signin:state:${callbackState}`);
		}
	} else {
		const code = ctx.query.code;
		const callbackState = ctx.query.state;

		if (!code || typeof code !== "string") {
			ctx.throw(400, "invalid session - 5");
			return;
		}

		if (!callbackState || typeof callbackState !== "string") {
			ctx.throw(400, "invalid session - 6");
			return;
		}

		const savedStateByUserToken = await getRedisValue(userToken);
		const savedStateByState = await getRedisValue(
			`discord:connect:state:${callbackState}`,
		);
		const savedState = savedStateByUserToken ?? savedStateByState;
		if (!savedState) {
			ctx.throw(400, "invalid session - 6");
			return;
		}

		const savedStateObject = parseJsonSafely<{ redirect_uri: string; state: string }>(savedState);
		if (!savedStateObject) {
			ctx.throw(400, "invalid session - 6");
			return;
		}

		const { redirect_uri, state } = savedStateObject;

		if (callbackState !== state) {
			ctx.throw(400, "invalid session - 6");
			return;
		}

		try {
			const { accessToken, refreshToken, expiresDate } = await new Promise<any>(
				(res, rej) =>
					oauth2!.getOAuthAccessToken(
						code,
						{
							grant_type: "authorization_code",
							redirect_uri,
						},
						(err, accessToken, refreshToken, result) => {
							if (err) {
								rej(err);
							} else if (result.error) {
								rej(result.error);
							} else {
								res({
									accessToken,
									refreshToken,
									expiresDate: Date.now() + Number(result.expires_in) * 1000,
								});
							}
						},
					),
			);

			const { id, username, discriminator } = (await getJson(
				"https://discord.com/api/users/@me",
				"*/*",
				10 * 1000,
				{
					Authorization: `Bearer ${accessToken}`,
				},
			)) as Record<string, unknown>;
			if (
				typeof id !== "string" ||
				typeof username !== "string" ||
				typeof discriminator !== "string"
			) {
				ctx.throw(400, "invalid session - 7");
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
					discord: {
						accessToken: accessToken,
						refreshToken: refreshToken,
						expiresDate: expiresDate,
						id: id,
						username: username,
						discriminator: discriminator,
					},
				},
			});

			ctx.body = `Discord: @${username}#${discriminator} を、Misskey: @${user.username} に接続しました！`;

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
			await deleteRedisKey(`discord:connect:state:${callbackState}`);
		}
	}
});

export default router;
