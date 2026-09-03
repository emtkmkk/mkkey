/**
 * ActivityPub Note モデル・取り込み
 *
 * @remarks
 * extractEmojis では licenseData を個別カラム（copyPermission, licenseName 等）に保存。補足情報は license に格納。
 */
import { IsNull } from "typeorm";
import { toStoredCopyPermission } from "@/misc/copy-permission.js";
import promiseLimit from "promise-limit";
import * as mfm from "mfm-js";
import config from "@/config/index.js";
import Resolver from "../resolver.js";
import post from "@/services/note/create.js";
import { extractMentionedUsers } from "@/services/note/create.js";
import { resolvePerson } from "./person.js";
import { resolveImage } from "./image.js";
import type {
	ILocalUser,
	CacheableRemoteUser,
} from "@/models/entities/user.js";
import { htmlToMfm } from "../misc/html-to-mfm.js";
import { extractApHashtags } from "./tag.js";
import { unique, toArray, toSingle } from "@/prelude/array.js";
import { extractPollFromQuestion, updateQuestion } from "./question.js";
import vote from "@/services/note/polls/vote.js";
import { apLogger } from "../logger.js";
import { DriveFile } from "@/models/entities/drive-file.js";
import { deliverQuestionUpdate } from "@/services/note/polls/update.js";
import { extractDbHost, toPuny } from "@/misc/convert-host.js";
import { getJson } from "@/misc/fetch.js";
import {
	Emojis,
	Polls,
	MessagingMessages,
	Notes,
	NoteEdits,
	DriveFiles,
	Instances,
	Users,
} from "@/models/index.js";
import type { IMentionedRemoteUsers, Note } from "@/models/entities/note.js";
import type { IObject, IPost } from "../type.js";
import {
	getOneApId,
	getApId,
	getOneApHrefNullable,
	validPost,
	isEmoji,
	getApType,
	isCollection,
	isCollectionOrOrderedCollection,
} from "../type.js";
import type { Emoji } from "@/models/entities/emoji.js";
import { genId } from "@/misc/gen-id.js";
import { getApLock } from "@/misc/app-lock.js";
import { createMessage } from "@/services/messages/create.js";
import { parseAudience } from "../audience.js";
import { extractApMentions } from "./mention.js";
import { referencesCollectionHasSubstance } from "@/services/note/reference-visibility.js";
import DbResolver from "../db-resolver.js";
import { StatusError } from "@/misc/fetch.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";
import { publishNoteStream } from "@/services/stream.js";
import { extractHashtags } from "@/misc/extract-hashtags.js";
import { UserProfiles } from "@/models/index.js";
import { In } from "typeorm";
import { DB_MAX_IMAGE_COMMENT_LENGTH } from "@/misc/hard-limits.js";
import { truncate } from "@/misc/truncate.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { shouldSkipIngestForDormantFollowersOnly } from "../dormant-follower-check.js";

const logger = apLogger;

export function validateNote(object: any, uri: string) {
	const expectHost = extractDbHost(uri);

	if (object == null) {
		return new Error("invalid Note: object is null");
	}

	if (!validPost.includes(getApType(object))) {
		return new Error(`invalid Note: invalid object type ${getApType(object)}`);
	}

	if (object.id && extractDbHost(object.id) !== expectHost) {
		return new Error(
			`invalid Note: id has different host. expected: ${expectHost}, actual: ${extractDbHost(
				object.id,
			)}`,
		);
	}

	if (
		object.attributedTo &&
		extractDbHost(getOneApId(object.attributedTo)) !== expectHost
	) {
		return new Error(
			`invalid Note: attributedTo has different host. expected: ${expectHost}, actual: ${extractDbHost(
				object.attributedTo,
			)}`,
		);
	}

	return null;
}

/**
 * Note を取得する。
 *
 * 対象の Note が Calckey に登録されていればそれを返す。
 */
export async function fetchNote(
	object: string | IObject,
): Promise<Note | null> {
	const dbResolver = new DbResolver();
	return await dbResolver.getNoteFromApId(object);
}

/**
 * Note を作成する。
 *
 * @param fromInbox - 受動的配信（inbox 経由）のとき true。このときのみ休眠フォロワー判定でスキップする。
 */
