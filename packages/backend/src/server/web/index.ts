/**
 * @packageDocumentation
 *
 * Web クライアント用サーバ。SSR・静的ファイル・OGP・絵文字・管理画面等のルートを提供する。
 *
 * @remarks
 * - **役割**: `/`（SSR）・静的ファイル・`/emoji/:path`・管理画面・OpenAPI・url-preview・manifest 等のルートを登録。メインサーバから mount される。
 * - /emoji/:path の 404 は usageVisibility===private と既存 ngEmoji（ホストブロック・copyPermission deny）のみ。owner/follow/ブロックでは 404 にしない。
 *
 * @see {@link url-preview} URL プレビュー
 * @see {@link manifest} PWA Manifest
 * @internal
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
import { fromStoredCopyPermission } from "@/misc/copy-permission.js";
import config from "@/config/index.js";
import { getLocalNotesCount } from "@/services/note/local-notes-count-cache.js";
import {
	Users,
	Notes,
	Emojis,
	UserProfiles,
	Pages,
	Channels,
	Clips,
	GalleryPosts,
	EmojiCustomCategories,
} from "@/models/index.js";
import { getEffectiveUsageVisibility } from "@/models/repositories/emoji.js";
import * as Acct from "@/misc/acct.js";
import { getNoteSummary } from "@/misc/get-note-summary.js";
import { getSleepsUntilNextNewYearsDay } from "@/misc/motd-oshogatsu-sleeps.js";
import { queues } from "@/queue/queues.js";
import { genOpenapiSpec } from "../api/openapi/gen-spec.js";
import { urlPreviewHandler } from "./url-preview.js";
import { manifestHandler } from "./manifest.js";
import { profileCardHandler, buildProfileCardUrl } from "./ogp/index.js";
import packFeed from "./feed.js";
import { MINUTE, DAY } from "@/const.js";
import type { Note } from "@/models/entities/note.js";
import Logger from "@/services/logger.js";

const webLogger = new Logger("web");

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const staticAssets = `${_dirname}/../../../assets/`;
const clientAssets = `${_dirname}/../../../../client/assets/`;
const assets = `${_dirname}/../../../../../built/_client_dist_/`;
const swAssets = `${_dirname}/../../../../../built/_sw_dist_/`;

const resolveClientEntry = () =>
	process.env.NODE_ENV === "production"
		? config.clientEntry
		: JSON.parse(
				readFileSync(
					`${_dirname}/../../../../../built/_client_dist_/manifest.json`,
					"utf-8",
				),
		  )["src/init.ts"];

/**
 * クライアントエントリの script URL を返す。
 *
 * @remarks
 * - manifest の値が object の場合は `file` を使う。
 * - 文字列の場合はその値をそのまま使う。
 * - 先頭が `/` でない場合は `/assets/` を補って配信ルートに合わせる。
 *
 * @returns `<script type="module">` で読み込める URL
 * @internal
 */
const resolveClientEntryScriptPath = (): string => {
	const clientEntry = resolveClientEntry() as string | { file?: string };
	const rawPath =
		typeof clientEntry === "string" ? clientEntry : (clientEntry.file ?? "");
	if (!rawPath) {
		// NOTE: manifest 破損時でも空文字を返して entry_load で検知できるようにする。
		return "";
	}
	if (rawPath.startsWith("/")) {
		return rawPath;
	}
	return `/assets/${rawPath}`;
};

// Init app
const app = new Koa();

//#region Bull ダッシュボード
const bullBoardPath = "/queue";
const bullBoardSafeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function isBullBoardSameOrigin(ctx: Koa.Context): boolean {
	const origin = ctx.get("origin");
	if (origin) {
		return origin === config.url;
	}

	const referer = ctx.get("referer");
	if (referer) {
		try {
			return new URL(referer).origin === config.url;
		} catch {
			return false;
		}
	}

	const fetchSite = ctx.get("sec-fetch-site");
	return fetchSite === "same-origin";
}

