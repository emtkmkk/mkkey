/**
 * @packageDocumentation
 *
 * ActivityPub 向けにローカルノートを AS2 オブジェクトへレンダリングする。
 *
 * @remarks
 * 投票付きノートは `Question` 相当の形で `oneOf` / `anyOf` に各選択肢全文を載せる。選択肢が長いとペイロードが肥大し、他実装が拒否する可能性がある（API 側の短い上限とは別問題）。
 *
 * 宛先（to / cc）は `visibility` ではなく、リモートから見た公開範囲（`misc/semi-public.ts` の `getRemoteVisibility`）で決める。
 * `localOnly` の public / home はフォロワー限定、セミパブリックは公開として出る。
 *
 * 本文・CW の `$[mc]`（マクドナルドの短縮名）は、投稿者の設定で置き換えてから出す（`misc/mc-short-name.ts`）。
 *
 * 他鯖絵文字（:name@host:）の入った投稿は、`@host` を取って CW を付けて出す（{@link stripRemoteEmojiForFederation}）。
 *
 * @internal
 */
import { In, IsNull } from "typeorm";
import config from "@/config/index.js";
import * as url from "@/prelude/url.js";
import type { Note, IMentionedRemoteUsers } from "@/models/entities/note.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { DriveFiles, Notes, Users, Emojis, Polls } from "@/models/index.js";
import type { Emoji } from "@/models/entities/emoji.js";
import type { Poll } from "@/models/entities/poll.js";
import toHtml from "../misc/get-note-html.js";
import renderEmoji from "./emoji.js";
import { apLogger } from "../logger.js";
import renderMention from "./mention.js";
import renderHashtag from "./hashtag.js";
import renderDocument from "./document.js";
import {
	fetchExposedReferences,
	getReferenceUri,
	type ReferenceExposureContext,
} from "@/services/note/reference-visibility.js";
import { getRemoteVisibility, getLocalVisibilityHint } from "@/misc/semi-public.js";
import { applyMcShortName, resolveMcShortName } from "@/misc/mc-short-name.js";

