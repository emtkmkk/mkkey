import * as http from "node:http";
import * as https from "node:https";
import type { URL } from "node:url";
import CacheableLookup from "cacheable-lookup";
import fetch from "node-fetch";
import { HttpProxyAgent, HttpsProxyAgent } from "hpagent";
import config from "@/config/index.js";

export async function getJson(
	url: string,
	accept = "application/json, */*",
	timeout = 10000,
	headers?: Record<string, string>,
) {
	const res = await getResponse({
		url,
		method: "GET",
		headers: Object.assign(
			{
				"User-Agent": config.userAgent,
				Accept: accept,
			},
			headers || {},
		),
		timeout,
	});

	return await res.json();
}

export async function getHtml(
	url: string,
	accept = "text/html, */*",
	timeout = 10000,
	headers?: Record<string, string>,
) {
	const res = await getResponse({
		url,
		method: "GET",
		headers: Object.assign(
			{
				"User-Agent": config.userAgent,
				Accept: accept,
			},
			headers || {},
		),
		timeout,
	});

	return await res.text();
}

export async function getResponse(args: {
	url: string;
	method: string;
	body?: string;
	headers: Record<string, string>;
	timeout?: number;
	size?: number;
}) {
	const timeout = args.timeout || 10 * 1000;

	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, timeout * 6);
	const bearcaps = args.url.startsWith("bear:?")
		? parseBearcaps(args.url)
		: undefined;

	const baseHeaders = { ...(args.headers ?? {}) };
	const cookieHeaderKey = Object.keys(baseHeaders).find(
		(key) => key.toLowerCase() === "cookie",
	);
	const cookieJar = parseCookieHeaderValue(
		cookieHeaderKey ? baseHeaders[cookieHeaderKey] : undefined,
	);
	if (cookieHeaderKey) {
		delete baseHeaders[cookieHeaderKey];
	}

	let attempted429Retry = false;

	while (true) {
		const headers: Record<string, string> = {
			...baseHeaders,
			...(cookieJar.size > 0
				? { Cookie: serializeCookieJar(cookieJar) }
				: {}),
			...(bearcaps?.token ? { Authorization: `Bearer ${bearcaps.token}` } : {}),
		};

		const res = await fetch(bearcaps?.url ?? args.url, {
			method: args.method,
			headers,
			body: args.body,
			timeout,
			size: args.size || 10 * 1024 * 1024,
			agent: getAgentByUrl,
			signal: controller.signal,
		});

		if (res.ok) {
			return res;
		}

		const rawHeaders = (res.headers as unknown as {
			raw?: () => Record<string, string[]>;
		}).raw?.();
		const setCookieHeaders = rawHeaders?.["set-cookie"];
		const retryAfterHeader = res.headers.get("retry-after");
		const retryAfterSeconds =
			retryAfterHeader == null ? null : Number(retryAfterHeader);
		const canRetryImmediately =
			retryAfterSeconds != null &&
			!Number.isNaN(retryAfterSeconds) &&
			retryAfterSeconds <= 0;

		if (
			res.status === 429 &&
			!attempted429Retry &&
			canRetryImmediately &&
			setCookieHeaders &&
			setCookieHeaders.length > 0
		) {
			applySetCookieHeaders(cookieJar, setCookieHeaders);
			attempted429Retry = true;

			const body = res.body as unknown as {
				cancel?: () => Promise<void> | void;
				destroy?: () => void;
			} | null;

			try {
				if (body?.cancel) {
					await body.cancel();
				} else if (body?.destroy) {
					body.destroy();
				}
			} catch {
				// ignore cleanup errors
			}

			continue;
		}

		throw new StatusError(
			`${res.status} ${res.statusText}`,
			res.status,
			res.statusText,
		);
	}
}

const cache = new CacheableLookup({
	maxTtl: 3600, // 1hours
	errorTtl: 30, // 30secs
	lookup: false, // nativeのdns.lookupにfallbackしない
});