// Authenticate
app.use(async (ctx, next) => {
	const url = decodeURI(ctx.path);

	if (url === bullBoardPath || url.startsWith(`${bullBoardPath}/`)) {
		if (!url.startsWith(`${bullBoardPath}/static/`)) {
			ctx.set("Cache-Control", "private, max-age=0, must-revalidate");
		}

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

		if (!bullBoardSafeMethods.has(ctx.method) && !isBullBoardSameOrigin(ctx)) {
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
			getClientEntry: () => resolveClientEntry(),
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

//#region 静的アセット

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
		// NOTE: SW 更新を早く反映するため短め（旧: 10分）
		maxage: 1 * MINUTE,
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

// プロフィール OGP 画像。reUser は /@user/:sub にもマッチしてしまうので、必ずその前に登録する。
router.get("/@:user/og.png", profileCardHandler);

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

	//console.log(ctx, ctx.params);
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
	ctx.set("Cache-Control", "public, max-age=86400");

	if (!ctx.params.path.match(/^[a-zA-Z0-9\-_@\.]+?\.webp$/)) {
		ctx.status = 404;
		return;
	}

	const name = ctx.params.path.split("@")[0].replace(/\.webp$/i, "");
	const host = ctx.params.path.split("@")[1]?.replace(/\.webp$/i, "");

	const emoji = await Emojis.findOneBy({
		// `@.` is the spec of ReactionService.decodeReaction
		host: host == null || host === "." ? IsNull() : host,
		name: name,
	});

	ctx.set(
		"Content-Security-Policy",
		"default-src 'none'; style-src 'unsafe-inline'",
	);


	if (emoji == null) {
		if ("fallback" in ctx.query) {
			return await ctx.redirect("/static-assets/user-unknown.png");
		}
		ctx.status = 404;
		return;
	}

	const ngEmoji =
		["voskey.icalo.net", "9ineverse.com", "mogeko.monster"].includes(emoji.host ?? config.host) ||
		fromStoredCopyPermission(emoji.copyPermission) === "deny" ||
		getEffectiveUsageVisibility(emoji) === "private";

	if (ngEmoji) {
		if ("fallback" in ctx.query) {
			return await ctx.redirect("/static-assets/user-unknown.png");
		}
		ctx.status = 404;
		return;
	}

	let proxy;
	let url: URL;
	// TODO : プロキシをサイズが大きすぎる物のみに使用するようにしたい
	if (!config?.mediaProxy) {
		proxy = `${config.url}/proxy`;
	} else {
		proxy = `${config.mediaProxy}`;
	}

	if ("badge" in ctx.query) {
		url = new URL(`${proxy}/emoji.png`);
		// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
		url.searchParams.set("url", emoji.publicUrl || emoji.originalUrl);
		url.searchParams.set("badge", "1");
	} else {
		url = new URL(`${proxy}/emoji.webp`);
		// || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
		url.searchParams.set("url", emoji.publicUrl || emoji.originalUrl);
		url.searchParams.set("emoji", "1");
		if ("static" in ctx.query) url.searchParams.set("static", "1");
	}
	ctx.status = 301;
	ctx.redirect(url.toString());
});

router.get("/emoji_license/:path([^.]*).json", async (ctx) => {
	if (!ctx.params.path.match(/^[a-zA-Z0-9\-_@\.]+?$/)) {
		ctx.status = 404;
		return;
	}

	const name = ctx.params.path.split("@")[0];
	const host = ctx.params.path.split("@")?.[1]?.replace(/\.json$/, "");

	const emoji = await Emojis.findOneBy({
		// `@.` is the spec of ReactionService.decodeReaction
		host: host == null || host === "." ? IsNull() : host,
		name: name,
	});

	if (emoji) {
		ctx.set("Content-Type", "application/json; charset=utf-8");
		ctx.set("Cache-Control", "public, max-age=15");
		const copyPermission = emoji.isTextOnly
			? "allow"
			: fromStoredCopyPermission(emoji.copyPermission);
		const license = emoji.isTextOnly
			? "CC0 1.0 Universal"
			: (emoji.licenseName ?? null);
		const creator = emoji.isTextOnly ? config.host : (emoji.creator ?? undefined);
		ctx.body = JSON.stringify({
			copyPermission,
			license,
			usageInfo: emoji.usageInfo ?? undefined,
			creator,
			description: emoji.description ?? undefined,
			isBasedOnUrl: emoji.isBasedOnUrl ?? undefined,
		});
	} else {
		ctx.status = 404;
	}
});

//#region SSR（クローラー用）
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
		// 対象外のユーザー（リモート・privateMode 等）では null になり、従来のアイコンが使われる
		ogImageUrl: buildProfileCardUrl(user, meta),
		twitterCard: "summary_large_image",
		sub: subParam,
		instanceName: meta.name || "Cluckey",
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

router.get("/notes/:note/references", async (ctx, next) => {
	const note = await Notes.findOneBy({
		id: ctx.params.note,
	});

	try {
		if (note) {
			const user = await Users.findOneByOrFail({
				id: note.userId,
			});

			const _note: Note =
				["public", "home"].includes(note.visibility) && !note.localOnly
					? await Notes.pack(note)
					: { id: note.id, user: user, fileIds: [], files: [], referenceIds: [] };

			const profile = await UserProfiles.findOneByOrFail({
				userId: note.userId,
			});
			const userName = user.name?.replaceAll(/ ?:.*?:/g, "").trim()
				? `${user.name?.replaceAll(/ ?:.*?:/g, "")}${user.host ? `@${user.host}` : ""
				}`
				: `@${user.username}${user.host ? `@${user.host}` : ""}`;

			const meta = await fetchMeta();
			if (_note.referenceIds?.length) {
				let referenceNote;
				for (const noteId of _note.referenceIds) {
					const note =
						await Notes.findOneBy({
							id: noteId,
						});
					if (!note || !["public", "home"].includes(note.visibility) || note.localOnly) {
						continue;
					}
					referenceNote = note;
					break;
				}
				if (!referenceNote){
					await ctx.render("references", {
						note: _note,
						profile,
						avatarUrl: await Users.getAvatarUrl(user),
						// TODO: Let locale changeable by instance setting
						title: `投稿の参照 (${_note.referenceIds?.length}件) by ${userName} (@${Acct.toString(user)})`,
						summary: "",
						userName,
						instanceName: meta.name || "Cluckey",
						icon: meta.iconUrl,
						privateMode: meta.privateMode,
						themeColor: meta.themeColor,
					});

					ctx.set("Cache-Control", "public, max-age=15");

					return;
				}
				const refNote = await Notes.pack(referenceNote)
				const referenceUser = await Users.findOneByOrFail({
					id: referenceNote.userId,
				});
				const refProfile = await UserProfiles.findOneByOrFail({
					userId: referenceNote.userId,
				});
				const refUserName = referenceUser.name?.replaceAll(/ ?:.*?:/g, "").trim()
					? `${referenceUser.name?.replaceAll(/ ?:.*?:/g, "")}${referenceUser.host ? `@${referenceUser.host}` : ""
					}`
					: `@${referenceUser.username}${referenceUser.host ? `@${referenceUser.host}` : ""}`;
				let summary = ""
				summary = getNoteSummary(await Notes.pack(referenceNote));
				summary = [_note.referenceIds.length > 1 ? `他${_note.referenceIds.length - 1}件` : "", summary].filter(Boolean).join(" / ");
				await ctx.render("references", {
					note: refNote || _note,
					profile: refProfile || profile,
					avatarUrl: await Users.getAvatarUrl(referenceUser || user),
					// TODO: Let locale changeable by instance setting
					title: `投稿の参照 (${_note.referenceIds?.length}件) by ${userName} (@${Acct.toString(user)})`,
					summary,
					userName: refUserName || userName,
					instanceName: meta.name || "Cluckey",
					icon: meta.iconUrl,
					privateMode: meta.privateMode,
					themeColor: meta.themeColor,
				});

				ctx.set("Cache-Control", "public, max-age=15");

				return;
			}
		}
	} catch (e) {
		webLogger.error("emoji middleware failed", { e });
	}

	await next();
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

			const _note =
				["public", "home"].includes(note.visibility) && !note.localOnly
					? await Notes.pack(note)
					: { id: note.id, user: user, fileIds: [], files: [] };

			const profile = await UserProfiles.findOneByOrFail({
				userId: note.userId,
			});
			const meta = await fetchMeta();
			const userName = user.name?.replaceAll(/ ?:.*?:/g, "").trim()
				? `${user.name?.replaceAll(/ ?:.*?:/g, "")}${user.host ? `@${user.host}` : ""
				}`
				: `@${user.username}${user.host ? `@${user.host}` : ""}`;
			let summary = "";
			if (!["public", "home"].includes(note.visibility) || note.localOnly) {
				summary = `${note.visibility === "followers"
					? `${userName}さんのフォロワー限定の投稿`
					: "公開範囲が限定されている投稿"
					}なのでプレビューを表示できません。\nリンクをクリックすると投稿ページへ移動します。`;
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
				instanceName: meta.name || "Cluckey",
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

		const _note =
			["public", "home"].includes(note.visibility) && !note.localOnly
				? await Notes.pack(note)
				: { id: note.id, user: user, fileIds: [], files: [] };

		const profile = await UserProfiles.findOneByOrFail({
			userId: note.userId,
		});
		const meta = await fetchMeta();
		const userName = user.name?.replaceAll(/ ?:.*?:/g, "").trim()
			? `${user.name?.replaceAll(/ ?:.*?:/g, "")}${user.host ? `@${user.host}` : ""
			}`
			: `@${user.username}${user.host ? `@${user.host}` : ""}`;
		let summary = "";
		if (!["public", "home"].includes(note.visibility) || note.localOnly) {
			summary = `${note.visibility === "followers"
				? `${userName}さんのフォロワー限定の投稿`
				: "公開範囲が限定されている投稿"
				}なのでプレビューを表示できません。\nリンクをクリックすると投稿ページへ移動します。`;
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
			instanceName: meta.name || "Cluckey",
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
		// 非公開ページは OGP 用の詳細レンダリングを行わない
		if (!page.isPublic) {
			await next();
			return;
		}

		const _page = await Pages.pack(page);
		const profile = await UserProfiles.findOneByOrFail({ userId: page.userId });
		const meta = await fetchMeta();
		await ctx.render("page", {
			page: _page,
			profile,
			avatarUrl: await Users.getAvatarUrl(
				await Users.findOneByOrFail({ id: page.userId }),
			),
			instanceName: meta.name || "Cluckey",
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
			instanceName: meta.name || "Cluckey",
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
			instanceName: meta.name || "Cluckey",
			icon: meta.iconUrl,
			themeColor: meta.themeColor,
			privateMode: meta.privateMode,
		});

		ctx.set("Cache-Control", "public, max-age=15");

		return;
	}

	await next();
});


// Categories
router.get("/@:user/categories/:post", async (ctx, next) => {
	const post = await EmojiCustomCategories.findOneBy({ id: ctx.params.post });

	if (post == null) return;

	const user = await Users.findOneBy({
		id: post.userId
	});

	if (user == null) return;

	if (post) {
		const _category = await EmojiCustomCategories.pack(post);
		const profile = await UserProfiles.findOneByOrFail({ userId: post.userId });
		const meta = await fetchMeta();
		await ctx.render("category", {
			category: _category,
			profile,
			summary: [(_category.contents ?? []).length ? `${_category.contents.length}個の絵文字` : "", _category.summary].filter(Boolean).join(" / "),
			avatarUrl: await Users.getAvatarUrl(user),
			instanceName: meta.name || "Cluckey",
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
			instanceName: meta.name || "Cluckey",
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
		originalUsersCount: await Users.count({
			where: { host: IsNull(), isDeleted: false },
			cache: 3600000,
		}), //1h
		originalNotesCount: await getLocalNotesCount(),
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

/** Light Client 用の CSS/JS を外部ファイルで配信。長期キャッシュで再訪問時の転送量を削減。 */
router.get("/light/light.css", async (ctx) => {
	await send(ctx as any, "light.css", {
		root: _dirname,
		maxage: 86400, // 1日（秒）
	});
});
router.get("/light/light.js", async (ctx) => {
	await send(ctx as any, "light.js", {
		root: _dirname,
		maxage: 86400, // 1日（秒）
	});
});
router.get("/light", async (ctx) => {
	// NOTE: 第3引数 { pretty: false } で Light Client の HTML のみ minify
	// koa-views の型定義は2引数のみだが、Pug では第3引数の pretty を解釈する
	await (ctx.render as (a: string, b?: object, c?: object) => void)(
		"light",
		{ version: config.version },
		{ pretty: false },
	);
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

router.get("/_health/frontend-login", async (ctx) => {
	ctx.set("Cache-Control", "no-store, max-age=0, must-revalidate");
	ctx.set("Content-Type", "text/html; charset=utf-8");
	const clientEntryScriptPath = resolveClientEntryScriptPath();
	ctx.body = `<!doctype html>
<html lang="ja">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>frontend-login-health</title>
</head>
<body>
	<pre id="result">FRONTEND_LOGIN_CHECKING</pre>
	<script>
	(() => {
		const resultEl = document.getElementById("result");
		let finished = false;
		const timeoutMs = 75000;
		const writeResult = (ok, step, message) => {
			if (finished) return;
			finished = true;
			const status = ok ? "FRONTEND_LOGIN_OK" : "FRONTEND_LOGIN_NG";
			const lines = [
				status,
				"ERROR_STEP: " + (step || "none"),
				"ERROR_CODE: " + (ok ? "none" : "runtime_error"),
				"ERROR_MESSAGE: " + (message || "none"),
			];
			resultEl.textContent = lines.join("\\n");
		};

		window.addEventListener("error", (event) => {
			writeResult(false, "window.onerror", event.message || "unknown error");
		});

		window.addEventListener("unhandledrejection", (event) => {
			const reason = event.reason && event.reason.message
				? event.reason.message
				: String(event.reason || "unknown rejection");
			writeResult(false, "unhandledrejection", reason);
		});

		(async () => {
			const timeoutId = setTimeout(() => {
				writeResult(false, "timeout", "init did not complete in time");
			}, timeoutMs);
			try {
				// NOTE: init.ts 相当を実行して、実行時エラーや初期化失敗を検知する。
				window.__MK_HEALTH_FRONTEND_LOGIN__ = true;
				const script = document.createElement("script");
				script.type = "module";
				script.src = ${JSON.stringify(clientEntryScriptPath)};
				script.onerror = () => {
					writeResult(false, "entry_load", "failed to load client entry");
				};
				document.head.appendChild(script);

				const hasMountedApp = () =>
					document.getElementById("cluckey_app") ||
					document.getElementById("calckey_app");

				const observer = new MutationObserver(() => {
					if (hasMountedApp()) {
						clearTimeout(timeoutId);
						observer.disconnect();
						writeResult(true, "init_complete", "mounted");
					}
				});
				observer.observe(document.body, { childList: true, subtree: true });

				if (hasMountedApp()) {
					clearTimeout(timeoutId);
					observer.disconnect();
					writeResult(true, "init_complete", "mounted");
				}
			} catch (error) {
				const message = error && error.message ? error.message : String(error);
				writeResult(false, "runtime_check", message);
			}
		})();
	})();
	</script>
</body>
</html>`;
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
	let usersCount = await Users.count({
		where: { host: IsNull(), notesCount: MoreThan(50), isDeleted: false },
		cache: 21600000,
	}); //6h
	let notesCount = await getLocalNotesCount();
	let gUsersCount = await Users.count({
		where: { host: Not(IsNull()), isDeleted: false },
		cache: 21600000,
	}); //6h
	let gNotesCount = await Notes.count({
		where: { userHost: Not(IsNull()), deletedAt: IsNull() },
		cache: 21600000,
	}); //6h
	let emojisCount = await Emojis.count({
		where: { host: IsNull() },
		cache: 21600000,
	}); //6h
	let gEmojisCount = await Emojis.count({
		where: { host: Not(IsNull()) },
		cache: 21600000,
	}); //6h
	let motd = [];
	let motdd = []; //日付のmotd
	let motdt = []; //統計のmotd
	if (meta.customMOTD.length > 0) {
		motdt = meta.customMOTD;
	}
	const now = new Date();
	let nowDate = new Date().toLocaleDateString("ja-JP");
	motdd.push(`今日は ${nowDate} です`);
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
	const nowDaysCnt = Math.floor(
		(now.valueOf() - yearFirstDay.valueOf()) / (24 * 60 * 60 * 1000),
	);
	const yearDaysCnt = Math.floor(
		(yearNextFirstDay.valueOf() - yearFirstDay.valueOf()) /
		(24 * 60 * 60 * 1000),
	);
	motdd.push(
		`${now.getFullYear()}年 進行度 ${nowDaysCnt} / ${yearDaysCnt} ( ${(
			(nowDaysCnt / yearDaysCnt) *
			100
		).toFixed(1)}% ) です`,
	);
	motdt.push(`${meta.name}のユーザ数は ${usersCount.toLocaleString("ja-JP")} です`);
	motdt.push(`${meta.name}の合計投稿数は ${notesCount.toLocaleString("ja-JP")} です`);
	motdt.push(`${meta.name}の連合ユーザ数は ${gUsersCount.toLocaleString("ja-JP")} です`);
	motdt.push(`${meta.name}の連合投稿数は ${gNotesCount.toLocaleString("ja-JP")} です`);
	motdt.push(`${meta.name}の絵文字数は ${emojisCount.toLocaleString("ja-JP")} です`);
	//季節メッセージ
	/** 季節だけで motd を差し替えて日付・統計プールを外したとき（カウントダウン MOTD は付けない） */
	let seasonalMotdForcedExclusive = false;
	if (now.getMonth() === 0) {
		motd.push("冬ですね");
		if (now.getDate() == 1) {
			seasonalMotdForcedExclusive = true;
			motd = [
				`HAPPY NEW YEAR ${now.getFullYear()} 🎉`,
				"あけましておめでとうございます！",
			];
			motdd = [];
			motdt = [];
		} else if (now.getDate() <= 3) {
			motd.push(`HAPPY NEW YEAR ${now.getFullYear()} 🎉`);
			motd.push("あけましておめでとうございます！");
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
		if (now.getDate() == 29) {
			motd.push("今日は閏日ですね");
		}
	} else if (now.getMonth() == 2) {
		motd.push("春が始まりますね");
		if (now.getDate() == 3) {
			motd.push("明かりをつけましょぼんぼりに");
		} else if (now.getDate() == 14) {
			motd.push("今日はホワイトデーです");
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
		} else if (now.getDate() >= 20 && now.getDate() < 27) {
			motd.push(`5/27は${meta.name} ${now.getFullYear() - 2023}.5 周年の日みたいです`);
		} else if (now.getDate() == 27) {
			seasonalMotdForcedExclusive = true;
			motd = [
				`今日は${meta.name} ${now.getFullYear() - 2023}.5 周年の日です！🎉`,
			];
			motdd = [];
			motdt = [];
		}
	} else if (now.getMonth() == 5) {
		motd.push("梅雨の季節ですね");
		if (now.getDate() == 6) {
			motd.push("UFOがあっちいってこっちいって落っこちる日です");
		} else if (now.getDate() >= 19 && now.getDate() <= 23) {
			motd.push("大体このへんで昼が最も長いらしいです");
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
			motd.push("大体このへんで昼と夜の長さが同じぐらいになるらしいです");
		}
	} else if (now.getMonth() == 9) {
		motd.push("秋ですね");
		if (now.getDate() == 31) {
			motd.push("Halloweeeeeeen");
		}
	} else if (now.getMonth() == 10) {
		motd.push("秋か冬かよく分からない時期ですね");
		if (now.getDate() >= 19 && now.getDate() < 26) {
			motd.push(`11/26は${meta.name} ${now.getFullYear() - 2022} 周年の日みたいです`);
		} else if (now.getDate() == 26) {
			seasonalMotdForcedExclusive = true;
			motd = [
				`今日は${meta.name} ${now.getFullYear() - 2022} 周年の日です！🎉`,
			];
			motdd = [];
			motdt = [];
		}
	} else if (now.getMonth() == 11) {
		motd.push("冬が始まりますね");
		if (now.getDate() == 31 && now.getHours() >= 18) {
			seasonalMotdForcedExclusive = true;
			motd = [`${now.getFullYear()}年もお疲れ様でした。来年も頑張りましょう`];
			motdd = [];
			motdt = [];
		} else if (now.getDate() >= 19 && now.getDate() <= 23) {
			motd.push("大体このへんで夜が最も長いらしい");
			motd.push("お風呂にゆずを入れましょう");
		} else if (now.getDate() == 24 || now.getDate() == 25) {
			motd.push("クリスマスですね");
		}
		if (now.getDate() >= 30) {
			motd.push(`${now.getFullYear()}年がもうすぐ終わりますね`);
		}
		if (now.getDate() == 31) {
			motd.push("年越しそば、食べましたか？");
		}
	}
	if (!seasonalMotdForcedExclusive) {
		const sleeps = getSleepsUntilNextNewYearsDay(now);
		if (sleeps >= 1 && sleeps <= 99) {
			motd.push(`もう ${sleeps} つ寝るとお正月`);
		}
	}
	//季節メッセージ 終わり
	//季節 : 6 , 日付 : 3 , 統計・その他 : 1
	motd = [
		...motd,
		...motd,
		...motd,
		...motd,
		...motd,
		...motd,
		...motdd,
		...motdd,
		...motdd,
		...motdt,
		"🍙",
	];
	let randomMOTD = motd[Math.floor(Math.random() * motd.length)]
	//旬の食べ物情報の生成
	if (randomMOTD == "🍙") {
		randomMOTD = `今が旬の食べ物: ${pickWeighted(getSeasonalProduce(now))}`
	}
	if (Math.random() < 0.001) {
		randomMOTD = `このメッセージは 1 / 1000 (0.1%) の確率で表示されます`;
	}
	let splashIconUrl = meta.iconUrl;
	if (meta.customSplashIcons.length > 0) {
		splashIconUrl =
			meta.customSplashIcons[
			Math.floor(Math.random() * meta.customSplashIcons.length)
			];
	}
	await ctx.render("base", {
		img: meta.iconUrl,
		title: meta.name || "Cluckey",
		instanceName: meta.name || "Cluckey",
		desc: `FediverseのSNSサーバーの${meta.name}です\n\n${nowDate}時点の\nユーザ数 : ${usersCount.toLocaleString("ja-JP")}\n合計投稿数 : ${notesCount.toLocaleString("ja-JP")}\n絵文字数 : ${emojisCount.toLocaleString("ja-JP")}\n連合ユーザ数 : ${gUsersCount.toLocaleString("ja-JP")}\n連合投稿数 : ${gNotesCount.toLocaleString("ja-JP")}\n連合絵文字数 : ${gEmojisCount.toLocaleString("ja-JP")}`,
		icon: meta.iconUrl,
		splashIcon: splashIconUrl,
		themeColor: meta.themeColor,
		randomMOTD,
		privateMode: meta.privateMode,
		noindex: (ctx.path?.length ?? 0) > 1
	});
	ctx.set("Cache-Control", "public, max-age=15");
});

function getSeasonalProduce(date: Date = new Date()): Record<string, number> {
  const m = date.getMonth(); // 0～11
  let items: Record<string, number> = {};

  switch (m) {
    case 0: // 1月
      items = {
        // 果物
        "いちご": 16, "柑橘": 14, "りんご": 9, "みかん": 15,
        "キウイフルーツ": 13,
        // 野菜
        "カリフラワー": 12
      };
      break;

    case 1: // 2月
      items = {
        // 果物
        "いちご": 18, "柑橘": 21, "りんご": 11, "みかん": 9,
        "アボカド": 9, "キウイフルーツ": 15,
        // 野菜
        "カリフラワー": 11
      };
      break;

    case 2: // 3月
      items = {
        // 果物
        "いちご": 22, "柑橘": 22, "りんご": 11,
        "バナナ": 9, "レモン": 9, "グレープフルーツ": 9,
        "アボカド": 9, "キウイフルーツ": 15,
        // 野菜
        "ブロッコリー": 11,
      };
      break;

    case 3: // 4月
      items = {
        // 果物
        "いちご": 19, "柑橘": 17, "りんご": 9, "びわ": 23,
        "マンゴー": 11, "バナナ": 9,
        "レモン": 9, "パイン": 12,
        "キウイフルーツ": 10, "ブルーベリー": 10,
        // 野菜
        "たけのこ": 67, "キャベツ": 10, "ピーマン": 10,
      };
      break;

    case 4: // 5月
      items = {
        // 果物
        "いちご": 11, "びわ": 51,
        "メロン": 18, "すいか": 16, "さくらんぼ": 9,
        "うめ": 21, "マンゴー": 22, "バナナ": 9,
        "パパイア": 12,
        "アボカド": 9, "パイン": 14,
        "ブルーベリー": 12,
        // 野菜
        "きゅうり": 11, "トマト": 11, "ピーマン": 11,
      };
      break;

    case 5: // 6月
      items = {
        // 果物
        "びわ": 22, "メロン": 25, "すいか": 23,
        "さくらんぼ": 71,
        "すもも": 21, "あんず": 52, "もも": 10,
        "うめ": 78, "マンゴー": 24, "バナナ": 9,
        "パパイア": 9, "グレープフルーツ": 9,
        "パイン": 13,
        "ブルーベリー": 27,
        // 野菜
        "なす": 11, "とうもろこし": 29, "オクラ": 15,
      };
      break;

    case 6: // 7月
      items = {
        // 果物
        "メロン": 19, "すいか": 32, "ぶどう": 9, "さくらんぼ": 17,
        "すもも": 40,
        "あんず": 47, "もも": 44, "マンゴー": 31,
        "バナナ": 9,
        "すだち": 9,
        "グレープフルーツ": 9,
        "パイン": 10,
        "ブルーベリー": 34, "プルーン": 16,
        // 野菜
        "なす": 11, "とうもろこし": 35, "オクラ": 23,
      };
      break;

    case 7: // 8月
      items = {
        // 果物
        "メロン": 12, "すいか": 18, "ぶどう": 23,
        "日本梨": 37, "いちじく": 32, "すもも": 24,
        "もも": 36,
        "すだち": 17,
        "シャインマスカット": 16, "グレープフルーツ": 10,
        "アボカド": 9, "ブルーベリー": 9, "プルーン": 35,
        // 野菜
		"きゅうり": 11, "トマト": 11,
        "なす": 12, "とうもろこし": 22, "オクラ": 20,
      };
      break;

    case 8: // 9月
      items = {
        // 果物
        "りんご": 9,
        "ぶどう": 32, "西洋梨": 11,
        "かき": 13, "くり": 47, "日本梨": 42, "いちじく": 30,
        "すもも": 12, "もも": 9, "すだち": 18,
        "シャインマスカット": 39, "グレープフルーツ": 9,
        "アボカド": 9,
        "プルーン": 36,
        // 野菜
        "れんこん": 11, "オクラ": 12,
      };
      break;

    case 9: // 10月
      items = {
        // 果物
        "りんご": 12, "みかん": 12,
        "ぶどう": 19, "西洋梨": 21, "かき": 43, "くり": 43,
        "日本梨": 13, "いちじく": 16,
        "レモン": 9, "パパイア": 10, "すだち": 13,
        "シャインマスカット": 26,
        "プルーン": 12,
        // 野菜
        "れんこん": 13, "カリフラワー": 14
      };
      break;

    case 10: // 11月
      items = {
        // 果物
        "りんご": 12, "みかん": 23, "西洋梨": 38, "かき": 32,
        "ゆず": 12, "レモン": 10, "パパイア": 10, "すだち": 9,
        // 野菜
        "かぶ": 11, "れんこん": 12, "ほうれんそう": 11, "カリフラワー": 13
      };
      break;

    case 11: // 12月
      items = {
        // 果物
        "いちご": 10, "りんご": 10, "みかん": 33,
        "西洋梨": 22, "かき": 10, "ゆず": 63, "レモン": 11,
        "パパイア": 14,
        // 野菜
        "かぶ": 11, "ごぼう": 15, "れんこん": 16, "ねぎ": 11, "カリフラワー": 13
      };
      break;

    default:
      items = {};
  }

  return items;
}

function pickWeighted<TKey extends string>(weights: Record<TKey, number>): TKey {
  // entries: [key, weight][]
  const entries = Object.entries(weights) as [TKey, number][];
  // 重みの合計を計算
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  // 0以上 total 未満 の乱数を生成
  let r = Math.random() * total;
  // 累積でキーを選ぶ
  for (const [key, weight] of entries) {
    if (r < weight) {
      return key;
    }
    r -= weight;
  }
  // 万が一の保険として最後のキーを返す
  return entries[entries.length - 1][0];
}

// Register router
app.use(router.routes());

export default app;