export async function createNote(
	value: string | IObject,
	resolver?: Resolver,
	silent = false,
	additionalTo?: ILocalUser["id"],
	fromInbox = false,
): Promise<Note | null> {
	if (resolver == null) resolver = new Resolver();

	const object: any = await resolver.resolve(value);

	const entryUri = getApId(value);
	const err = validateNote(object, entryUri);
	if (err) {
		logger.error(`${err.message}`, {
			resolver: {
				history: resolver.getHistory(),
			},
			value: value,
			object: object,
		});
		throw new Error("invalid note");
	}

	const note: IPost = object;

	if (note.id && !note.id.startsWith("https://")) {
		throw new Error(`unexpected schema of note.id: ${note.id}`);
	}

	const url = getOneApHrefNullable(note.url);

	if (url && !url.startsWith("https://")) {
		throw new Error(`unexpected schema of note url: ${url}`);
	}

	// GHSA-6w2c-vf6f-xf26 (CVE-2024-52591 の不完全修正) 対策:
	// note.url は表示用リンクとしてそのままクライアントへ渡るため、
	// note.id（= 正規の AP オブジェクト URI）と異なるホストの url を許すと、
	// 攻撃者が任意ホストへのリンクを持つ偽造ノートを連合させられる。
	// url と id のホストが一致することを検証する。
	if (url && note.id && extractDbHost(url) !== extractDbHost(note.id)) {
		throw new Error(
			`note url has different host. id host: ${extractDbHost(
				note.id,
			)}, url host: ${extractDbHost(url)}`,
		);
	}

	logger.debug(`Note fetched: ${JSON.stringify(note, null, 2)}`);
	logger.info(`Creating the Note: ${note.id}`);

	// 2007年より前の Note、または 3 日以上未来の Note はスキップ（Fedi 誕生より前／設定ミス対策）
	if (note.published) {
		const DateChecker = new Date(note.published);
		const FutureCheck = new Date();
		FutureCheck.setDate(FutureCheck.getDate() + 3); // 設定ミスしたホスト用の余裕
		if (DateChecker.getFullYear() < 2007) {
			logger.warn(
				"Note somehow made before Activitypub was created; discarding",
			);
			return null;
		}
		if (DateChecker > FutureCheck) {
			logger.warn("Note somehow made after today; discarding");
			return null;
		}
	}

	// 作者を取得
	const actor = (await resolvePerson(
		getOneApId(note.attributedTo),
		resolver,
	)) as CacheableRemoteUser;

	// 作者が凍結されている場合はスキップ
	if (actor.isSuspended) {
		logger.debug(
			`User ${actor.usernameLower}@${actor.host} suspended; discarding.`,
		);
		return null;
	}

	const noteAudience = await parseAudience(actor, note.to, note.cc);
	let visibility = noteAudience.visibility;
	let localOnly = false;

	if (note._mk_localVisibility && visibility === "followers") {
		const m = await fetchMeta();
		if (m.recommendedInstances.includes(actor.host)) {
			visibility = note._mk_localVisibility;
			localOnly = true;
		}
	}
	const visibleUsers = noteAudience.visibleUsers;
	const ccUsers = [];

	if (additionalTo) {
		const additionalUser = await Users.findOneBy({
			id: additionalTo,
			host: IsNull(),
		});
		if (
			additionalUser &&
			!visibleUsers.some((x) => x.id === additionalUser.id)
		) {
			ccUsers.push(additionalUser);
		}
	}

	// オーディエンス（to, cc）が指定されていない場合
	if (
		visibility === "specified" &&
		visibleUsers.length === 0 &&
		ccUsers.length === 0
	) {
		if (typeof value === "string") {
			// 入力が文字列の場合は resolver で GET が行われる。匿名 GET できれば公開扱い
			visibility = "public";
		}
	}

	let isTalk = note._misskey_talk && visibility === "specified";

	const apMentions = await extractApMentions(note.tag);
	const apHashtags = await extractApHashtags(note.tag);

	// 添付
	// TODO: attachmentは必ずしもImageではない
	// TODO: attachmentは必ずしも配列ではない
	// Note が sensitive なら添付も sensitive にする
	const limit = promiseLimit(2);

	note.attachment = Array.isArray(note.attachment)
		? note.attachment
		: note.attachment
			? [note.attachment]
			: [];
	const files = note.attachment.map(
		// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
		(attach) => (attach.sensitive ??= note.sensitive),
	)
		? (
			await Promise.all(
				note.attachment.map(
					(x) => limit(() => resolveImage(actor, x)) as Promise<DriveFile>,
				),
			)
		).filter((image) => image != null)
		: [];

	// 返信
	const reply: Note | null = note.inReplyTo
		? await resolveNote(note.inReplyTo, resolver)
			.then((x) => {
				if (x == null) {
					logger.warn("Specified inReplyTo, but nout found");
					throw new Error("inReplyTo not found");
				} else {
					return x;
				}
			})
			.catch(async (e) => {
				// トークだったらinReplyToのエラーは無視
				const uri = getApId(note.inReplyTo);
				if (uri.startsWith(`${config.url}/`)) {
					const id = uri.split("/").pop();
					const talk = await MessagingMessages.findOneBy({ id });
					if (talk) {
						isTalk = true;
						return null;
					}
				}

				logger.warn(
					`Error in inReplyTo ${note.inReplyTo} - ${e.statusCode || e}`,
				);
				throw e;
			})
		: null;

	// 受動的配信かつローカルフォロワーが全員休眠のリモートの公開・ホーム向け投稿は取り込まない。
	// スキップ時も throw せず null を返す。呼び出し元が "ok" を返すことで連合先に配送受理と伝え、再配送を防ぐ（迷惑防止）。
	if (
		fromInbox &&
		actor.host != null &&
		!additionalTo &&
		(visibility === "public" || visibility === "followers") &&
		visibleUsers.length === 0 &&
		(reply == null || reply.userHost != null)
	) {
		if (await shouldSkipIngestForDormantFollowersOnly(actor.id)) {
			return null;
		}
	}

	// 引用
	let quote: Note | undefined | null;

	if (note._misskey_quote || note.quoteUrl || note.quoteUri) {
		const tryResolveNote = async (
			uri: string,
		): Promise<
			| {
				status: "ok";
				res: Note | null;
			}
			| {
				status: "permerror" | "temperror";
			}
		> => {
			if (typeof uri !== "string" || !uri.match(/^https?:/)) {
				logger.warn(`ResolveNoteErr : ${uri}`);
				return { status: "permerror" };
			}
			try {
				const res = await resolveNote(uri);
				if (res) {
					return {
						status: "ok",
						res,
					};
				} else {
					logger.warn("ResolveNoteErr : !res");
					return {
						status: "permerror",
					};
				}
			} catch (e) {
				logger.warn(`ResolveNoteErr : ${JSON.stringify(e, undefined, "\t")}`);
				return {
					status:
						e instanceof StatusError && !e.isRetryable
							? "permerror"
							: "temperror",
				};
			}
		};

		const uris = unique(
			[note._misskey_quote, note.quoteUrl, note.quoteUri].filter(
				(x): x is string => typeof x === "string",
			),
		);
		const results = await Promise.all(uris.map((uri) => tryResolveNote(uri)));

		quote = results
			.filter((x): x is { status: "ok"; res: Note | null } => x.status === "ok")
			.map((x) => x.res)
			.find((x) => x);
		if (!quote) {
			if (results.some((x) => x.status === "temperror")) {
				throw new Error("quote resolve failed");
			}
		}
	}

	// 参照
	let references = new Set<Note["id"]>();
	let collectionSubstance = false;
	if (note.references) {
		// Collection オブジェクトに解決
		const collection = await resolver.resolveCollection(note.references);
		if (isCollectionOrOrderedCollection(collection)) {
			collectionSubstance = referencesCollectionHasSubstance(collection);
			// first ページ（items が空配列でも next 走査できるよう first オブジェクトで分岐）
			const firstPage = (collection as Record<string, unknown>).first;
			if (
				typeof firstPage === "object" &&
				firstPage != null &&
				!Array.isArray(firstPage)
			) {
				const firstPageObj = firstPage as Record<string, unknown>;
				let items = (
					await Promise.allSettled(
						toArray(
							firstPageObj.items as string | string[] | undefined,
						).map((x) => resolver?.resolve(x, true)),
					)
				).flatMap((result) =>
					result.status === "fulfilled" ? [result.value] : [],
				);
				let next =
					typeof firstPageObj.next === "string"
						? firstPageObj.next
						: undefined;
				while (next) {
					const pageObj = (await resolver.resolve(next)) as Record<
						string,
						unknown
					>;
					const pageItems = toArray(
						pageObj.items as string | string[] | undefined,
					);
					for (const item of pageItems) {
						items = [
							...items,
							...(
								await Promise.allSettled([
									resolver?.resolve(item, true),
								])
							).flatMap((result) =>
								result.status === "fulfilled" ? [result.value] : [],
							),
						];
					}
					next =
						typeof pageObj.next === "string" ? pageObj.next : undefined;
				}

				// Note を解決して登録
				const limit = promiseLimit<Note | null>(2);
				const referencedNotes = await Promise.all(
					items
						.filter((item) => getApType(item) === "Note") // TODO: Note でなくてもよい可能性あり
						.slice(0, 100)
						.map((item) => limit(() => resolveNote(item, resolver))),
				);
				for (const note of referencedNotes.filter((note) => note != null)) {
					references.add(note!.id);
				}
			}
		}
	}

	const cw = note.summary === "" ? null : note.summary;

	// テキスト解析
	let text: string | null = null;
	if (
		note.source?.mediaType === "text/x.misskeymarkdown" &&
		typeof note.source?.content === "string"
	) {
		text = note.source.content;
	} else if (typeof note._misskey_content !== "undefined") {
		text = note._misskey_content;
	} else if (typeof note.content === "string") {
		text = htmlToMfm(note.content, note.tag);
	}
	if (quote && text) {
		let reg = new RegExp(
			`(\n\n|^)[^\n]+${quote.uri
				? quote.uri.replaceAll("/", "\\/")
				: `${config.url}/notes/${quote.id}`.replaceAll("/", "\\/")
			}$`,
			"i",
		);
		text = text.replace(reg, "");
		if (quote.url) {
			let reg = new RegExp(
				`(\n\n|^)[^\n]+${quote.url.replaceAll("/", "\\/")}$`,
				"i",
			);
			text = text.replace(reg, "");
		}
	}
	if (references && text) {
/*
		const searchRefUrl = (_html: string | undefined): string | null => {
			let html: string | undefined = _html;
			if (!html) return null;

			html = html.replace(/<br\s?\/?>\r?\n/gi, "\n");
			html = html.replace(/\u200b:(\w+(@[\w.\-]+\.[\w.\-]+)?):\u200b/g, ":$1:");
			const dom: TreeAdapter.Node = parse5.parseFragment(html);

			const findReferenceLinkInline = (node: TreeAdapter.Node): string | null => {
				try {
					if (TreeAdapter.isElementNode(node) && node.tagName === 'span') {
						const elementNode = node;
						const classAttr = elementNode.attrs.find((attr: { name: string; }) => attr.name === 'class');
						if (classAttr?.value.includes('reference-link-inline')) {
							const anchorNode = elementNode.childNodes.find(child => TreeAdapter.isElementNode(child) && (child).tagName === 'a');
							if (anchorNode) {
								const anchorElement = anchorNode;
								const hrefAttr = anchorElement.attrs.find((attr: { name: string; }) => attr.name === 'href');
								return hrefAttr ? hrefAttr.value : null;
							}
						}
					}
					if (node.childNodes) {
						for (const childNode of node.childNodes) {
							const result = findReferenceLinkInline(childNode);
							if (result) {
								return result;
							}
						}
					}
					return null;
				} catch (e) {
					logger.warn("failed to find reference link inline", { e });
					return null
				}
			};

			return findReferenceLinkInline(dom);
		};

		const refUrl = searchRefUrl(note.content);

		if (refUrl) {
			const reg = new RegExp(
				`\\[.+?\\]\\(${refUrl.replaceAll("/", "\\/")}\\)$`,
				"i",
			);

			text = text.replace(reg, "");
		}
*/
	}

	// 投票
	if (reply?.hasPoll) {
		const poll = await Polls.findOneByOrFail({ noteId: reply.id });

		const tryCreateVote = async (
			name: string,
			index: number,
		): Promise<null> => {
			if (poll.expiresAt && Date.now() > new Date(poll.expiresAt).getTime()) {
				logger.warn(
					`vote to expired poll from AP: actor=${actor.username}@${actor.host}, note=${note.id}, choice=${name}`,
				);
			} else if (index >= 0) {
				logger.info(
					`vote from AP: actor=${actor.username}@${actor.host}, note=${note.id}, choice=${name}`,
				);
				await vote(actor, reply, index);

				// リモートフォロワーにUpdate配信
				deliverQuestionUpdate(reply.id);
			}
			return null;
		};

		if (note.name) {
			return await tryCreateVote(
				note.name,
				poll.choices.findIndex((x) => x === note.name),
			);
		}
	}

	const emojis = await extractEmojis(note.tag || [], actor.host).catch((e) => {
		logger.info(`extractEmojis: ${e}`);
		return [] as Emoji[];
	});

	const apEmojis = emojis.map((emoji) => emoji.name);

	const poll = await extractPollFromQuestion(note, resolver).catch(
		() => undefined,
	);

	if (isTalk) {
		for (const recipient of visibleUsers) {
			await createMessage(
				actor,
				recipient,
				undefined,
				text || undefined,
				files && files.length > 0 ? files[0] : null,
				object.id,
			);
			return null;
		}
		for (const recipient of ccUsers) {
			await createMessage(
				actor,
				recipient,
				undefined,
				text || undefined,
				files && files.length > 0 ? files[0] : null,
				object.id,
			);
			return null;
		}
	}

	return await post(
		actor,
		{
			createdAt: note.published ? new Date(note.published) : null,
			files,
			reply,
			renote: quote,
			references: Array.from(references),
			hasReferences: references.size > 0 || collectionSubstance,
			name: note.name,
			cw,
			text,
			localOnly,
			visibility,
			visibleUsers,
			ccUsers,
			apMentions,
			apHashtags,
			apEmojis,
			poll,
			uri: note.id,
			url: url,
		},
		silent,
	);
}

