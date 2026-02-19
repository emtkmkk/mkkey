import type Koa from "koa";
import Router from "@koa/router";
import { v4 as uuid } from "uuid";
import autwh from "autwh";
import { IsNull } from "typeorm";
import { publishMainStream } from "@/services/stream.js";
import config from "@/config/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Users, UserProfiles } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import signin from "../common/signin.js";
import { redisClient } from "../../../db/redis.js";

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

// Init router
const router = new Router();

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

router.get("/disconnect/twitter", async (ctx) => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, "invalid origin");
		return;
	}

	const userToken = getUserToken(ctx);
	if (userToken == null) {
		ctx.throw(400, "signin required");
		return;
	}

	const user = await Users.findOneByOrFail({
		host: IsNull(),
		token: userToken,
	});

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

	profile.integrations.twitter = undefined;

	await UserProfiles.update(user.id, {
		integrations: profile.integrations,
	});

	ctx.body = "Twitterの連携を解除しました :v:";

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

async function getTwAuth() {
	const meta = await fetchMeta(true);

	if (
		meta.enableTwitterIntegration &&
		meta.twitterConsumerKey &&
		meta.twitterConsumerSecret
	) {
		return autwh({
			consumerKey: meta.twitterConsumerKey,
			consumerSecret: meta.twitterConsumerSecret,
			callbackUrl: `${config.url}/api/tw/cb`,
		});
	} else {
		return null;
	}
}

router.get("/connect/twitter", async (ctx) => {
	if (!compareOrigin(ctx)) {
		ctx.throw(400, "invalid origin");
		return;
	}

	const userToken = getUserToken(ctx);
	if (userToken == null) {
		ctx.throw(400, "signin required");
		return;
	}

	const twAuth = await getTwAuth();
	const twCtx = await twAuth!.begin();
	redisClient.set(userToken, JSON.stringify(twCtx), "EX", 600);
	ctx.redirect(twCtx.url);
});

router.get("/signin/twitter", async (ctx) => {
	const twAuth = await getTwAuth();
	const twCtx = await twAuth!.begin();

	const sessid = uuid();

	redisClient.set(sessid, JSON.stringify(twCtx), "EX", 600);

	ctx.cookies.set("signin_with_twitter_sid", sessid, {
		path: "/",
		secure: config.url.startsWith("https"),
		httpOnly: true,
	});

	ctx.redirect(twCtx.url);
});

router.get("/tw/cb", async (ctx) => {
	const userToken = getUserToken(ctx);

	const twAuth = await getTwAuth();

	if (userToken == null) {
		const sessid = ctx.cookies.get("signin_with_twitter_sid");

		if (sessid == null) {
			ctx.throw(400, "invalid session");
			return;
		}

		const twCtx = await getRedisValue(sessid);

		if (!twCtx) {
			ctx.throw(400, "invalid session");
			return;
		}

		const verifier = ctx.query.oauth_verifier;
		if (!verifier || typeof verifier !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		await deleteRedisKey(sessid);

		const parsedTwCtx = parseJsonSafely<Record<string, unknown>>(twCtx);

		if (!parsedTwCtx) {
			ctx.throw(400, "invalid session");
			return;
		}

		const result = await twAuth!.done(parsedTwCtx, verifier);

		const link = await UserProfiles.createQueryBuilder()
			.where("\"integrations\"->'twitter'->>'userId' = :id", {
				id: result.userId,
			})
			.andWhere('"userHost" IS NULL')
			.getOne();

		if (link == null) {
			ctx.throw(
				404,
				`@${result.screenName}と連携しているMisskeyアカウントはありませんでした...`,
			);
			return;
		}

		signin(
			ctx,
			(await Users.findOneBy({ id: link.userId })) as ILocalUser,
			true,
		);
	} else {
		const verifier = ctx.query.oauth_verifier;

		if (!verifier || typeof verifier !== "string") {
			ctx.throw(400, "invalid session");
			return;
		}

		const twCtx = await getRedisValue(userToken);

		if (!twCtx) {
			ctx.throw(400, "invalid session");
			return;
		}

		await deleteRedisKey(userToken);

		const parsedTwCtx = parseJsonSafely<Record<string, unknown>>(twCtx);

		if (!parsedTwCtx) {
			ctx.throw(400, "invalid session");
			return;
		}

		const result = await twAuth!.done(parsedTwCtx, verifier);

		const user = await Users.findOneByOrFail({
			host: IsNull(),
			token: userToken,
		});

		const profile = await UserProfiles.findOneByOrFail({ userId: user.id });

		await UserProfiles.update(user.id, {
			integrations: {
				...profile.integrations,
				twitter: {
					accessToken: result.accessToken,
					accessTokenSecret: result.accessTokenSecret,
					userId: result.userId,
					screenName: result.screenName,
				},
			},
		});

		ctx.body = `Twitter: @${result.screenName} を、Misskey: @${user.username} に接続しました！`;

		// Publish i updated event
		publishMainStream(
			user.id,
			"meUpdated",
			await Users.pack(user, user, {
				detail: true,
				includeSecrets: true,
			}),
		);
	}
});

export default router;
