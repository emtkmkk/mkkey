/**
 * Web Client Server
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import Koa from "koa";
import Router from "@koa/router";
import send from "koa-send";
import favicon from "koa-favicon";
import views from "koa-views";
import sharp from "sharp";
import { createBullBoard } from "@bull-board/api";
import { BullAdapter } from "@bull-board/api/bullAdapter.js";
import { KoaAdapter } from "@bull-board/koa";

import { In, IsNull, Not, MoreThan } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import config from "@/config/index.js";
import {
	Users,
	Notes,
	Emojis,
	UserProfiles,
	Pages,
	Channels,
	Clips,
	GalleryPosts,
} from "@/models/index.js";
import * as Acct from "@/misc/acct.js";
import { getNoteSummary } from "@/misc/get-note-summary.js";
import { queues } from "@/queue/queues.js";
import { genOpenapiSpec } from "../api/openapi/gen-spec.js";
import { urlPreviewHandler } from "./url-preview.js";
import { manifestHandler } from "./manifest.js";
import packFeed from "./feed.js";
import { MINUTE, DAY } from "@/const.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const staticAssets = `${_dirname}/../../../assets/`;
const clientAssets = `${_dirname}/../../../../client/assets/`;
const assets = `${_dirname}/../../../../../built/_client_dist_/`;
const swAssets = `${_dirname}/../../../../../built/_sw_dist_/`;

// Init app
const app = new Koa();

//#region Bull Dashboard
const bullBoardPath = "/queue";

// Authenticate
app.use(async (ctx, next) => {
	if (ctx.path === bullBoardPath || ctx.path.startsWith(`${bullBoardPath}/`)) {
		const token = ctx.cookies.get("token");
		if (token == null) {
			ctx.status = 401;
			return;
		}
		const user = await Users.findOneBy({ token });
		if (user == null || !(user.isAdmin || user.isModerator)) {
			ctx.status = 403;
			return;
		}
	}
	await next();
});

const serverAdapter = new KoaAdapter();

createBullBoard({
	queues: queues.map((q) => new BullAdapter(q)),
	serverAdapter,
});

serverAdapter.setBasePath(bullBoardPath);
app.use(serverAdapter.registerPlugin());
//#endregion

// Init renderer
app.use(
	views(`${_dirname}/views`, {
		extension: "pug",
		options: {
			version: config.version,
			getClientEntry: () =>
				process.env.NODE_ENV === "production"
					? config.clientEntry
					: JSON.parse(
						readFileSync(
							`${_dirname}/../../../../../built/_client_dist_/manifest.json`,
							"utf-8",
						),
					)["src/init.ts"],
			config,
		},
	}),
);

// Serve favicon
app.use(favicon(`${_dirname}/../../../assets/favicon.ico`));

// Common request handler
app.use(async (ctx, next) => {
	// IFrameの中に入れられないようにする
	ctx.set("X-Frame-Options", "DENY");
	await next();
});

// Init router
const router = new Router();

//#region static assets

router.get("/static-assets/(.*)", async (ctx) => {
	await send(ctx as any, ctx.path.replace("/static-assets/", ""), {
		root: staticAssets,
		maxage: 7 * DAY,
	});
});

router.get("/client-assets/(.*)", async (ctx) => {
	await send(ctx as any, ctx.path.replace("/client-assets/", ""), {
		root: clientAssets,
		maxage: 7 * DAY,
	});
});

router.get("/assets/(.*)", async (ctx) => {
	await send(ctx as any, ctx.path.replace("/assets/", ""), {
		root: assets,
		maxage: 7 * DAY,
	});
});

// Apple touch icon
router.get("/apple-touch-icon.png", async (ctx) => {
	await send(ctx as any, "/apple-touch-icon.png", {
		root: staticAssets,
	});
});

router.get("/twemoji/(.*)", async (ctx) => {
	const path = ctx.path.replace("/twemoji/", "");

	if (!path.match(/^[0-9a-f-]+\.svg$/)) {
		ctx.status = 404;
		return;
	}

	ctx.set(
		"Content-Security-Policy",
		"default-src 'none'; style-src 'unsafe-inline'",
	);

	await send(ctx as any, path, {
		root: `${_dirname}/../../../node_modules/@discordapp/twemoji/dist/svg/`,
		maxage: 30 * DAY,
	});
});

router.get("/twemoji-badge/(.*)", async (ctx) => {
	const path = ctx.path.replace("/twemoji-badge/", "");

	if (!path.match(/^[0-9a-f-]+\.png$/)) {
		ctx.status = 404;
		return;
	}

	const mask = await sharp(
		`${_dirname}/../../../node_modules/@discordapp/twemoji/dist/svg/${path.replace(
			".png",
			"",
		)}.svg`,
		{ density: 1000 },
	)
		.resize(488, 488)
		.greyscale()
		.normalise()
		.linear(1.75, -(128 * 1.75) + 128) // 1.75x contrast
		.flatten({ background: "#000" })
		.extend({
			top: 12,
			bottom: 12,
			left: 12,
			right: 12,
			background: "#000",
		})
		.toColorspace("b-w")
		.png()
		.toBuffer();

	const buffer = await sharp({
		create: {
			width: 512,
			height: 512,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.pipelineColorspace("b-w")
		.boolean(mask, "eor")
		.resize(96, 96)
		.png()
		.toBuffer();

	ctx.set(
		"Content-Security-Policy",
		"default-src 'none'; style-src 'unsafe-inline'",
	);
	ctx.set("Cache-Control", "max-age=2592000");
	ctx.set("Content-Type", "image/png");
	ctx.body = buffer;
});

// ServiceWorker
router.get("/sw.js", async (ctx) => {
	await send(ctx as any, "/sw.js", {
		root: swAssets,
		maxage: 10 * MINUTE,
	});
});

// Manifest
router.get("/manifest.json", manifestHandler);

router.get("/robots.txt", async (ctx) => {
	await send(ctx as any, "/robots.txt", {
		root: staticAssets,
	});
});

//#endregion

// Docs
router.get("/api-doc", async (ctx) => {
	await send(ctx as any, "/redoc.html", {
		root: staticAssets,
	});
});

// URL preview endpoint
router.get("/url", urlPreviewHandler);

router.get("/api.json", async (ctx) => {
	ctx.body = genOpenapiSpec();
});

const getFeed = async (acct: string) => {
	const meta = await fetchMeta();
	if (meta.privateMode) {
		return;
	}
	const { username, host } = Acct.parse(acct);
	const user = await Users.findOneBy({
		usernameLower: username.toLowerCase(),
		host: host ?? IsNull(),
		isSuspended: false,
	});

	return user && (await packFeed(user));
};

// As the /@user[.json|.rss|.atom]/sub endpoint is complicated, we will use a regex to switch between them.
const reUser = new RegExp(
	"^/@(?<user>[^/]+?)(?:.(?<feed>json|rss|atom))?(?:/(?<sub>[^/]+))?$",
);
router.get(reUser, async (ctx, next) => {
	const groups = reUser.exec(ctx.originalUrl)?.groups;
	if (!groups) {
		await next();
		return;
	}

	ctx.params = groups;

	console.log(ctx, ctx.params);
	if (groups.feed) {
		if (groups.sub) {
			await next();
			return;
		}

		switch (groups.feed) {
			case "json":
				await jsonFeed(ctx, next);
				break;
			case "rss":
				await rssFeed(ctx, next);
				break;
			case "atom":
				await atomFeed(ctx, next);
				break;
		}
		return;
	}

	await userPage(ctx, next);
});

// Atom
const atomFeed: Router.Middleware = async (ctx) => {
	const feed = await getFeed(ctx.params.user);

	if (feed) {
		ctx.set("Content-Type", "application/atom+xml; charset=utf-8");
		ctx.body = feed.atom1();
	} else {
		ctx.status = 404;
	}
};

// RSS
const rssFeed: Router.Middleware = async (ctx) => {
	const feed = await getFeed(ctx.params.user);

	if (feed) {
		ctx.set("Content-Type", "application/rss+xml; charset=utf-8");
		ctx.body = feed.rss2();
	} else {
		ctx.status = 404;
	}
};

// JSON
const jsonFeed: Router.Middleware = async (ctx) => {
	const feed = await getFeed(ctx.params.user);

	if (feed) {
		ctx.set("Content-Type", "application/json; charset=utf-8");
		ctx.body = feed.json1();
	} else {
		ctx.status = 404;
	}
};

router.get("/emoji/:path(.*)", async (ctx) => {

	ctx.set('Cache-Control', 'public, max-age=86400');

	if (!ctx.params.path.match(/^[a-zA-Z0-9\-_@\.]+?\.webp$/)) {
		ctx.status = 404;
		return;
	}

	const name = ctx.params.path.split('@')[0].replace('.webp', '');
	const host = ctx.params.path.split('@')[1]?.replace('.webp', '');

	const emoji = await Emojis.findOneBy({
		// `@.` is the spec of ReactionService.decodeReaction
		host: (host == null || host === '.') ? IsNull() : host,
		name: name,
	});

	ctx.set('Content-Security-Policy', 'default-src \'none\'; style-src \'unsafe-inline\'');

	if (emoji == null) {
		if ('fallback' in ctx.query) {
			return await ctx.redirect('/static-assets/user-unknown.png');
		} else {
			ctx.status = 404;
			return;
		}
	}

	let proxy;
	let url: URL;
	// TODO : プロキシをサイズが大きすぎる物のみに使用するようにしたい
	if (!config?.mediaProxy) {
		proxy = `${config.url}/proxy`;
	} else {
		proxy = `${config.mediaProxy}`;
	}

	if ('badge' in ctx.query) {
		url = new URL(`${proxy}/emoji.png`);
		// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
		url.searchParams.set('url', emoji.publicUrl || emoji.originalUrl);
		url.searchParams.set('badge', '1');
	} else {
		url = new URL(`${proxy}/emoji.webp`);
		// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
		url.searchParams.set('url', emoji.publicUrl || emoji.originalUrl);
		url.searchParams.set('emoji', '1');
		if ('static' in ctx.query) url.searchParams.set('static', '1');
	}
	ctx.status = 301;
	ctx.redirect(url.toString());

});

router.get("/emoji_license/:path(.*)", async (ctx) => {

	if (!ctx.params.path.match(/^[a-zA-Z0-9\-_@\.]+?$/)) {
		ctx.status = 404;
		return;
	}

	const name = ctx.params.path.split('@')[0];
	const host = ctx.params.path.split('@')?.[1]?.replace(/\.json$/,"");

	const emoji = await Emojis.findOneBy({
		// `@.` is the spec of ReactionService.decodeReaction
		host: (host == null || host === '.') ? IsNull() : host,
		name: name,
	});

	if (emoji) {
		ctx.set("Content-Type", "application/json; charset=utf-8");
		ctx.set("Cache-Control", "public, max-age=15");
		if (!emoji.host && emoji.license === "文字だけ") {
			ctx.body = JSON.stringify({
				copyPermission: "allow",
				license: "CC0 1.0 Universal",
				author: config.host
			});
		} else {
			ctx.body = JSON.stringify({
				copyPermission: emoji.license?.includes("コピー可否 : ") ? /コピー可否 : (\w+)(,|$)/.exec(emoji.license)?.[1] ?? "none" : "none",
				license: emoji.license?.includes("ライセンス : ") ? /ライセンス : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? null : null,
				usageInfo: emoji.license?.includes("使用情報 : ") ? /使用情報 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
				author: emoji.license?.includes("作者 : ") ? /作者 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
				description: emoji.license?.includes("説明 : ") ? /説明 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
				isBasedOnUrl: emoji.license?.includes("コピー元 : ") ? /コピー元 : ([^,:]+)(,|$)/.exec(emoji.license)?.[1] ?? undefined : undefined,
			});
		}
	} else {
		ctx.status = 404;
	}
});

//#region SSR (for crawlers)
// User
const userPage: Router.Middleware = async (ctx, next) => {
	const userParam = ctx.params.user;
	const subParam = ctx.params.sub;
	const { username, host } = Acct.parse(userParam);

	const user = await Users.findOneBy({
		usernameLower: username.toLowerCase(),
		host: host ?? IsNull(),
		isSuspended: false,
	});

	if (user === null) {
		await next();
		return;
	}

	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	const meta = await fetchMeta();
	const me = profile.fields
		? profile.fields
			.filter((filed) => filed.value?.match(/^https?:/))
			.map((field) => field.value)
		: [];

	const userDetail = {
		user,
		profile,
		me,
		avatarUrl: await Users.getAvatarUrl(user),
		sub: subParam,
		instanceName: meta.name || "Calckey",
		icon: meta.iconUrl,
		themeColor: meta.themeColor,
		privateMode: meta.privateMode,
	};

	await ctx.render("user", userDetail);
	ctx.set("Cache-Control", "public, max-age=15");
};

router.get("/users/:user", async (ctx) => {
	const user = await Users.findOneBy({
		id: ctx.params.user,
		host: IsNull(),
		isSuspended: false,
	});

	if (user == null) {
		ctx.status = 404;
		return;
	}

	ctx.redirect(`/@${user.username}${user.host == null ? "" : `@${user.host}`}`);
});

// Note
router.get("/notes/:note", async (ctx, next) => {
	const note = await Notes.findOneBy({
		id: ctx.params.note,
	});

	try {
		if (note) {

			const user = await Users.findOneByOrFail({
				id: note.userId,
			});

			const _note = ["public", "home"].includes(note.visibility) && !note.localOnly ? await Notes.pack(note) : { id: note.id, user: user, fileIds: [], files: [] };

			const profile = await UserProfiles.findOneByOrFail({
				userId: note.userId,
			});
			const meta = await fetchMeta();
			const userName = user.name.replace(/ ?:.*?:/, '').trim() ? `${user.name.replace(/ ?:.*?:/, '')}${user.host ? `@${user.host}` : ''}` : `@${user.username}${user.host ? `@${user.host}` : ''}`;
			let summary = "";
			if (!["public", "home"].includes(note.visibility) || note.localOnly) {
				summary = `${note.visibility === "followers" ? (userName + "さんのフォロワー限定の投稿") : "公開範囲が限定されている投稿"}なのでプレビューを表示できません。\nリンクをクリックすると投稿ページへ移動します。`
			} else {
				summary = getNoteSummary(_note);
			}
			await ctx.render("note", {
				note: _note,
				profile,
				avatarUrl: await Users.getAvatarUrl(user),
				// TODO: Let locale changeable by instance setting
				summary,
				userName,
				instanceName: meta.name || "Calckey",
				icon: meta.iconUrl,
				privateMode: meta.privateMode,
				themeColor: meta.themeColor,
			});

			ctx.set("Cache-Control", "public, max-age=15");

			return;
		}
	} catch { }

	await next();
});

router.get("/posts/:note", async (ctx, next) => {
	const note = await Notes.findOneBy({
		id: ctx.params.note,
	});

	if (note) {

		const user = await Users.findOneByOrFail({
			id: note.userId,
		});

		const _note = ["public", "home"].includes(note.visibility) && !note.localOnly ? await Notes.pack(note) : { id: note.id, user: user, fileIds: [], files: [] };

		const profile = await UserProfiles.findOneByOrFail({
			userId: note.userId,
		});
		const meta = await fetchMeta();
		const userName = user.name ? `${user.name.replace(/ ?:.*?:/, '')}${user.host ? `@${user.host}` : ''}` : `@${user.username}${user.host ? `@${user.host}` : ''}`;
		let summary = "";
		if (!["public", "home"].includes(note.visibility) || note.localOnly) {
			summary = `${note.visibility === "followers" ? (userName + "さんのフォロワー限定の投稿") : "公開範囲が限定されている投稿"}なのでプレビューを表示できません。\nリンクをクリックすると投稿ページへ移動します。`
		} else {
			summary = getNoteSummary(_note);
		}
		await ctx.render("note", {
			note: _note,
			profile,
			avatarUrl: await Users.getAvatarUrl(user),
			// TODO: Let locale changeable by instance setting
			summary,
			userName,
			instanceName: meta.name || "Calckey",
			icon: meta.iconUrl,
			privateMode: meta.privateMode,
			themeColor: meta.themeColor,
		});

		ctx.set("Cache-Control", "public, max-age=15");

		return;
	}

	await next();
});

// Page
router.get("/@:user/pages/:page", async (ctx, next) => {
	const { username, host } = Acct.parse(ctx.params.user);
	const user = await Users.findOneBy({
		usernameLower: username.toLowerCase(),
		host: host ?? IsNull(),
	});

	if (user == null) return;

	const page = await Pages.findOneBy({
		name: ctx.params.page,
		userId: user.id,
	});

	if (page) {
		const _page = await Pages.pack(page);
		const profile = await UserProfiles.findOneByOrFail({ userId: page.userId });
		const meta = await fetchMeta();
		await ctx.render("page", {
			page: _page,
			profile,
			avatarUrl: await Users.getAvatarUrl(
				await Users.findOneByOrFail({ id: page.userId }),
			),
			instanceName: meta.name || "Calckey",
			icon: meta.iconUrl,
			themeColor: meta.themeColor,
			privateMode: meta.privateMode,
		});

		if (["public"].includes(page.visibility)) {
			ctx.set("Cache-Control", "public, max-age=15");
		} else {
			ctx.set("Cache-Control", "private, max-age=0, must-revalidate");
		}

		return;
	}

	await next();
});

// Clip
// TODO: handling of private clips
router.get("/clips/:clip", async (ctx, next) => {
	const clip = await Clips.findOneBy({
		id: ctx.params.clip,
	});

	if (clip) {
		const _clip = await Clips.pack(clip);
		const profile = await UserProfiles.findOneByOrFail({ userId: clip.userId });
		const meta = await fetchMeta();
		await ctx.render("clip", {
			clip: _clip,
			profile,
			avatarUrl: await Users.getAvatarUrl(
				await Users.findOneByOrFail({ id: clip.userId }),
			),
			instanceName: meta.name || "Calckey",
			privateMode: meta.privateMode,
			icon: meta.iconUrl,
			themeColor: meta.themeColor,
		});

		ctx.set("Cache-Control", "public, max-age=15");

		return;
	}

	await next();
});

// Gallery post
router.get("/gallery/:post", async (ctx, next) => {
	const post = await GalleryPosts.findOneBy({ id: ctx.params.post });

	if (post) {
		const _post = await GalleryPosts.pack(post);
		const profile = await UserProfiles.findOneByOrFail({ userId: post.userId });
		const meta = await fetchMeta();
		await ctx.render("gallery-post", {
			post: _post,
			profile,
			avatarUrl: await Users.getAvatarUrl(
				await Users.findOneByOrFail({ id: post.userId }),
			),
			instanceName: meta.name || "Calckey",
			icon: meta.iconUrl,
			themeColor: meta.themeColor,
			privateMode: meta.privateMode,
		});

		ctx.set("Cache-Control", "public, max-age=15");

		return;
	}

	await next();
});

// Channel
router.get("/channels/:channel", async (ctx, next) => {
	const channel = await Channels.findOneBy({
		id: ctx.params.channel,
	});

	if (channel) {
		const _channel = await Channels.pack(channel);
		const meta = await fetchMeta();
		await ctx.render("channel", {
			channel: _channel,
			instanceName: meta.name || "Calckey",
			icon: meta.iconUrl,
			themeColor: meta.themeColor,
			privateMode: meta.privateMode,
		});

		ctx.set("Cache-Control", "public, max-age=15");

		return;
	}

	await next();
});
//#endregion

router.get("/_info_card_", async (ctx) => {
	const meta = await fetchMeta(true);
	if (meta.privateMode) {
		ctx.status = 403;
		return;
	}

	ctx.remove("X-Frame-Options");

	await ctx.render("info-card", {
		version: config.version,
		host: config.host,
		meta: meta,
		originalUsersCount: await Users.count({ where: { host: IsNull() }, cache: 3600000 }), //1h
		originalNotesCount: await Notes.count({ where: { userHost: IsNull() }, cache: 3600000 }), //1h
	});
});

router.get("/bios", async (ctx) => {
	await ctx.render("bios", {
		version: config.version,
	});
});

router.get("/cli", async (ctx) => {
	await ctx.render("cli", {
		version: config.version,
	});
});

router.get("/sc", async (ctx) => {
	await ctx.render("sc", {
		version: config.version,
	});
});

const override = (source: string, target: string, depth = 0) =>
	[
		undefined,
		...target.split("/").filter((x) => x),
		...source
			.split("/")
			.filter((x) => x)
			.splice(depth),
	].join("/");

router.get("/flush", async (ctx) => {
	await ctx.render("flush");
});

// If a non-WebSocket request comes in to streaming and base html is returned with cache, the path will be cached by Proxy, etc. and it will be wrong.
router.get("/streaming", async (ctx) => {
	ctx.status = 503;
	ctx.set("Cache-Control", "private, max-age=0");
});
router.get("/api/v1/streaming", async (ctx) => {
	ctx.status = 503;
	ctx.set("Cache-Control", "private, max-age=0");
});

// Render base html for all requests
router.get("(.*)", async (ctx) => {
	const meta = await fetchMeta();
	let usersCount = await Users.count({ where: { host: IsNull(), notesCount: MoreThan(50) }, cache: 21600000 }); //6h
	let notesCount = await Notes.count({ where: { userHost: IsNull() }, cache: 21600000 }); //6h
	let gUsersCount = await Users.count({ where: { host: Not(IsNull()) }, cache: 21600000 }); //6h
	let gNotesCount = await Notes.count({ where: { userHost: Not(IsNull()) }, cache: 21600000 }); //6h
	let emojisCount = await Emojis.count({ where: { host: IsNull() }, cache: 21600000 }); //6h
	let gEmojisCount = await Emojis.count({ where: { host: Not(IsNull()) }, cache: 21600000 }); //6h
	let motd = [];
	let motdd = []; //日付のmotd
	let motdt = []; //統計のmotd
	if (meta.customMOTD.length > 0) {
		motdt = meta.customMOTD;
	}
	const now = new Date();
	let nowDate = new Date().toLocaleDateString('ja-JP');
	motdd.push("今日は " + nowDate + " です");
	switch (now.getDay()) {
		case 0:
			motdd.push("今日は日曜日 すやすや");
			break;
		case 1:
			motdd.push("今日は月曜日 一週間のはじまり");
			break;
		case 2:
			motdd.push("今日は火曜日 エンジンかけてこ");
			break;
		case 3:
			motdd.push("今日は水曜日 すいすい");
			break;
		case 4:
			motdd.push("今日は木曜日 もくもく");
			break;
		case 5:
			motdd.push("今日は金曜日 今週もお疲れ様");
			break;
		case 6:
			motdd.push("今日は土曜日 一休みしよね");
			break;
	}
	if (now.getDate() < 5) {
		motdd.push("月初ですね 今月もぼちぼち行きましょう");
	}
	if (now.getDate() > 12 && now.getDate() < 18) {
		motdd.push("月の真ん中くらいですね");
	}
	if (now.getDate() > 24) {
		motdd.push("月末ですね 今月もお疲れ様");
	}
	const yearFirstDay = new Date(now.getFullYear(), 0);
	const yearNextFirstDay = new Date(now.getFullYear() + 1, 0);
	const nowDaysCnt = Math.floor((now.valueOf() - yearFirstDay.valueOf()) / (24 * 60 * 60 * 1000));
	const yearDaysCnt = Math.floor((yearNextFirstDay.valueOf() - yearFirstDay.valueOf()) / (24 * 60 * 60 * 1000));
	motdd.push(now.getFullYear() + "年 進行度 " + nowDaysCnt + " / " + yearDaysCnt + " ( " + (nowDaysCnt / yearDaysCnt * 100).toFixed(1) + "% ) です");
	motdt.push("もこきーのユーザ数は " + usersCount + " です");
	motdt.push("もこきーの合計投稿数は " + notesCount + " です");
	motdt.push("もこきーの連合ユーザ数は " + gUsersCount + " です");
	motdt.push("もこきーの連合投稿数は " + gNotesCount + " です");
	motdt.push("もこきーの絵文字数は " + emojisCount + " です");
	//motdt.push("もこきーの全絵文字数は " + (emojisCount + gEmojisCount) + " です");
	//季節メッセージ
	if (now.getMonth() === 0) {
		motd.push("冬ですね");
		if (now.getDate() == 1) {
			motd = ["HAPPY NEW YEAR " + now.getFullYear() + " 🎉", "あけましておめでとうございます！"];
			motdd = [];
			motdt = [];
		} else if (now.getDate() <= 3) {
			motd.push("HAPPY NEW YEAR " + now.getFullYear() + " 🎉");
			motd.push("あけましておめでとうございます！")
		}
	} else if (now.getMonth() == 1) {
		motd.push("冬終盤ですね");
		if (now.getDate() == 3) {
			motd.push("鬼は外～");
			motd.push("福は内～");
		} else if (now.getDate() == 14) {
			motd.push("今日はバレンタインです");
		} else if (now.getDate() > 15) {
			motd.push("確定申告、終わりましたか？");
		}
	} else if (now.getMonth() == 2) {
		motd.push("春が始まりますね");
		if (now.getDate() == 3) {
			motd.push("明かりをつけましょぼんぼりに");
		} else if (now.getDate() == 14) {
			motd.push("今日はホワイトデーです");
		} else if (now.getDate() == 29) {
			motd.push("今日は閏日ですね");
		}
		if (now.getDate() <= 10) {
			motd.push("確定申告、終わりましたか？");
		}
		if (now.getDate() >= 18 && now.getDate() <= 22) {
			motd.push("大体このへんで昼と夜の長さが同じぐらいになるらしい");
		}
	} else if (now.getMonth() == 3) {
		motd.push("春ですね");
		if (now.getDate() == 1) {
			motd.push("今日は嘘つきのボーナスタイムらしいです");
		}
	} else if (now.getMonth() == 4) {
		motd.push("春ももうすぐ終わりですね");
		if (now.getDate() == 5) {
			motd.push("屋根より高い🎏");
		}
	} else if (now.getMonth() == 5) {
		motd.push("梅雨の季節ですね");
		if (now.getDate() == 6) {
			motd.push("UFOがあっちいってこっちいって落っこちる日");
		} else if (now.getDate() >= 19 && now.getDate() <= 23) {
			motd.push("大体このへんで昼が最も長いらしい");
		}
	} else if (now.getMonth() == 6) {
		motd.push("夏ですね");
		if (now.getDate() == 7) {
			motd.push("七夕ですね 今日は晴れてますか？");
		} else if (now.getDate() > 20) {
			motd.push("うなぎを食べる時期です");
		}
	} else if (now.getMonth() == 7) {
		motd.push("本格的に夏ですね");
		if (now.getDate() >= 11 && now.getDate() <= 15) {
			motd.push("阿波踊りの季節です");
		}
	} else if (now.getMonth() == 8) {
		motd.push("秋が始まりますね");
		if (now.getDate() == 15) {
			motd.push("今日は十五夜らしいです");
		} else if (now.getDate() >= 24 && now.getDate() <= 28) {
			motd.push("大体このへんで昼と夜の長さが同じぐらいになるらしい");
		}
	} else if (now.getMonth() == 9) {
		motd.push("秋ですね");
		if (now.getDate() == 31) {
			motd.push("Halloweeeeeeen");
		}
	} else if (now.getMonth() == 10) {
		motd.push("秋か冬かよく分からない時期ですね");
		if (now.getDate() == 26) {
			motd = ["今日はもこきー " + (now.getFullYear() - 2022) + " 周年の日です！🎉"];
			motdd = [];
			motdt = [];
		}
	} else if (now.getMonth() == 11) {
		motd.push("冬が始まりますね");
		if (now.getDate() == 31 && now.getHours() >= 18) {
			motd = [now.getFullYear() + "年もお疲れ様でした。来年も頑張りましょう"];
			motdd = [];
			motdt = [];
		} else if (now.getDate() >= 19 && now.getDate() <= 23) {
			motd.push("大体このへんで夜が最も長いらしい");
			motd.push("お風呂にゆずを入れましょう");
		} else if (now.getDate() == 24 || now.getDate() == 25) {
			motd.push("クリスマスですね");
		}
		if (now.getDate() >= 30) {
			motd.push(now.getFullYear() + "年がもうすぐ終わりますね");
		}
		if (now.getDate() == 31) {
			motd.push("年越しそば、食べましたか？");
		}
	}
	//季節メッセージ 終わり
	//季節 : 6 , 日付 : 3 , 統計・その他 : 1
	motd = [...motd, ...motd, ...motd, ...motd, ...motd, ...motd, ...motdd, ...motdd, ...motdd, ...motdt,];
	let splashIconUrl = meta.iconUrl;
	if (meta.customSplashIcons.length > 0) {
		splashIconUrl =
			meta.customSplashIcons[
			Math.floor(Math.random() * meta.customSplashIcons.length)
			];
	}
	await ctx.render("base", {
		img: meta.iconUrl,
		title: meta.name || "Calckey",
		instanceName: meta.name || "Calckey",
		desc: "FediverseのSNSサーバーのもこきーです\n\n" + nowDate + "時点の\nユーザ数 : " + usersCount + "\n合計投稿数 : " + notesCount + "\n絵文字数 : " + emojisCount + "\n連合ユーザ数 : " + gUsersCount + "\n連合投稿数 : " + gNotesCount + "\n連合絵文字数 : " + gEmojisCount,
		icon: meta.iconUrl,
		splashIcon: splashIconUrl,
		themeColor: meta.themeColor,
		randomMOTD: motd[Math.floor(Math.random() * motd.length)],
		privateMode: meta.privateMode,
	});
	ctx.set("Cache-Control", "public, max-age=15");
});

// Register router
app.use(router.routes());

export default app;