/**
 * Note を解決する。
 *
 * 対象の Note が Calckey に登録されていればそれを返し、
 * そうでなければリモートから取得して Calckey に登録して返す。
 */
export async function resolveNote(
	value: string | IObject,
	resolver?: Resolver,
): Promise<Note | null> {
	const uri = typeof value === "string" ? value : value.id;
	if (uri == null) throw new Error("missing uri");

	// 発信元ホストがブロックされていれば中止
	if (await shouldBlockInstance(extractDbHost(uri)))
		throw new StatusError(
			"host blocked",
			451,
			`host ${extractDbHost(uri)} is blocked`,
		);

	const lock = await getApLock(uri);

	try {
		//#region 既に当サーバーに登録されていれば返す
		const exist = await fetchNote(uri);

		if (exist) {
			return exist;
		}
		//#endregion

		if (uri.startsWith(config.url)) {
			throw new StatusError(
				"cannot resolve local note",
				400,
				"cannot resolve local note",
			);
		}

		// リモートから取得して登録
		// uri の代わりに付随する Note オブジェクトを渡すとサーバー取得を経ずに生成できるが、
		// 付随オブジェクトは偽装の可能性があるため、常に uri を指定してサーバーから取得する。
		return await createNote(uri, resolver, true);
	} finally {
		await lock.release();
	}
}