/**
 * Get http non-proxy agent
 */
const _http = new http.Agent({
	keepAlive: true,
	keepAliveMsecs: 30 * 1000,
	lookup: cache.lookup,
	localAddress: config.outgoingAddress,
} as http.AgentOptions);

/**
 * Get https non-proxy agent
 */
const _https = new https.Agent({
	keepAlive: true,
	keepAliveMsecs: 30 * 1000,
	lookup: cache.lookup,
	localAddress: config.outgoingAddress,
} as https.AgentOptions);

const maxSockets = Math.max(256, config.deliverJobConcurrency || 128);

/**
 * Get http proxy or non-proxy agent
 */
export const httpAgent = config.proxy
	? new HttpProxyAgent({
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			maxSockets,
			maxFreeSockets: 256,
			scheduling: "lifo",
			proxy: config.proxy,
			localAddress: config.outgoingAddress,
	  })
	: _http;

/**
 * Get https proxy or non-proxy agent
 */
export const httpsAgent = config.proxy
	? new HttpsProxyAgent({
			keepAlive: true,
			keepAliveMsecs: 30 * 1000,
			maxSockets,
			maxFreeSockets: 256,
			scheduling: "lifo",
			proxy: config.proxy,
			localAddress: config.outgoingAddress,
	  })
	: _https;

/**
 * Get agent by URL
 * @param url URL
 * @param bypassProxy Allways bypass proxy
 */
export function getAgentByUrl(url: URL, bypassProxy = false) {
	if (bypassProxy || (config.proxyBypassHosts || []).includes(url.hostname)) {
		return url.protocol === "http:" ? _http : _https;
	} else {
		return url.protocol === "http:" ? httpAgent : httpsAgent;
	}
}

// Bearcaps https://docs.joinmastodon.org/spec/bearcaps/
// bear:?t=<token>&u=https://example.com/foo'
// -> GET https://example.com/foo Authorization: Bearer <token>
function parseBearcaps(
	url: string,
): { url: string; token: string | undefined } | undefined {
	const params = new URLSearchParams(url.split("?")[1]);
	if (!params.has("u")) return undefined;

	return {
		url: params.get("u")!,
		token: params.get("t") ?? undefined,
	};
}

export class StatusError extends Error {
	public statusCode: number;
	public statusMessage?: string;
	public isClientError: boolean;
	public isRetryable: boolean;

	constructor(
		message: string,
		statusCode: number,
		statusMessage?: string,
		isRetryable?: boolean,
	) {
		super(message);
		this.name = "StatusError";
		this.statusCode = statusCode;
		this.statusMessage = statusMessage;
		this.isClientError =
			typeof this.statusCode === "number" &&
			this.statusCode >= 400 &&
			this.statusCode < 500;
		this.isRetryable =
			typeof isRetryable === "boolean"
				? isRetryable
				: !this.isClientError || this.statusCode === 429;
	}
}

function parseCookieHeaderValue(header: string | undefined): Map<string, string> {
	const jar = new Map<string, string>();

	if (!header) return jar;

	for (const part of header.split(";")) {
		const index = part.indexOf("=");
		if (index === -1) continue;
		const key = part.slice(0, index).trim();
		const value = part.slice(index + 1).trim();
		if (key) {
			jar.set(key, value);
		}
	}

	return jar;
}

function serializeCookieJar(jar: Map<string, string>): string {
	return Array.from(jar.entries())
		.map(([key, value]) => `${key}=${value}`)
		.join("; ");
}

function applySetCookieHeaders(jar: Map<string, string>, setCookieHeaders: string[]): void {
	for (const header of setCookieHeaders) {
		const cookie = header.split(";")[0];
		const index = cookie.indexOf("=");
		if (index === -1) continue;
		const key = cookie.slice(0, index).trim();
		const value = cookie.slice(index + 1).trim();
		if (key) {
			jar.set(key, value);
		}
	}
}
