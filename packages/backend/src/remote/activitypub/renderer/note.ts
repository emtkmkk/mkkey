/**
 * @packageDocumentation
 *
 * ActivityPub 向けにローカルノートを AS2 オブジェクトへレンダリングする。
 *
 * @remarks
 * 投票付きノートは `Question` 相当の形で `oneOf` / `anyOf` に各選択肢全文を載せる。選択肢が長いとペイロードが肥大し、他実装が拒否する可能性がある（API 側の短い上限とは別問題）。
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

	if (remoteFollowerOnly) {
		to = [`${attributedTo}/followers`];
		cc = mentions;
	} else if (note.visibility === "public") {
		to = ["https://www.w3.org/ns/activitystreams#Public"];
		cc = [`${attributedTo}/followers`].concat(mentions);
	} else if (note.visibility === "home") {
		to = [`${attributedTo}/followers`];
		cc = ["https://www.w3.org/ns/activitystreams#Public"].concat(mentions);
	} else if (note.visibility === "followers") {
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

	if (
		/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/.test(note.cw ?? "") ||
		/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/.test(note.text ?? "")
	) {
		// 他鯖絵文字が入っている場合、外部には@以下をトリミングして配信する
		if (note.cw)
			note.cw = note.cw?.replaceAll(
				/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/gi,
				":$1:",
			);
		if (note.text)
			note.text = note.text?.replaceAll(
				/:([a-z0-9_+-]+)(@[a-z0-9_+-.]*):/gi,
				":$1:",
			);
		if (note.emojis)
			note.emojis = note.emojis?.map((x) =>
				x.replaceAll(/^([a-z0-9_+-]+)(@[a-z0-9_+-.]*)$/gi, "$1"),
			);
		if (note.cw && !note.cw.includes("投稿に連合先表示不可の絵文字") && !note.cw.includes("投稿にリモート表示不可の絵文字")) {
			note.cw = "投稿に連合先表示不可の絵文字が含まれます " + note.cw;
		} else {
			note.cw = "投稿に連合先表示不可の絵文字が含まれます";
		}
	}

	let text = note.text ?? "";
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

	const summary = note.cw === "" ? String.fromCharCode(0x200b) : note.cw;

	const content = toHtml(
		Object.assign({}, note, {
			text: apText,
		}),
	);

	const emojis = await getEmojis(note.emojis);
	const apemojis = emojis.map((emoji) => renderEmoji(emoji));

	const tag = [...hashtagTags, ...mentionTags, ...apemojis];

	const asPoll = poll
		? {
			type: "Question",
			content: toHtml(
				Object.assign({}, note, {
					text: text,
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
		sensitive: note.cw != null || files.some((file) => file.isSensitive),
		tag,
		references: await getReferences(note),
		...asPoll,
		...asTalk,
		_mk_localVisibility: remoteFollowerOnly ? note.visibility : undefined,
	};
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