export async function extractEmojis(
	tags: IObject | IObject[],
	host: string,
): Promise<Emoji[]> {
	host = toPuny(host);

	if (!tags) return [];

	const eomjiTags = toArray(tags).filter(isEmoji);

	return await Promise.all(
		eomjiTags.map(async (tag) => {
			let name = tag.name!.replace(/^:/, "").replace(/:$/, "");
			tag.icon = toSingle(tag.icon);

			//タグ内にhost情報が含まれている場合はそのhostの絵文字として処理
			//含まれてない場合は
			//1 : nameに@がある場合はその後ろの文字をhostとする
			//2 : fedibirdやmarunaiさんの実装と同じ方法でhost判定を行う
			let detectHost = undefined;
			try {
				detectHost = tag.host || name.split("@")?.[1] || new URL(tag.id).host;
			} catch (err) { }

			//@以降はもう不要なので消す
			name = name.split("@")?.[0] ?? name;

			//3桁以下のホスト名は使用しない
			const _host =
				detectHost?.length >= 4 && host !== toPuny(detectHost)
					? toPuny(detectHost)
					: host;

			if (_host === config.host) {
				return (await Emojis.findOneBy({
					host: IsNull(),
					name,
				})) as Emoji;
			}

			const exists = await Emojis.findOneBy({
				host: _host,
				name,
			});

			let emojiInfo: Record<string, unknown> = {};

			let emojiInfoFlg = false;

			let licenseData = {
				license: tag.license,
				// ActivityPub 仕様は creator。後方互換のため author も受け取る
				author: tag.creator ?? tag.author,
				copyPermission: tag.copyPermission,
				usageInfo: tag.usageInfo,
				description: tag.description,
				isBasedOnUrl: tag.isBasedOnUrl,
				text: "",
			};

			//絵文字情報を取得できそうなら取得
			if (host && host === _host) {
				let beforeD7Date = new Date();
				beforeD7Date.setDate(beforeD7Date.getDate() - 7);
				if (
					!exists ||
					(exists.updatedAt || exists.createdAt) < beforeD7Date
				) {
					emojiInfoFlg = true;

					const instance = await Instances.findOneBy({ host: host });

					if (instance.maxReactionsPerAccount !== 128) {
						const apiurl = `https://${host}/api/emoji?name=${name}`;

						try {
							emojiInfo = (await getJson(
								apiurl,
								"application/json, */*",
								5000,
							)) as Record<string, unknown>;
						} catch (e) {
							logger.warn(`fetch emojiInfo err : ${e}`);
						}
					} else {
						const apiurl = `https://${host}/api/v1/pleroma/emoji`;

						try {
							const emojiJson = (
								await getJson(apiurl, "application/json, */*", 5000)
							)[name];

							const pack = emojiJson.tags
								.filter((x) => x.startsWith("pack:"))?.[0]
								?.replace("pack:", "");
							if (pack) {
								const apiurl = `https://${host}/api/v1/pleroma/emoji/pack?name=${pack}`;
								const packJson = await getJson(
									apiurl,
									"application/json, */*",
									5000,
								);
								licenseData.copyPermission = licenseData.copyPermission
									? licenseData.copyPermission
									: packJson.pack["can-download"] &&
										packJson.pack["share-flies"] !== false
										? "allow"
										: !(
											packJson.pack["can-download"] !== false ||
											packJson.pack["share-flies"]
										)
											? "deny"
											: "none";
								licenseData.license = packJson.pack["license"];
								licenseData.description = packJson.pack["description"];
								licenseData.usageInfo = packJson.pack["homepage"]
									? `pack:${pack}${(packJson["files_count"] ?? 0) > 1
										? `(${packJson["files_count"]})`
										: ""
									}\n${packJson.pack["homepage"]}${packJson.pack["fallback-src"]
										? `\n(${packJson.pack["fallback-src"]})`
										: ""
									}`
									: "";
							}

							emojiInfo = {
								category: pack || emojiJson.tags?.[0],
								aliases:
									emojiJson.tags?.length > 1
										? emojiJson.tags?.slice(1)
										: undefined,
							};

							licenseData = {
								license: tag.license || licenseData.license,
								author: tag.author || licenseData.author,
								copyPermission:
									tag.copyPermission || licenseData.copyPermission,
								usageInfo: tag.usageInfo || licenseData.usageInfo,
								description: tag.description || licenseData.description,
								isBasedOnUrl: tag.isBasedOnUrl || licenseData.isBasedOnUrl,
								text: licenseData.text,
							};
						} catch (e) {
							logger.warn(`fetch emojiInfo err : ${e}`);
						}
					}
					if (exists) {
						try {
							await Emojis.update(
								{
									host: _host,
									name,
								},
								{
									updatedAt: new Date(),
								},
							);
						} catch (e) {
							logger.warn(`fetch emojiInfo update err : ${e}`);
						}
					}
				}
			}

			const category = emojiInfo?.category
				? `${emojiInfo?.category} <${_host}>`
				: null;

			let aliases: Array<string> =
				tag.aliases || tag.keywords || emojiInfo?.aliases || [];

			const roleOnly =
				(emojiInfo?.roleIdsThatCanBeUsedThisEmojiAsReaction as Array<string>)
					?.length ||
				(emojiInfo?.roleIdsThatCanNotBeUsedThisEmojiAsReaction as Array<string>)
					?.length;

			if (roleOnly) aliases.push("ロール限定");

			/** タグの sensitive / emojiInfo.isSensitive / エイリアス「センシティブ」をフラグに変換 */
			const sensitive =
				tag.sensitive === true ||
				emojiInfo?.isSensitive === true ||
				(aliases as string[]).some(
					(a) => String(a).trim() === "センシティブ" || String(a).trim() === "sensitive",
				);
			/** フラグに一本化するため、エイリアスからは除外して保存 */
			aliases = (aliases as string[]).filter(
				(a) =>
					String(a).trim() !== "センシティブ" && String(a).trim() !== "sensitive",
			);

			const licenseText = JSON.stringify({
				...licenseData,
				emojiInfo: emojiInfo?.license,
			}).toLowerCase();

			const copydeny =
				name?.includes("no_import") ||
				name?.includes("misskey_flowers") ||
				emojiInfo?.localOnly ||
				roleOnly ||
				licenseText.includes("prohibited") ||
				licenseText.includes("連合のみ可") ||
				/(インポート|コピー|他サーバー使用：?)[\s　]*(NG|不可|禁止)/.test(
					category ?? "",
				) ||
				/(インポート|コピー|他サーバー使用：?)[\s　]*(NG|不可|禁止)/.test(
					licenseText,
				);

			const copyallow =
				/(\W|^)(public\s*domain|pd|cc0|パブリック|元ネタのみ|他サーバー使用：可)(\W|$)/.test(
					licenseText,
				);

			if (!licenseData.copyPermission && (copydeny || copyallow)) {
				licenseData.copyPermission = copydeny ? "deny" : "allow";
				licenseData.text = emojiInfo?.license;
			}

			let _aliases: Array<string> = [];

			aliases = aliases.filter((x) => x.trim());

			aliases.forEach((x) => {
				x.trim()
					.split(/[\s　]+/)
					.forEach((y) => {
						_aliases.push(y);
					});
			});

			aliases = _aliases.filter(
				(y) => y !== "センシティブ" && y !== "sensitive",
			);

			/** ライセンス補足情報（自由文）。リモートの emojiInfo?.license や licenseData.text を格納 */
			const licenseSupplement =
				(licenseData.text && licenseData.text.trim()) ||
				(typeof emojiInfo?.license === "string" ? emojiInfo.license : null) ||
				null;

			if (exists) {
				if (
					(tag.updated != null && exists.updatedAt == null) ||
					(tag.id != null && exists.uri == null) ||
					(tag.updated != null &&
						exists.updatedAt != null &&
						new Date(tag.updated) > exists.updatedAt) ||
					tag.icon!.url !== exists.originalUrl ||
					(emojiInfoFlg && category !== exists.category) ||
					(emojiInfoFlg && aliases.join(", ") !== exists.aliases.join(", ")) ||
					(emojiInfoFlg &&
						(licenseData.copyPermission !== exists.copyPermission ||
							licenseData.license !== exists.licenseName ||
							licenseData.usageInfo !== exists.usageInfo ||
							licenseData.author !== exists.creator ||
							licenseData.description !== exists.description ||
							licenseData.isBasedOnUrl !== exists.isBasedOnUrl ||
							licenseSupplement !== exists.license)) ||
					sensitive !== exists.sensitive
				) {
					let beforeD15Date = new Date();
					beforeD15Date.setDate(beforeD15Date.getDate() - 15);
					if (
						exists.createdAt &&
						exists.createdAt < beforeD15Date &&
						exists.originalUrl &&
						tag.icon!.url !== exists.originalUrl
					) {
						try {
							let lastUpdateDate = "00000000000000";
							lastUpdateDate =
								exists.createdAt.getFullYear() +
								("0" + (exists.createdAt.getMonth() + 1)).slice(-2) +
								("0" + exists.createdAt.getDate()).slice(-2) +
								("0" + exists.createdAt.getHours()).slice(-2) +
								("0" + exists.createdAt.getMinutes()).slice(-2) +
								("0" + exists.createdAt.getSeconds()).slice(-2);
							await Emojis.insert({
								...exists,
								id: genId(),
								name: `${exists.name}_${lastUpdateDate}`,
								oldEmoji: true,
							});
							await Emojis.update(
								{
									host: _host,
									name,
								},
								{
									createdAt: new Date(),
								},
							);
						} catch (err) {
							logger.warn(`backup emoji err : ${err}`);
						}
					}
					if (emojiInfoFlg) {
						await Emojis.update(
							{
								host: _host,
								name,
							},
							{
								uri: tag.id,
								originalUrl: tag.icon!.url,
								publicUrl: tag.icon!.url,
								category,
								aliases,
								copyPermission: toStoredCopyPermission(licenseData.copyPermission ?? null),
								licenseName: licenseData.license ?? null,
								usageInfo: licenseData.usageInfo ?? null,
								creator: licenseData.author ?? null,
								description: licenseData.description ?? null,
								isBasedOnUrl: licenseData.isBasedOnUrl ?? null,
								license: licenseSupplement,
								sensitive,
								updatedAt: new Date(),
							},
						);
					} else {
						await Emojis.update(
							{
								host: _host,
								name,
							},
							{
								uri: tag.id,
								originalUrl: tag.icon!.url,
								publicUrl: tag.icon!.url,
								sensitive,
								updatedAt: new Date(),
							},
						);
					}

					return (await Emojis.findOneBy({
						host: _host,
						name,
					})) as Emoji;
				}

				return exists;
			}

			logger.info(`register emoji host=${host}, name=${name}`);

			return await Emojis.insert({
				id: genId(),
				host: _host,
				name,
				uri: tag.id,
				originalUrl: tag.icon!.url,
				publicUrl: tag.icon!.url,
				createdAt: new Date(),
				updatedAt: new Date(),
				// カラムのデフォルトが private のため、リモート絵文字は明示的に public を入れる
				usageVisibility: "public",
				category,
				aliases,
				copyPermission: toStoredCopyPermission(licenseData.copyPermission ?? null),
				licenseName: licenseData.license ?? null,
				usageInfo: licenseData.usageInfo ?? null,
				creator: licenseData.author ?? null,
				description: licenseData.description ?? null,
				isBasedOnUrl: licenseData.isBasedOnUrl ?? null,
				license: licenseSupplement,
				sensitive,
			} as Partial<Emoji>).then((x) =>
				Emojis.findOneByOrFail(x.identifiers[0]),
			);
		}),
	);
}