export default async function renderNote(
	note: Note,
	dive = true,
	isTalk = false,
	options: { pollOverride?: Poll | null } = {},
): Promise<Record<string, unknown>> {
	const getPromisedFiles = async (ids: string[]) => {
		if (!ids || ids.length === 0) return [];
		const items = await DriveFiles.findBy({ id: In(ids) });
		return ids
			.map((id) => items.find((item) => item.id === id))
			.filter((item) => item != null) as DriveFile[];
	};

	let inReplyTo;
	let inReplyToNote: Note | null;

	if (note.replyId) {
		inReplyToNote = await Notes.findOneBy({ id: note.replyId });

		if (inReplyToNote != null) {
			const inReplyToUser = await Users.findOneBy({ id: inReplyToNote.userId });

			if (inReplyToUser != null) {
				if (inReplyToNote.uri) {
					inReplyTo = inReplyToNote.uri;
				} else {
					if (dive) {
						inReplyTo = await renderNote(inReplyToNote, false);
					} else {
						inReplyTo = `${config.url}/notes/${inReplyToNote.id}`;
					}
				}
			}
		}
	} else {
		inReplyTo = null;
	}

	let quote;

	if (note.renoteId) {
		const renote = await Notes.findOneBy({ id: note.renoteId });

		if (renote) {
			quote = renote.uri ? renote.uri : `${config.url}/notes/${renote.id}`;
		}
	}

	const attributedTo = `${config.url}/users/${note.userId}`;

	let mentions: string[] = [];
	try {
		mentions = (
			JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers
		)?.map((x) => x.uri);
	} catch(e) {
		apLogger.warn("failed to parse mentionedRemoteUsers", { e });
	}

	let to: string[] = [];
	let cc: string[] = [];

	const remoteFollowerOnly = note.localOnly && ["public", "home"].includes(note.visibility);
	// 宛先はリモートから見た公開範囲で決める（localOnly はフォロワー限定、セミパブリックは公開になる）
	const remoteVisibility = getRemoteVisibility(note);

	if (remoteVisibility === "public") {
		to = ["https://www.w3.org/ns/activitystreams#Public"];
		cc = [`${attributedTo}/followers`].concat(mentions);
	} else if (remoteVisibility === "home") {
		to = [`${attributedTo}/followers`];
		cc = ["https://www.w3.org/ns/activitystreams#Public"].concat(mentions);
	} else if (remoteVisibility === "followers") {
		to = [`${attributedTo}/followers`];
		cc = mentions;
	} else {
		to = mentions;
	}

	const mentionedUsers =
		note.mentions.length > 0
			? await Users.findBy({
				id: In(note.mentions),
			})
			: [];

	const hashtagTags = (note.tags || []).map((tag) => renderHashtag(tag));
	const mentionTags = mentionedUsers.map((u) => renderMention(u));

	const files = await getPromisedFiles(note.fileIds);

	// 他鯖絵文字（:name@host:）の入った投稿は、相手では表示できないので @ 以下を取って CW を付けて送る。
	// NB: 渡された note は呼び出し元でも使われる（配送のたびに何度も render される）ので書き換えない。
	// 以前は note.cw を直接書き換えていたため、2 回目以降の render で CW が定型文だけに置き換わっていた
	const remoteEmojiStripped = stripRemoteEmojiForFederation(note);
	const noteCw = remoteEmojiStripped.cw;
	const noteText = remoteEmojiStripped.text;
	const noteEmojis = remoteEmojiStripped.emojis;

	// $[mc]（マクドナルドの短縮名）は、リモートへは投稿者の設定で置き換えてから出す
	const mcShortName = await getAuthorMcShortName(note);
	let text = applyMcShortName(noteText ?? "", mcShortName);
	let poll: Poll | null = null;

	if (note.hasPoll) {
		if (options.pollOverride !== undefined) {
			poll = options.pollOverride;
		} else {
			poll = await Polls.findOneBy({ noteId: note.id });
		}
	}

	if (note.referenceIds?.length) {
		text = [text.trim(),`[<参照>](${config.url}/notes/${note.id}/references)`].filter(Boolean).join(" ");
	}

	let apText = text;

	if (quote) {
		apText += `\n\nRE: ${quote}`;
	}

	const summary =
		noteCw === ""
			? String.fromCharCode(0x200b)
			: applyMcShortName(noteCw, mcShortName);

	const content = toHtml(
		Object.assign({}, note, {
			text: apText,
			cw: noteCw,
			emojis: noteEmojis,
		}),
	);

	const emojis = await getEmojis(noteEmojis);
	const apemojis = emojis.map((emoji) => renderEmoji(emoji));

	const tag = [...hashtagTags, ...mentionTags, ...apemojis];

	const asPoll = poll
		? {
			type: "Question",
			content: toHtml(
				Object.assign({}, note, {
					text: text,
					cw: noteCw,
					emojis: noteEmojis,
				}),
			),
			[poll.expiresAt && poll.expiresAt < new Date() ? "closed" : "endTime"]:
				poll.expiresAt,
			[poll.multiple ? "anyOf" : "oneOf"]: poll.choices.map((text, i) => ({
				type: "Note",
				name: text,
				replies: {
					type: "Collection",
					totalItems: poll!.votes[i],
				},
			})),
		}
		: {};

	const asTalk = isTalk
		? {
			_misskey_talk: true,
		}
		: {};

	return {
		id: `${config.url}/notes/${note.id}`,
		type: "Note",
		attributedTo,
		summary,
		content,
		contentMap: {
			ja: content,
		},
		_misskey_content: text,
		source: {
			content: text,
			mediaType: "text/x.misskeymarkdown",
		},
		_misskey_quote: quote,
		quoteUri: quote,
		quoteUrl: quote,
		published: note.createdAt.toISOString(),
		to,
		cc,
		inReplyTo,
		attachment: files.map(renderDocument),
		sensitive: noteCw != null || files.some((file) => file.isSensitive),
		tag,
		references: await getReferences(note),
		...asPoll,
		...asTalk,
		// バブル相手には元のローカル範囲を伝える。一般のリモートは既存の to/cc を使う。
		_mk_localVisibility: getLocalVisibilityHint(note),
	};
}

/** 本文中の他鯖絵文字（:name@host:）。名前は大文字も含む（Mastodon 系の :BlobCat: など） */
const REMOTE_EMOJI_IN_TEXT = /:([a-z0-9_+-]+)@[a-z0-9_+.-]*:/gi;

/** 他鯖絵文字を含む投稿に付ける CW の定型文 */
const REMOTE_EMOJI_CW = "投稿に連合先表示不可の絵文字が含まれます";

