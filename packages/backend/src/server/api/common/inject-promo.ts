/**
 * @packageDocumentation
 *
 * タイムラインにプロモノートを 1 件ランダムに挿入する。
 *
 * @remarks
 * - **役割**: ノートタイムライン系エンドポイントから呼ばれ、未読のプロモノートを 1 件ランダムに挿入する。
 *
 * @see {@link inject-featured} おすすめ挿入
 * @internal
 */
import rndstr from "rndstr";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import { PromoReads, PromoNotes, Notes, Users } from "@/models/index.js";

export async function injectPromo(timeline: Note[], user?: User | null) {
	if (timeline.length < 5) return;

	// TODO: readやexpireフィルタはクエリ側でやる

	const reads = user
		? await PromoReads.findBy({
				userId: user.id,
		  })
		: [];

	let promos = await PromoNotes.find();

	promos = promos.filter((n) => n.expiresAt.getTime() > Date.now());
	promos = promos.filter((n) => !reads.map((r) => r.noteId).includes(n.noteId));

	if (promos.length === 0) return;

	// ランダムに 1 件選ぶ
	const promo = promos[Math.floor(Math.random() * promos.length)];

	const note = await Notes.findOneByOrFail({ id: promo.noteId });

	// ユーザーを JOIN
	note.user = await Users.findOneByOrFail({ id: note.userId });

	(note as any)._prId_ = rndstr("a-z0-9", 8);

	// Inject promo
	timeline.splice(3, 0, note);
}