type TagDetail = {
	type: string;
	name: string;
};

function notEmpty(partial: Partial<any>) {
	return Object.keys(partial).length > 0;
}

export async function updateNote(value: string | IObject, resolver?: Resolver) {
	const uri = typeof value === "string" ? value : value.id;
	if (!uri) throw new Error("Missing note uri");

	// URI が当サーバーを指す場合はスキップ
	if (uri.startsWith(`${config.url}/`)) throw new Error("uri points local");

	// 未指定なら新規に Resolver を作成
	if (resolver == null) resolver = new Resolver();

	// 更新された Note オブジェクトを解決
	const post = (await resolver.resolve(value)) as IPost;

	const actor = (await resolvePerson(
		getOneApId(post.attributedTo),
		resolver,
	)) as CacheableRemoteUser;

	// 既に当サーバーに登録済みか
	const note = await Notes.findOneBy({ uri });
	if (note == null) {
		return await createNote(post, resolver);
	}

	// クライアントに更新・再取得が必要であることを通知するかどうか
	let publishing = false;

	// テキスト解析
	let text: string | null = null;
	if (
		post.source?.mediaType === "text/x.misskeymarkdown" &&
		typeof post.source?.content === "string"
	) {
		text = post.source.content;
	} else if (typeof post._misskey_content !== "undefined") {
		text = post._misskey_content;
	} else if (typeof post.content === "string") {
		text = htmlToMfm(post.content, post.tag);
	}

	const cw = post.sensitive && post.summary;

	// ファイル解析
	const fileList = post.attachment
		? Array.isArray(post.attachment)
			? post.attachment
			: [post.attachment]
		: [];
	const files = fileList.map((f) => (f.sensitive = post.sensitive));

	// ファイル取得
	const limit = promiseLimit(2);

	const driveFiles = (
		await Promise.all(
			fileList.map(
				(x) =>
					limit(async () => {
						const file = await resolveImage(actor, x);
						const update: Partial<DriveFile> = {};

						const altText = truncate(x.name, DB_MAX_IMAGE_COMMENT_LENGTH);
						if (file.comment !== altText) {
							update.comment = altText;
						}

						// 既に sensitive のファイルは解除しないが、編集後の投稿に sensitive があれば更新する
						if (post.sensitive && !file.isSensitive) {
							update.isSensitive = post.sensitive;
						}

						if (notEmpty(update)) {
							await DriveFiles.update(file.id, update);
							publishing = true;
						}

						return file;
					}) as Promise<DriveFile>,
			),
		)
	).filter((file) => file != null);
	const fileIds = driveFiles.map((file) => file.id);
	const fileTypes = driveFiles.map((file) => file.type);

	const apEmojis = (
		await extractEmojis(post.tag || [], actor.host).catch((e) => [])
	).map((emoji) => emoji.name);
	const apMentions = await extractApMentions(post.tag);
	const apHashtags = await extractApHashtags(post.tag);

	const poll = await extractPollFromQuestion(post, resolver).catch(
		() => undefined,
	);

	const choices = poll?.choices.flatMap((choice) => mfm.parse(choice)) ?? [];

	const tokens = mfm
		.parse(text || "")
		.concat(mfm.parse(cw || ""))
		.concat(choices);

	const hashTags: string[] = apHashtags || extractHashtags(tokens);

	const mentionUsers =
		apMentions || (await extractMentionedUsers(actor, tokens));

	const mentionUserIds = mentionUsers.map((user) => user.id);
	const remoteUsers = mentionUsers.filter((user) => user.host != null);
	const remoteUserIds = remoteUsers.map((user) => user.id);
	const remoteProfiles = await UserProfiles.findBy({
		userId: In(remoteUserIds),
	});
	const mentionedRemoteUsers = remoteUsers.map((user) => {
		const profile = remoteProfiles.find(
			(profile) => profile.userId === user.id,
		);
		return {
			username: user.username,
			host: user.host ?? null,
			uri: user.uri,
			url: profile ? profile.url : undefined,
		} as IMentionedRemoteUsers[0];
	});

	const update = {} as Partial<Note>;
	if (text && text !== note.text) {
		update.text = text;
	}
	if (cw !== note.cw) {
		update.cw = cw ? cw : null;
	}
	if (fileIds.sort().join(",") !== note.fileIds.sort().join(",")) {
		update.fileIds = fileIds;
		update.attachedFileTypes = fileTypes;
	}

	if (hashTags.sort().join(",") !== note.tags.sort().join(",")) {
		update.tags = hashTags;
	}

	if (mentionUserIds.sort().join(",") !== note.mentions.sort().join(",")) {
		update.mentions = mentionUserIds;
		update.mentionedRemoteUsers = JSON.stringify(mentionedRemoteUsers);
	}

	if (apEmojis.sort().join(",") !== note.emojis.sort().join(",")) {
		update.emojis = apEmojis;
	}

	if (note.hasPoll !== !!poll) {
		update.hasPoll = !!poll;
	}

	if (poll) {
		const dbPoll = await Polls.findOneBy({ noteId: note.id });
		if (dbPoll == null) {
			await Polls.insert({
				noteId: note.id,
				choices: poll?.choices,
				multiple: poll?.multiple,
				votes: poll?.votes,
				expiresAt: poll?.expiresAt,
				noteVisibility: note.visibility === "hidden" ? "home" : note.visibility,
				userId: actor.id,
				userHost: actor.host,
			});
			updating = true;
		} else if (
			dbPoll.multiple !== poll.multiple ||
			dbPoll.expiresAt !== poll.expiresAt ||
			dbPoll.noteVisibility !== note.visibility ||
			JSON.stringify(dbPoll.choices) !== JSON.stringify(poll.choices)
		) {
			await Polls.update(
				{ noteId: note.id },
				{
					choices: poll?.choices,
					multiple: poll?.multiple,
					votes: poll?.votes,
					expiresAt: poll?.expiresAt,
					noteVisibility:
						note.visibility === "hidden" ? "home" : note.visibility,
				},
			);
			updating = true;
		} else {
			for (let i = 0; i < poll.choices.length; i++) {
				if (dbPoll.votes[i] !== poll.votes?.[i]) {
					await Polls.update({ noteId: note.id }, { votes: poll?.votes });
					publishing = true;
					break;
				}
			}
		}
	}

	// Note 更新
	if (notEmpty(update)) {
		update.updatedAt = new Date();

		// 更新したノートを DB に保存
		await Notes.update({ uri }, update);

		// 編集前のノートの編集履歴を保存
		await NoteEdits.insert({
			id: genId(),
			noteId: note.id,
			text: note.text,
			cw: note.cw,
			fileIds: note.fileIds,
			updatedAt: update.updatedAt,
		});

		publishing = true;
	}

	if (publishing) {
		// 更新されたノート詳細の更新イベントを配信
		publishNoteStream(note.id, "updated", {
			updatedAt: update.updatedAt,
		});
	}
}
