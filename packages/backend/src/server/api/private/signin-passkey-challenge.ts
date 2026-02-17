import type Koa from "koa";
import config from "@/config/index.js";
import { PasskeyLoginChallenges } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { randomBytes } from "node:crypto";
import { hash } from "../2fa.js";

export default async (ctx: Koa.Context) => {
	ctx.set("Access-Control-Allow-Origin", config.url);
	ctx.set("Access-Control-Allow-Credentials", "true");

	const challenge = randomBytes(32)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
	const challengeId = genId();

	await PasskeyLoginChallenges.insert({
		id: challengeId,
		challenge: hash(Buffer.from(challenge, "utf-8")).toString("hex"),
		createdAt: new Date(),
	});

	ctx.body = {
		challenge,
		challengeId,
	};
	ctx.status = 200;
};
