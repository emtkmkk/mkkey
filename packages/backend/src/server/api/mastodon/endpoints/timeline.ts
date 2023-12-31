import Router from "@koa/router";
import megalodon, { Entity, MegalodonInterface } from "@calckey/megalodon";
import { getClient } from "../ApiMastodonCompatibleService.js";
import { statusModel } from "./status.js";
import Autolinker from "autolinker";
import { ParsedUrlQuery } from "querystring";
import { convertAccount, convertList, convertStatus } from "../converters.js";
import { convertId, IdType } from "../../index.js";

export function limitToInt(q: ParsedUrlQuery) {
	let object: any = q;
	if (q.limit)
		if (typeof q.limit === "string") object.limit = parseInt(q.limit, 10);
	if (q.offset)
		if (typeof q.offset === "string") object.offset = parseInt(q.offset, 10);
	return object;
}

export function argsToBools(q: ParsedUrlQuery) {
	// Values taken from https://docs.joinmastodon.org/client/intro/#boolean
	const toBoolean = (value: string) =>
		!["0", "f", "F", "false", "FALSE", "off", "OFF"].includes(value);

	let object: any = q;
	if (q.only_media)
		if (typeof q.only_media === "string")
			object.only_media = toBoolean(q.only_media);
	if (q.exclude_replies)
		if (typeof q.exclude_replies === "string")
			object.exclude_replies = toBoolean(q.exclude_replies);
	return q;
}

export function convertTimelinesArgsId(q: ParsedUrlQuery) {
	if (typeof q.min_id === "string")
		q.min_id = convertId(q.min_id, IdType.CalckeyId);
	if (typeof q.max_id === "string")
		q.max_id = convertId(q.max_id, IdType.CalckeyId);
	if (typeof q.since_id === "string")
		q.since_id = convertId(q.since_id, IdType.CalckeyId);
	return q;
}

export function toTextWithReaction(status: Entity.Status[], host: string) {
	return status.map((t) => {
		if (!t) return statusModel(null, null, [], "no content");
		t.quote = null as any;
		if (!t.emoji_reactions) return t;
		if (t.reblog) t.reblog = toTextWithReaction([t.reblog], host)[0];
		const reactions = t.emoji_reactions.map((r) => {
			const emojiNotation = r.url ? `:${r.name.replace("@.", "")}:` : r.name;
			return `${emojiNotation} (${r.count}${r.me ? `* ` : ""})`;
		});
		const reaction = t.emoji_reactions as Entity.Reaction[];
		const emoji = t.emojis || [];
		for (const r of reaction) {
			if (!r.url) continue;
			emoji.push({
				shortcode: r.name,
				url: r.url,
				static_url: r.url,
				visible_in_picker: true,
				category: "",
			});
		}
		const isMe = reaction.findIndex((r) => r.me) > -1;
		const total = reaction.reduce((sum, reaction) => sum + reaction.count, 0);
		t.favourited = isMe;
		t.favourites_count = total;
		t.emojis = emoji;
		t.content = `<p>${autoLinker(t.content, host)}</p><p>${reactions.join(
			", ",
		)}</p>`;
		return t;
	});
}
export function autoLinker(input: string, host: string) {
	return Autolinker.link(input, {
		hashtag: "twitter",
		mention: "twitter",
		email: false,
		stripPrefix: false,
		replaceFn: function (match) {
			switch (match.type) {
				case "url":
					return true;
				case "mention":
					console.log("Mention: ", match.getMention());
					console.log("Mention Service Name: ", match.getServiceName());
					return `<a href="https://${host}/@${encodeURIComponent(
						match.getMention(),
					)}" target="_blank">@${match.getMention()}</a>`;
				case "hashtag":
					console.log("Hashtag: ", match.getHashtag());
					return `<a href="https://${host}/tags/${encodeURIComponent(
						match.getHashtag(),
					)}" target="_blank">#${match.getHashtag()}</a>`;
			}
			return false;
		},
	});
}

