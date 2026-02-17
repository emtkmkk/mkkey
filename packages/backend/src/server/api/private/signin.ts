import type Koa from "koa";
import * as speakeasy from "speakeasy";
import signin from "../common/signin.js";
import config from "@/config/index.js";
import {
	Users,
	Signins,
	UserProfiles,
	UserSecurityKeys,
	AttestationChallenges,
	PasskeyLoginChallenges,
} from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import { genId } from "@/misc/gen-id.js";
import {
	comparePassword,
	hashPassword,
	isOldAlgorithm,
} from "@/misc/password.js";
import { verifyLogin, hash } from "../2fa.js";
import { randomBytes } from "node:crypto";
import { IsNull } from "typeorm";
import { limiter } from "../limiter.js";
import { getIpHash } from "@/misc/get-ip-hash.js";

export default async (ctx: Koa.Context) => {
	ctx.set("Access-Control-Allow-Origin", config.url);
	ctx.set("Access-Control-Allow-Credentials", "true");

	const body = ctx.request.body as any;
	const username = body["username"];
	const password = body["password"];
	const token = body["token"];

	function error(status: number, error: { id: string }) {
		ctx.status = status;
		ctx.body = { error };
	}

	try {
		await limiter(
			{ key: "signin", duration: 60 * 60 * 1000, max: 10, minInterval: 1000 },
			getIpHash(ctx.ip),
		);
	} catch (err) {
		ctx.status = 429;
		ctx.body = {
			error: {
				message: "ログインに失敗しました。後で再試行してください。",
				code: "TOO_MANY_AUTHENTICATION_FAILURES",
				id: "22d05606-fbcf-421a-a2db-b32610dcfd1b",
			},
		};
		return;
	}

	async function fail(
		userId?: string,
		status?: number,
		failure?: { id: string },
	) {
		if (userId) {
			await Signins.insert({
				id: genId(),
				createdAt: new Date(),
				userId,
				ip: ctx.ip,
				headers: ctx.headers,
				success: false,
			});
		}

		error(
			status || 500,
			failure || { id: "4e30e80c-e338-45a0-8c8f-44455efa3b76" },
		);
	}

	const passkeyAuth =
		typeof body.credentialId === "string" &&
		typeof body.authenticatorData === "string" &&
		typeof body.clientDataJSON === "string" &&
		typeof body.signature === "string";

	if (passkeyAuth && typeof body.challengeId === "string") {
		const clientDataJSON = Buffer.from(body.clientDataJSON, "hex");
		const clientData = JSON.parse(clientDataJSON.toString("utf-8"));
		const keyId = Buffer.from(
			body.credentialId.replace(/-/g, "+").replace(/_/g, "/"),
			"base64",
		).toString("hex");

		const securityKey = await UserSecurityKeys.findOneBy({ id: keyId });

		if (!securityKey) {
			await fail(undefined, 403, {
				id: "66269679-aeaf-4474-862b-eb761197e046",
			});
			return;
		}

		const user = (await Users.findOneBy({
			id: securityKey.userId,
			host: IsNull(),
		})) as ILocalUser;

		if (!user || user.isSuspended) {
			await fail(securityKey.userId, 403, {
				id: "e03a5f46-d309-4865-9b69-56282d94e1eb",
			});
			return;
		}

		if (body.userHandle != null) {
			if (typeof body.userHandle !== "string") {
				await fail(user.id, 400, {
					id: "93b86c4b-72f9-40eb-9815-798928603d1e",
				});
				return;
			}

			const userHandle = Buffer.from(body.userHandle, "hex").toString("utf-8");

			if (userHandle !== user.id) {
				await fail(user.id, 403, {
					id: "93b86c4b-72f9-40eb-9815-798928603d1e",
				});
				return;
			}
		}

		const challengeHash = hash(Buffer.from(clientData.challenge, "utf-8")).toString("hex");

		const userChallenge = await AttestationChallenges.findOneBy({
			userId: user.id,
			id: body.challengeId,
			registrationChallenge: false,
			challenge: challengeHash,
		});

		const globalChallenge = await PasskeyLoginChallenges.findOneBy({
			id: body.challengeId,
			challenge: challengeHash,
		});

		if (!userChallenge && !globalChallenge) {
			await fail(user.id, 403, {
				id: "2715a88a-2125-4013-932f-aa6fe72792da",
			});
			return;
		}

		await AttestationChallenges.delete({ userId: user.id, id: body.challengeId });
		await PasskeyLoginChallenges.delete({ id: body.challengeId });

		const createdAt = userChallenge?.createdAt ?? globalChallenge?.createdAt;
		if (!createdAt || new Date().getTime() - createdAt.getTime() >= 5 * 60 * 1000) {
			await fail(user.id, 403, {
				id: "2715a88a-2125-4013-932f-aa6fe72792da",
			});
			return;
		}

		const verificationResult = verifyLogin({
			publicKey: Buffer.from(securityKey.publicKey, "hex"),
			authenticatorData: Buffer.from(body.authenticatorData, "hex"),
			clientDataJSON,
			clientData,
			signature: Buffer.from(body.signature, "hex"),
			challenge: (userChallenge?.challenge ?? globalChallenge!.challenge),
			requireUserVerification: false,
		});

		if (!verificationResult.isValid) {
			await fail(user.id, 403, {
				id: "93b86c4b-72f9-40eb-9815-798928603d1e",
			});
			return;
		}

		if (securityKey.signCount > 0 && verificationResult.signCount <= securityKey.signCount) {
			await fail(user.id, 403, {
				id: "93b86c4b-72f9-40eb-9815-798928603d1e",
			});
			return;
		}

		securityKey.lastUsed = new Date();
		securityKey.signCount = verificationResult.signCount;
		await UserSecurityKeys.save(securityKey);

		signin(ctx, user);
		return;
	}

	if (typeof username !== "string") {
		ctx.status = 400;
		return;
	}

	if (typeof password !== "string") {
		ctx.status = 400;
		return;
	}

	if (token != null && typeof token !== "string") {
		ctx.status = 400;
		return;
	}

	const user = (await Users.findOneBy({
		usernameLower: username.toLowerCase(),
		host: IsNull(),
	})) as ILocalUser;

	if (user == null) {
		error(404, {
			id: "6cc579cc-885d-43d8-95c2-b8c7fc963280",
		});
		return;
	}

	if (user.isSuspended) {
		error(403, {
			id: "e03a5f46-d309-4865-9b69-56282d94e1eb",
		});
		return;
	}

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	const same = await comparePassword(password, profile.password!);

	if (same && isOldAlgorithm(profile.password!)) {
		profile.password = await hashPassword(password);
		await UserProfiles.save(profile);
	}

	if (!profile.twoFactorEnabled) {
		if (same) {
			signin(ctx, user);
			return;
		}

		await fail(user.id, 403, {
			id: "932c904e-9460-45b7-9ce6-7ed33be7eb2c",
		});
		return;
	}

	if (token) {
		if (!same) {
			await fail(user.id, 403, {
				id: "932c904e-9460-45b7-9ce6-7ed33be7eb2c",
			});
			return;
		}

		const verified = (speakeasy as any).totp.verify({
			secret: profile.twoFactorSecret,
			encoding: "base32",
			token,
			window: 2,
		});

		if (verified) {
			signin(ctx, user);
			return;
		}

		await fail(user.id, 403, {
			id: "cdf1235b-ac71-46d4-a3a6-84ccce48df6f",
		});
		return;
	}

	if (!(same || profile.usePasswordLessLogin)) {
		await fail(user.id, 403, {
			id: "932c904e-9460-45b7-9ce6-7ed33be7eb2c",
		});
		return;
	}

	const keys = await UserSecurityKeys.findBy({ userId: user.id });

	if (keys.length === 0) {
		await fail(user.id, 403, {
			id: "f27fd449-9af4-4841-9249-1f989b9fa4a4",
		});
		return;
	}

	const challenge = randomBytes(32)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	const challengeId = genId();

	await AttestationChallenges.insert({
		userId: user.id,
		id: challengeId,
		challenge: hash(Buffer.from(challenge, "utf-8")).toString("hex"),
		createdAt: new Date(),
		registrationChallenge: false,
	});

	ctx.body = {
		challenge,
		challengeId,
		securityKeys: keys.map((key) => ({
			id: key.id,
		})),
	};
	ctx.status = 200;
};
