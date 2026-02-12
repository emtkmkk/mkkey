import type Koa from "koa";

import type { User } from "@/models/entities/user.js";
import { UserIps } from "@/models/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import type { IEndpoint } from "./endpoints.js";
import authenticate, { AuthenticationError } from "./authenticate.js";
import call from "./call.js";
import { ApiError } from "./error.js";
import { apiLogger } from "./logger.js";

const userIpHistories = new Map<User["id"], Set<string>>();

setInterval(() => {
	userIpHistories.clear();
}, 1000 * 60 * 60);

export default (endpoint: IEndpoint, ctx: Koa.Context) =>
	new Promise<void>((res) => {
		const requestContext = {
			ep: endpoint.name,
			ip: ctx.ip,
			method: ctx.method,
		};

		const toErrorInfo = (e: unknown) => {
			if (e instanceof Error) {
				return {
					message: e.message,
					code: e.name,
					stack: e.stack,
				};
			}

			return {
				message: "Unknown error",
				code: "UnknownError",
				raw: e,
			};
		};

		const body = ctx.is("multipart/form-data")
			? (ctx.request as any).body
			: ctx.method === "GET"
			? ctx.query
			: ctx.request.body;

		const reply = (x?: any, y?: ApiError) => {
			if (x == null) {
				ctx.status = 204;
			} else if (typeof x === "number" && y) {
				ctx.status = x;
				ctx.body = {
					error: {
						message: y!.message,
						code: y!.code,
						id: y!.id,
						kind: y!.kind,
						...(y!.info ? { info: y!.info } : {}),
					},
				};
			} else {
				// 文字列を返す場合は、JSON.stringify通さないとJSONと認識されない
				ctx.body = typeof x === "string" ? JSON.stringify(x) : x;
			}
			res();
		};

		// Authentication
		// for GET requests, do not even pass on the body parameter as it is considered unsafe
		authenticate(
			ctx.headers.authorization,
			ctx.method === "GET" ? null : body["i"],
		)
			.then(([user, app]) => {
				// API invoking
				call(endpoint.name, user, app, body, ctx)
					.then((res: any) => {
						if (
							ctx.method === "GET" &&
							endpoint.meta.cacheSec &&
							!body["i"] &&
							!user
						) {
							ctx.set(
								"Cache-Control",
								`public, max-age=${endpoint.meta.cacheSec}`,
							);
						}
						reply(res);
					})
					.catch((e: unknown) => {
						const errorInfo = toErrorInfo(e);
						apiLogger.error("API request failed.", {
							...requestContext,
							error: errorInfo,
						});

						if (e instanceof ApiError) {
							reply(
								e.httpStatusCode
									? e.httpStatusCode
									: e.kind === "client"
									? 400
									: 500,
								e,
							);
							return;
						}

						reply(
							500,
							new ApiError(null, {
								e: errorInfo,
							}),
						);
					});

				// Log IP
				if (user) {
					fetchMeta().then((meta) => {
						if (!meta.enableIpLogging) return;
						const ip = ctx.ip;
						const ips = userIpHistories.get(user.id);
						if (ips == null || !ips.has(ip)) {
							if (ips == null) {
								userIpHistories.set(user.id, new Set([ip]));
							} else {
								ips.add(ip);
							}

							try {
								UserIps.createQueryBuilder()
									.insert()
									.values({
										createdAt: new Date(),
										userId: user.id,
										ip: ip,
									})
									.orIgnore(true)
									.execute();
							} catch {}
						}
					});
				}
			})
			.catch((e) => {
				if (e instanceof AuthenticationError) {
					ctx.response.status = 403;
					ctx.response.set("WWW-Authenticate", "Bearer");
					ctx.response.body = {
						message: `Authentication failed: ${e.message}`,
						code: "AUTHENTICATION_FAILED",
						id: "b0a7f5f8-dc2f-4171-b91f-de88ad238e14",
						kind: "client",
					};
					res();
				} else {
					const errorInfo = toErrorInfo(e);
					apiLogger.error("Unexpected authentication flow error.", {
						...requestContext,
						error: errorInfo,
					});
					reply(500, new ApiError(null, { e: errorInfo }));
				}
			});
	});