/**
 * 他鯖絵文字を、連合先に出せる形にした CW・本文・絵文字名を返す
 *
 * @remarks
 * - 他鯖絵文字（:name@host:）が CW か本文にあれば、`@host` を取り除き、CW の先頭に定型文を付ける。
 *   相手は `name@host` の絵文字を持っていないので、少なくとも見た目が崩れていることを CW で知らせる。
 * - 利用者が書いた CW は残す（定型文の後ろに続ける）。CW が無ければ定型文だけにする。
 * - 渡された note は書き換えない（新しい値を返す）。
 * - 古い定型文「投稿にリモート表示不可の絵文字」が既に入っている CW には付け足さない（後方互換）。
 *
 * @param note - ローカルノート
 * @returns 送る CW・本文・絵文字名。他鯖絵文字が無ければ note の値そのまま
 * @internal
 */
function stripRemoteEmojiForFederation(
	note: Pick<Note, "cw" | "text" | "emojis">,
): { cw: string | null; text: string | null; emojis: string[] } {
	const hasRemoteEmoji = (value: string | null | undefined) =>
		value != null && new RegExp(REMOTE_EMOJI_IN_TEXT.source, "i").test(value);
	if (!hasRemoteEmoji(note.cw) && !hasRemoteEmoji(note.text)) {
		return { cw: note.cw, text: note.text, emojis: note.emojis };
	}

	const strip = (value: string | null) =>
		value?.replaceAll(REMOTE_EMOJI_IN_TEXT, ":$1:") ?? value;
	const strippedCw = strip(note.cw);
	const cw =
		strippedCw == null || strippedCw === ""
			? REMOTE_EMOJI_CW
			: strippedCw.includes(REMOTE_EMOJI_CW) ||
				  strippedCw.includes("投稿にリモート表示不可の絵文字")
				? strippedCw
				: `${REMOTE_EMOJI_CW} ${strippedCw}`;

	return {
		cw,
		text: strip(note.text),
		emojis: (note.emojis ?? []).map((x) => x.replace(/@.*$/, "")),
	};
}

/**
 * 投稿者のマクドナルドの短縮名（`$[mc]` の置き換え先）を求める
 *
 * @remarks
 * 本文・CW に `$[mc` が無ければ DB を引かずに既定値を返す（ほとんどの投稿はここで終わる）。
 *
 * @param note - ローカルノート
 * @returns 短縮名
 * @internal
 */
async function getAuthorMcShortName(note: Note): Promise<string> {
	if (!note.text?.includes("$[mc") && !note.cw?.includes("$[mc")) {
		return resolveMcShortName(null);
	}
	const author =
		note.user ?? (await Users.findOne({ where: { id: note.userId }, select: ["id", "mcShortName"] }));
	return resolveMcShortName(author?.mcShortName);
}

export async function getEmojis(names: string[]): Promise<Emoji[]> {
	if (names == null || names.length === 0) return [];

	const emojis = await Promise.all(
		names.map((name) =>
			Emojis.findOneBy({
				name,
				host: IsNull(),
			}),
		),
	);

	return emojis.filter((emoji) => emoji != null) as Emoji[];
}

export async function getReferences(
	note: Note,
	page?: string | boolean | undefined,
	context: ReferenceExposureContext = { kind: "anonymous" },
) {
	const limit =
		page !== undefined ||
		!(["public", "home"].includes(note.visibility) && !note.localOnly)
			? 100
			: 5;

	let referenceIds = [...(note.referenceIds ?? [])];

	if (typeof page === "string") {
		referenceIds = referenceIds.filter((x) => x > page);
	}

	const exposed = await fetchExposedReferences(referenceIds, context);
	const exposedMap = new Map(exposed.map((n) => [n.id, n]));
	const visibleOrderedIds = referenceIds.filter((id) => exposedMap.has(id));

	const inStock = visibleOrderedIds.length > limit;
	const pageIds = inStock
		? [...visibleOrderedIds].sort((a, b) => (a < b ? -1 : 1)).slice(0, limit)
		: visibleOrderedIds;

	const renderedReferenceUrls = pageIds.map((id) =>
		getReferenceUri(exposedMap.get(id)!),
	);

	const collectionPage = {
		id: page
			? `${config.url}/notes/${note.id}/references?${url.query({
					page: "true",
					cursor: typeof page === "string" ? page : undefined,
				})}`
			: `${config.url}/notes/${note.id}/references`,
		type: "CollectionPage",
		next: inStock
			? `${config.url}/notes/${note.id}/references?${url.query({
					page: "true",
					cursor: pageIds.reduce((pre, cur) => (pre > cur ? pre : cur)),
				})}`
			: undefined,
		partOf: `${config.url}/notes/${note.id}/references`,
		items: renderedReferenceUrls,
	};

	return page
		? collectionPage
		: {
				id: `${config.url}/notes/${note.id}/references`,
				type: "Collection",
				first: collectionPage,
			};
}
