import * as fs from "node:fs";
import * as net from "node:net";
import * as stream from "node:stream";
import * as util from "node:util";
import got, * as Got from "got";
import { httpAgent, httpsAgent, StatusError } from "./fetch.js";
import config from "@/config/index.js";
import chalk from "chalk";
import Logger from "@/services/logger.js";
import IPCIDR from "ip-cidr";
import PrivateIp from "private-ip";

const pipeline = util.promisify(stream.pipeline);
const blockedHostnames = new Set(["localhost", "localhost.localdomain"]);

export async function downloadUrl(url: string, path: string): Promise<void> {
	if (!isSafeUrl(url)) {
		throw new StatusError("Invalid URL", 400);
	}

	const logger = new Logger("download");

	logger.info(`Downloading ${chalk.cyan(url)} ...`);

	const timeout = 30 * 1000;
	const operationTimeout = 60 * 1000;
	const maxSize = config.maxFileSize || 262144000;
	const parsedUrl = new URL(url);

	const req = got
		.stream(url, {
			headers: {
				"User-Agent": config.userAgent,
				Host: parsedUrl.hostname,
			},
			timeout: {
				lookup: timeout,
				connect: timeout,
				secureConnect: timeout,
				socket: timeout, // read timeout
				response: timeout,
				send: timeout,
				request: operationTimeout, // whole operation timeout
			},
			agent: {
				http: httpAgent,
				https: httpsAgent,
			},
			http2: false, // default
			retry: {
				limit: 0,
			},
		})
		.on("redirect", (_res: Got.Response, opts: Got.NormalizedOptions) => {
			if (!isSafeUrl(opts.url.toString())) {
				logger.warn(`Blocked redirect URL: ${opts.url}`);
				req.destroy(new StatusError("Invalid URL", 400));
			}
		})
		.on("response", (res: Got.Response) => {
			if (
				(process.env.NODE_ENV === "production" ||
					process.env.NODE_ENV === "test") &&
				!config.proxy &&
				res.ip
			) {
				if (isPrivateIp(res.ip)) {
					logger.warn(`Blocked address: ${res.ip}`);
					req.destroy(new StatusError("Invalid URL", 400));
				}
			}

			const contentLength = res.headers["content-length"];
			if (contentLength != null) {
				const size = Number(contentLength);
				if (size > maxSize) {
					logger.warn(`maxSize exceeded (${size} > ${maxSize}) on response`);
					req.destroy();
				}
			}
		})
		.on("downloadProgress", (progress: Got.Progress) => {
			if (progress.transferred > maxSize) {
				logger.warn(
					`maxSize exceeded (${progress.transferred} > ${maxSize}) on downloadProgress`,
				);
				req.destroy();
			}
		});

	try {
		await pipeline(req, fs.createWriteStream(path));
	} catch (e) {
		if (e instanceof StatusError) {
			throw e;
		}

		if (e instanceof Got.HTTPError) {
			throw new StatusError(
				`${e.response.statusCode} ${e.response.statusMessage}`,
				e.response.statusCode,
				e.response.statusMessage,
			);
		} else if (e instanceof Got.RequestError && e.cause instanceof StatusError) {
			throw e.cause;
		} else {
			throw e;
		}
	}

	logger.succ(`Download finished: ${chalk.cyan(url)}`);
}

export function isPrivateIp(ip: string): boolean {
	for (const net of config.allowedPrivateNetworks || []) {
		const cidr = new IPCIDR(net);
		if (cidr.contains(ip)) {
			return false;
		}
	}

	return PrivateIp(ip);
}

export function isSafeUrl(url: string | URL): boolean {
	let parsedUrl: URL;
	try {
		parsedUrl = typeof url === "string" ? new URL(url) : url;
	} catch {
		return false;
	}

	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		return false;
	}

	const hostname = parsedUrl.hostname.replaceAll(/(\[)|(\])/g, "").toLowerCase();
	if (hostname.length === 0 || blockedHostnames.has(hostname)) {
		return false;
	}
	if (hostname.endsWith(".localhost")) {
		return false;
	}

	return !(net.isIP(hostname) && isPrivateIp(hostname));
}
