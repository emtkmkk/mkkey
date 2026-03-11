import type Koa from "koa";
import Router from "@koa/router";
import { OAuth2 } from "oauth";
import { v4 as uuid } from "uuid";
import { IsNull } from "typeorm";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { publishMainStream } from "@/services/stream.js";
import { Users, UserProfiles } from "@/models/index.js";
import { redisClient } from "../../../db/redis.js";

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

function detectOAuthFlowFromState(state: unknown): "signin" | "connect" | "unknown" {
	if (typeof state !== "string") return "unknown";
	if (state.startsWith("signin:")) return "signin";
	if (state.startsWith("connect:")) return "connect";
	return "unknown";
}

const router = new Router();

async function getOAuth2() {
	const meta = await fetchMeta(true);
	if (
		!meta.enableSwarmIntegration ||
		!meta.swarmClientId ||
		!meta.swarmClientSecret
	) {
		return null;
	}

	return new OAuth2(
		meta.swarmClientId,
		meta.swarmClientSecret,
		"https://foursquare.com/",
		"oauth2/authenticate",
		"oauth2/access_token",
	);
}

router.get("/disconnect/swarm", async (ctx) => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, "invalid origin");
		return;
	}

	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, "signin required");
		return;
	}

	const user = await Users.findOneByOrFail({ host: IsNull(), token: userToken });
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	profile.integrations.swarm = undefined;
	await UserProfiles.update(user.id, { integrations: profile.integrations });
	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);

	ctx.body = "Swarmの連携を解除しました :v:";
	publishMainStream(user.id, "meUpdated", await Users.pack(user, user, { detail: true, includeSecrets: true }));
});

router.get("/connect/swarm", async (ctx) => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, "invalid origin");
		return;
	}

	const oauth2 = await getOAuth2();
	if (!oauth2) {
		ctx.throw(503, "swarm oauth is not configured");
		return;
	}

	const userToken = getUserToken(ctx);
	if (!userToken) {
		ctx.throw(400, "signin required");
		return;
	}

	const params = {
		response_type: "code",
		redirect_uri: `${config.url}/api/swarm/cb`,
		state: `connect:${uuid()}`,
	};

	await setRedisValue(userToken, JSON.stringify(params), 600);
	await setRedisValue(`swarm:connect:state:${params.state}`, JSON.stringify(params), 600);

	ctx.redirect(oauth2.getAuthorizeUrl(params));
});

router.get("/swarm/cb", async (ctx) => {
	const userToken = getUserToken(ctx);
	const callbackState = ctx.query.state;
	const stateFlow = detectOAuthFlowFromState(callbackState);
	if (stateFlow !== "connect" || !userToken) {
		ctx.throw(400, "invalid session");
		return;
	}

	if (!callbackState || typeof callbackState !== "string") {
		ctx.throw(400, "invalid session");
		return;
	}

	const code = ctx.query.code;
	if (!code || typeof code !== "string") {
		ctx.throw(400, "invalid session");
		return;
	}

	const oauth2 = await getOAuth2();
	if (!oauth2) {
		ctx.throw(503, "swarm oauth is not configured");
		return;
	}

	const savedStateByToken = await getRedisValue(userToken);
	const savedStateByFlow = await getRedisValue(`swarm:connect:state:${callbackState}`);
	const savedState = savedStateByToken ?? savedStateByFlow;

	if (!savedState) {
		ctx.throw(400, "invalid session");
		return;
	}

	const parsed = parseJsonSafely<{ state: string }>(savedState);
	if (!parsed || parsed.state !== callbackState) {
		ctx.throw(400, "invalid session");
		return;
	}

	await deleteRedisKey(userToken);
	await deleteRedisKey(`swarm:connect:state:${callbackState}`);

	const token = await new Promise<string>((resolve, reject) => {
		oauth2.getOAuthAccessToken(
			code,
			{ grant_type: "authorization_code", redirect_uri: `${config.url}/api/swarm/cb` },
			(err, accessToken) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(accessToken as string);
			},
		);
	});

	const user = await Users.findOneByOrFail({ host: IsNull(), token: userToken });
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	const current = profile.integrations.swarm ?? {};

	await UserProfiles.update(user.id, {
		integrations: {
			...profile.integrations,
			swarm: {
				...current,
				accessToken: token,
				connectedAt: new Date().toISOString(),
			},
		},
	});
	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);

	publishMainStream(user.id, "meUpdated", await Users.pack(user, user, { detail: true, includeSecrets: true }));
	ctx.redirect(`${config.url}/settings/integration`);
});

export default router;
