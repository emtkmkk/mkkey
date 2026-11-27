import type Koa from "koa";
import signin from "../common/signin.js";
import { verifyTotpOnce } from "@/misc/verify-totp-once.js";
import config from "@/config/index.js";
import { Users, Signins, UserProfiles } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import type { Signin } from "@/models/entities/signin.js";
import { genId } from "@/misc/gen-id.js";
import {
	comparePassword,
	hashPassword,
	isOldAlgorithm,
} from "@/misc/password.js";
import {
	findSecurityKeyForAssertion,
	isSecurityKeyAssertion,
	issueSecurityKeyChallenge,
	verifySecurityKeyAssertion,
} from "../common/security-key-assertion.js";
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
			// TypeORM の insert 引数型は Record<string, any> 列に IncomingHttpHeaders を直接渡せないので、
			// 列の型で一度受けてから渡す（値はそのまま）
			const headers: Signin["headers"] = ctx.headers;
			await Signins.insert({
				id: genId(),
				createdAt: new Date(),
				userId,
				ip: ctx.ip,
				headers,
				success: false,
			});
		}

		error(
			status || 500,
			failure || { id: "4e30e80c-e338-45a0-8c8f-44455efa3b76" },
		);
	}

	// セキュリティキーで答えるログイン（確かめる処理は common/security-key-assertion.ts と共通）
	if (isSecurityKeyAssertion(body)) {
		const securityKey = await findSecurityKeyForAssertion(body);

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

		if (user.isUsagePaused) {
			await fail(securityKey.userId, 403, {
				id: "c9a4e2b1-7f3d-4a2e-9e1c-0d5b8a4e6f2a",
			});
			return;
		}

		// 削除はソフト削除で user_profile（パスワード）が残るため、明示的に閉じる
		if (user.isDeleted) {
			await fail(securityKey.userId, 403, {
				id: "b8f1a6c2-3d47-4e59-9a0b-2c7e5d4f8a13",
			});
			return;
		}

		const failure = await verifySecurityKeyAssertion(securityKey, body, user.id);
		if (failure) {
			await fail(user.id, failure.status, { id: failure.id });
			return;
		}

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

	if (user.isUsagePaused) {
		error(403, {
			id: "c9a4e2b1-7f3d-4a2e-9e1c-0d5b8a4e6f2a",
		});
		return;
	}

	// 削除はソフト削除で user_profile（パスワード）が残るため、明示的に閉じる
	if (user.isDeleted) {
		error(403, {
			id: "b8f1a6c2-3d47-4e59-9a0b-2c7e5d4f8a13",
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

		if (!profile.usePasswordLessLogin) {
			await fail(user.id, 403, {
				id: "932c904e-9460-45b7-9ce6-7ed33be7eb2c",
			});
			return;
		}
	}

	if (profile.twoFactorEnabled && token) {
		if (!same) {
			await fail(user.id, 403, {
				id: "932c904e-9460-45b7-9ce6-7ed33be7eb2c",
			});
			return;
		}

		// 一度使ったコードは通さない（verifyTotpOnce の説明を参照）。
		// 秘密鍵が無い状態は 2 段階認証が壊れているので、コードの確認に進まず失敗にする
		const verified =
			profile.twoFactorSecret != null &&
			(await verifyTotpOnce(user.id, profile.twoFactorSecret, token));

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

	const issued = await issueSecurityKeyChallenge(user.id);

	if (issued == null) {
		await fail(user.id, 403, {
			id: "f27fd449-9af4-4841-9249-1f989b9fa4a4",
		});
		return;
	}

	ctx.body = issued;
	ctx.status = 200;
};
