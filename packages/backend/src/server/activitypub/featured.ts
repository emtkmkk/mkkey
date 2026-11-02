import { IsNull } from "typeorm";
import config from "@/config/index.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderOrderedCollection from "@/remote/activitypub/renderer/ordered-collection.js";
import renderNote from "@/remote/activitypub/renderer/note.js";
import { Users, Notes, UserNotePinings } from "@/models/index.js";
import { checkFetch } from "@/remote/activitypub/check-fetch.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { setResponseType } from "../activitypub.js";
import type Router from "@koa/router";

export default async (ctx: Router.RouterContext) => {
	const verify = await checkFetch(ctx.req);
	if (verify !== 200) {
		ctx.status = verify;
		return;
	}

	const userId = ctx.params.user;

	const user = await Users.findOneBy({
		id: userId,
		host: IsNull(),
	});

	if (user == null) {
		ctx.status = 404;
		return;
	}

	const pinings = await UserNotePinings.find({
		where: { userId: user.id },
		order: { id: "DESC" },
	});

	// NOTE: 以前は findOneByOrFail の Promise 配列に対して filter を掛けていたため、
	// Promise には visibility が無く、条件が常に偽になって全件が落ちていた（型エラーの原因でもある）。
	// 取得後のノートに対して「ローカル限定・公開範囲外・削除済みは連合しない」条件を掛ける
	const pinnedNotes = (
		await Promise.all(
			pinings.map((pining) => Notes.findOneByOrFail({ id: pining.noteId })),
		)
	).filter(
		(note) =>
			!note.localOnly &&
			["public", "home"].includes(note.visibility) &&
			!note.deletedAt,
	);

	const renderedNotes = await Promise.all(
		pinnedNotes.map((note) => renderNote(note)),
	);

	const rendered = renderOrderedCollection(
		`${config.url}/users/${userId}/collections/featured`,
		renderedNotes.length,
		undefined,
		undefined,
		renderedNotes,
	);

	ctx.body = renderActivity(rendered);

	const meta = await fetchMeta();
	if (meta.secureMode || meta.privateMode) {
		ctx.set("Cache-Control", "private, max-age=0, must-revalidate");
	} else {
		ctx.set("Cache-Control", "public, max-age=180");
	}
	setResponseType(ctx);
};