export function apiTimelineMastodon(router: Router): void {
	router.get("/v1/timelines/public", async (ctx, reply) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const query: any = ctx.query;
			const data = query.local
				? await client.getLocalTimeline(
						convertTimelinesArgsId(argsToBools(limitToInt(query))),
				  )
				: await client.getPublicTimeline(
						convertTimelinesArgsId(argsToBools(limitToInt(query))),
				  );
			let resp = data.data.map((status) => convertStatus(status));
			ctx.body = toTextWithReaction(resp, ctx.hostname);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get<{ Params: { hashtag: string } }>(
		"/v1/timelines/tag/:hashtag",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getTagTimeline(
					ctx.params.hashtag,
					convertTimelinesArgsId(argsToBools(limitToInt(ctx.query))),
				);
				let resp = data.data.map((status) => convertStatus(status));
				ctx.body = toTextWithReaction(resp, ctx.hostname);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get("/v1/timelines/home", async (ctx, reply) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getHomeTimeline(
				convertTimelinesArgsId(limitToInt(ctx.query)),
			);
			let resp = data.data.map((status) => convertStatus(status));
			ctx.body = toTextWithReaction(resp, ctx.hostname);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get<{ Params: { listId: string } }>(
		"/v1/timelines/list/:listId",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getListTimeline(
					convertId(ctx.params.listId, IdType.CalckeyId),
					convertTimelinesArgsId(limitToInt(ctx.query)),
				);
				let resp = data.data.map((status) => convertStatus(status));
				ctx.body = toTextWithReaction(resp, ctx.hostname);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get("/v1/conversations", async (ctx, reply) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getConversationTimeline(
				convertTimelinesArgsId(limitToInt(ctx.query)),
			);
			ctx.body = data.data;
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get("/v1/lists", async (ctx, reply) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.getLists();
			ctx.body = data.data.map((list) => convertList(list));
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.get<{ Params: { id: string } }>(
		"/v1/lists/:id",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getList(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = convertList(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post("/v1/lists", async (ctx, reply) => {
		const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
		const accessTokens = ctx.headers.authorization;
		const client = getClient(BASE_URL, accessTokens);
		try {
			const data = await client.createList((ctx.request.body as any).title);
			ctx.body = convertList(data.data);
		} catch (e: any) {
			console.error(e);
			console.error(e.response.data);
			ctx.status = 401;
			ctx.body = e.response.data;
		}
	});
	router.put<{ Params: { id: string } }>(
		"/v1/lists/:id",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.updateList(
					convertId(ctx.params.id, IdType.CalckeyId),
					(ctx.request.body as any).title,
				);
				ctx.body = convertList(data.data);
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.delete<{ Params: { id: string } }>(
		"/v1/lists/:id",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.deleteList(
					convertId(ctx.params.id, IdType.CalckeyId),
				);
				ctx.body = data.data;
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.get<{ Params: { id: string } }>(
		"/v1/lists/:id/accounts",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.getAccountsInList(
					convertId(ctx.params.id, IdType.CalckeyId),
					convertTimelinesArgsId(ctx.query as any),
				);
				ctx.body = data.data.map((account) => convertAccount(account));
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.post<{ Params: { id: string } }>(
		"/v1/lists/:id/accounts",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.addAccountsToList(
					convertId(ctx.params.id, IdType.CalckeyId),
					(ctx.query.account_ids as string[]).map((id) =>
						convertId(id, IdType.CalckeyId),
					),
				);
				ctx.body = data.data;
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
	router.delete<{ Params: { id: string } }>(
		"/v1/lists/:id/accounts",
		async (ctx, reply) => {
			const BASE_URL = `${ctx.protocol}://${ctx.hostname}`;
			const accessTokens = ctx.headers.authorization;
			const client = getClient(BASE_URL, accessTokens);
			try {
				const data = await client.deleteAccountsFromList(
					convertId(ctx.params.id, IdType.CalckeyId),
					(ctx.query.account_ids as string[]).map((id) =>
						convertId(id, IdType.CalckeyId),
					),
				);
				ctx.body = data.data;
			} catch (e: any) {
				console.error(e);
				console.error(e.response.data);
				ctx.status = 401;
				ctx.body = e.response.data;
			}
		},
	);
}
function escapeHTML(str: string) {
	if (!str) {
		return "";
	}
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
function nl2br(str: string) {
	if (!str) {
		return "";
	}
	str = str.replace(/\r\n/g, "<br />");
	str = str.replace(/(\n|\r)/g, "<br />");
	return str;
}
