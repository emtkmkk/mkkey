/**
 * @packageDocumentation
 *
 * ActivityPub の Person（Actor）の取得・作成・更新・解決
 *
 * @remarks
 * - **役割**: リモートユーザーを AP Person から DB に作成・更新し、inbox や resolve で利用する。
 *
 * @see {@link remote/resolve-user} リモートユーザー解決
 * @internal
 */
import { URL } from "node:url";
import promiseLimit from "promise-limit";

import config from "@/config/index.js";
import { registerOrFetchInstanceDoc } from "@/services/register-or-fetch-instance-doc.js";
import type { Note } from "@/models/entities/note.js";
import { updateUsertags } from "@/services/update-hashtag.js";
import {
	Users,
	Instances,
	DriveFiles,
	Followings,
	UserProfiles,
	UserPublickeys,
} from "@/models/index.js";
import type { IRemoteUser, CacheableUser } from "@/models/entities/user.js";
import { User } from "@/models/entities/user.js";
import type { Emoji } from "@/models/entities/emoji.js";
import { UserNotePining } from "@/models/entities/user-note-pining.js";
import { genId } from "@/misc/gen-id.js";
import { instanceChart, usersChart } from "@/services/chart/index.js";
import { UserPublickey } from "@/models/entities/user-publickey.js";
import { isDuplicateKeyValueError } from "@/misc/is-duplicate-key-value-error.js";
import { toPuny, extractDbHost } from "@/misc/convert-host.js";
import { UserProfile } from "@/models/entities/user-profile.js";
import { toArray } from "@/prelude/array.js";
import { fetchInstanceMetadata } from "@/services/fetch-instance-metadata.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import { truncate } from "@/misc/truncate.js";
import { StatusError, getJson, getResponse } from "@/misc/fetch.js";
import { uriPersonCache } from "@/services/user-cache.js";
import { publishInternalEvent } from "@/services/stream.js";
import { db } from "@/db/postgre.js";
import { apLogger } from "../logger.js";
import { htmlToMfm } from "../misc/html-to-mfm.js";
import { fromHtml } from "../../../mfm/from-html.js";
import type { IActor, IObject, IApPropertyValue } from "../type.js";
import {
	isCollectionOrOrderedCollection,
	isCollection,
	getApId,
	getOneApHrefNullable,
	isPropertyValue,
	getApType,
	isActor,
} from "../type.js";
import Resolver from "../resolver.js";
import { extractApHashtags } from "./tag.js";
import { resolveNote, extractEmojis } from "./note.js";
import { resolveImage } from "./image.js";

const logger = apLogger;

const nameLength = 128;
const summaryLength = 8192;

/**
 * 取得したオブジェクトを検証し Actor に変換する
 * @param x 取得したオブジェクト
 * @param uri 取得対象 URI
 */
function validateActor(x: IObject, uri: string): IActor {
	const expectHost = toPuny(new URL(uri).hostname);

	if (x == null) {
		throw new Error("invalid Actor: object is null");
	}

	if (!isActor(x)) {
		throw new Error(`invalid Actor type '${x.type}'`);
	}

	if (!(typeof x.id === "string" && x.id.length > 0)) {
		throw new Error("invalid Actor: wrong id");
	}

	if (!(typeof x.inbox === "string" && x.inbox.length > 0)) {
		throw new Error("invalid Actor: wrong inbox");
	}

	if (
		!(
			typeof x.preferredUsername === "string" &&
			x.preferredUsername.length > 0 &&
			x.preferredUsername.length <= 128 &&
			/^\w([\w-.]*\w)?$/.test(x.preferredUsername)
		)
	) {
		throw new Error("invalid Actor: wrong username");
	}

	// これらのフィールドは情報用で、AP 実装によっては非常に長い値を許容する。長すぎる場合は切り詰める
	if (x.name) {
		if (!(typeof x.name === "string" && x.name.length > 0)) {
			throw new Error("invalid Actor: wrong name");
		}
		x.name = truncate(x.name, nameLength);
	}
	if (x.summary) {
		if (!(typeof x.summary === "string" && x.summary.length > 0)) {
			throw new Error("invalid Actor: wrong summary");
		}
		x.summary = truncate(x.summary, summaryLength);
	}

	const idHost = toPuny(new URL(x.id!).hostname);
	if (idHost !== expectHost) {
		throw new Error("invalid Actor: id has different host");
	}

	if (x.publicKey) {
		if (typeof x.publicKey.id !== "string") {
			throw new Error("invalid Actor: publicKey.id is not a string");
		}

		const publicKeyIdHost = toPuny(new URL(x.publicKey.id).hostname);
		if (publicKeyIdHost !== expectHost) {
			throw new Error("invalid Actor: publicKey.id has different host");
		}
	}

	// GHSA-m2gq-69fp-6hv4 / GHSA-7vgr-p3vc-p4h2 対策:
	// inbox/outbox/followers/following 等のエンドポイント URL は、AP の仕様上
	// Actor 本体（id）と同一ホストに存在するはず。別ホストの URL を許すと、
	// 配送先の乗っ取りやリモートアカウントのなりすましに繋がるため、
	// 文字列で指定されている場合はホスト一致を検証する。
	// （movedTo / alsoKnownAs はアカウント移行で別ホストを指すため対象外）
	const validateActorUrlHost = (value: unknown, fieldName: string): void => {
		if (typeof value !== "string" || value.length === 0) return;
		let fieldHost: string;
		try {
			fieldHost = toPuny(new URL(value).hostname);
		} catch {
			throw new Error(`invalid Actor: ${fieldName} is not a valid URL`);
		}
		if (fieldHost !== expectHost) {
			throw new Error(`invalid Actor: ${fieldName} has different host`);
		}
	};

	validateActorUrlHost(x.inbox, "inbox");
	validateActorUrlHost((x as any).sharedInbox, "sharedInbox");
	validateActorUrlHost((x as any).endpoints?.sharedInbox, "endpoints.sharedInbox");
	validateActorUrlHost((x as any).outbox, "outbox");
	validateActorUrlHost((x as any).followers, "followers");
	validateActorUrlHost((x as any).following, "following");

	return x;
}

/**
 * Person を取得する。
 *
 * 対象の Person が Calckey に登録されていればそれを返す。
 */
export async function fetchPerson(
	uri: string,
	resolver?: Resolver,
): Promise<CacheableUser | null> {
	if (typeof uri !== "string") throw new Error("uri is not string");

	const cached = uriPersonCache.get(uri);
	if (cached) return cached;

	// URI が当サーバーを指す場合は DB から取得
	if (uri.startsWith(`${config.url}/`)) {
		const id = uri.split("/").pop();
		const u = await Users.findOneBy({ id });
		if (u) uriPersonCache.set(uri, u);
		return u;
	}

	//#region 既に当サーバーに登録されていれば返す
	const exist = await Users.findOneBy({ uri });

	if (exist) {
		uriPersonCache.set(uri, exist);
		return exist;
	}
	//#endregion

	return null;
}

/**
 * Person を作成する。
 */
export async function createPerson(
	uri: string,
	resolver?: Resolver,
): Promise<User> {
	if (typeof uri !== "string") throw new Error("uri is not string");

	if (uri.startsWith(config.url)) {
		throw new StatusError(
			"cannot resolve local user",
			400,
			"cannot resolve local user",
		);
	}

	if (resolver == null) resolver = new Resolver();

	const object = (await resolver.resolve(uri)) as any;

	const person = validateActor(object, uri);

	logger.info(`Creating the Person: ${person.id}`);

	const host = toPuny(new URL(object.id).hostname);

	let { fields } = analyzeAttachments(person.attachment || []);

	if (host === "misskey.io") {
		try {
			let userInfo = await (
				await getResponse({
					url: `https://${host}/api/users/search-by-username-and-host`,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"User-Agent": config.userAgent,
						Accept: "application/json, */*",
					},
					body: JSON.stringify({
						username: person.preferredUsername,
						host,
					}),
					timeout: 5000,
				})
			).json();
			if (Array.isArray(userInfo) && userInfo.length > 1) {
				userInfo = userInfo.filter(
					(x) =>
						person.preferredUsername?.toLowerCase() ===
						x.username.toLowerCase(),
				);
			}
			if (Array.isArray(userInfo) && userInfo.length === 1 && userInfo[0].id) {
				const skebInfo = (await getJson(
					`https://${host}/api/users/get-skeb-status?userId=${userInfo[0].id}`,
					"application/json, */*",
					5000,
				)) as Record<string, unknown>;
				if (skebInfo) {
					let status = "";

					if (skebInfo.isAcceptable || skebInfo.isCreator) {
						if (
							skebInfo.isAcceptable &&
							Array.isArray(skebInfo.skills) &&
							skebInfo.skills.length > 0
						) {
							const amounts = new Map<string, string>();
							const amounts_n = new Map<string, number>();
							for (const skill of skebInfo.skills) {
								if (skill !== null && typeof skill.amount === "number") {
									const genre = getSkebGenreIcon(skill.genre);
									const str = `${Math.ceil(skill.amount / 100) / 10}k`;
									amounts.set(str, (amounts.get(str) ?? "") + genre);
									amounts_n.set(str, (amounts_n.get(str) ?? 0) + 1);
								}
							}
							if (amounts.size >= 1) {
								status += `${amounts.get(Array.from(amounts.keys())[0])} ${
									Array.from(amounts.keys())[0]
								}`;
								if (amounts.size === 2) {
									status += ` ${amounts.get(Array.from(amounts.keys())[1])} ${
										Array.from(amounts.keys())[1]
									}`;
								} else if (amounts.size > 2 && amounts_n.size > 0) {
									status += ` (+${
										skebInfo.skills.length -
										(amounts_n.get(Array.from(amounts_n.keys())[0]) ?? 1)
									})`;
								}
							}
						}
						if (
							typeof skebInfo.creatorRequestCount === "number" &&
							skebInfo.creatorRequestCount > 0
						) {
							if (skebInfo.isAcceptable) {
								status += " | ";
							}
							status += `${skebInfo.creatorRequestCount.toLocaleString()}件`;
						}
						if (
							fields?.length >= 16 &&
							fields.filter((x) => !x.name.toLowerCase().includes("skeb"))
								.length < 16
						) {
							fields = fields.filter(
								(x) => !x.name.toLowerCase().includes("skeb"),
							);
						}
						if (fields?.length < 16) {
							fields.push({
								name: "★Skeb",
								value: `[${skebInfo.isAcceptable ? "募集中" : "停止中"}${
									status ? ` ${status}` : ""
								}](https://skeb.jp/@${skebInfo.screenName})`,
							});
						}
					} else {
						if (
							typeof skebInfo.clientRequestCount === "number" &&
							skebInfo.clientRequestCount > 0
						) {
							status = `${skebInfo.clientRequestCount.toLocaleString()}件`;
							if (
								fields?.length >= 16 &&
								fields.filter((x) => !x.name.toLowerCase().includes("skeb"))
									.length < 16
							) {
								fields = fields.filter(
									(x) => !x.name.toLowerCase().includes("skeb"),
								);
							}
							if (fields?.length < 16) {
								fields.push({
									name: "★Skeb",
									value: `[クライアント${
										status ? ` ${status}` : ""
									}](https://skeb.jp/@${skebInfo.screenName})`,
								});
							}
						}
					}
				}
			}
		} catch (e) {
			logger.warn(`fetch AddUserInfo err : ${e}`);
		}
	}

	const tags = extractApHashtags(person.tag)
		.map((tag) => normalizeForSearch(tag))
		.splice(0, 32);

	const isBot = getApType(object) !== "Person";

	const bday = person["vcard:bday"]?.match(/^\d{4}-\d{2}-\d{2}/);

	const url = getOneApHrefNullable(person.url);

	if (url && !url.startsWith("https://")) {
		throw new Error(`unexpected schema of person url: ${url}`);
	}

	// GHSA-m2gq-69fp-6hv4 対策: person.url はプロフィールリンクとしてそのまま
	// クライアントへ渡るため、id（正規の Actor URI）と異なるホストの url を
	// 許すと、なりすましプロフィールから任意ホストへ誘導できてしまう。
	if (url && person.id && extractDbHost(url) !== extractDbHost(person.id)) {
		throw new Error(
			`person url has different host. id host: ${extractDbHost(
				person.id,
			)}, url host: ${extractDbHost(url)}`,
		);
	}

	let followersCount: number | undefined;

	if (typeof person.followers === "string") {
		try {
			let data = await fetch(person.followers, {
				headers: { Accept: "application/json" },
			});
			let json_data = JSON.parse(await data.text());

			followersCount = json_data.totalItems;
		} catch {
			followersCount = undefined;
		}
	}

	let followingCount: number | undefined;

	if (typeof person.following === "string") {
		try {
			let data = await fetch(person.following, {
				headers: { Accept: "application/json" },
			});
			let json_data = JSON.parse(await data.text());

			followingCount = json_data.totalItems;
		} catch (e) {
			followingCount = undefined;
		}
	}

	let notesCount: number | undefined;

	if (typeof person.outbox === "string") {
		try {
			let data = await fetch(person.outbox, {
				headers: { Accept: "application/json" },
			});
			let json_data = JSON.parse(await data.text());

			notesCount = json_data.totalItems;
		} catch (e) {
			notesCount = undefined;
		}
	}

	let _description: string | null = null;

	if (person._misskey_summary) {
		_description = truncate(person._misskey_summary, summaryLength);
	} else if (person.summary) {
		_description = htmlToMfm(
			truncate(person.summary, summaryLength),
			person.tag,
		);
	}

	// ユーザー作成
	let user: IRemoteUser;
	try {
		// トランザクション開始
		await db.transaction(async (transactionalEntityManager) => {
			user = (await transactionalEntityManager.save(
				new User({
					id: genId(),
					avatarId: null,
					bannerId: null,
					createdAt: new Date(),
					lastFetchedAt: new Date(),
					name: truncate(person.name, nameLength),
					isLocked: !!person.manuallyApprovesFollowers,
					movedToUri: person.movedTo,
					alsoKnownAs: person.alsoKnownAs,
					isExplorable: !!person.discoverable,
					username: person.preferredUsername,
					usernameLower: person.preferredUsername!.toLowerCase(),
					host,
					inbox: person.inbox,
					sharedInbox:
						person.sharedInbox ||
						(person.endpoints ? person.endpoints.sharedInbox : undefined),
					followersUri: person.followers
						? getApId(person.followers)
						: undefined,
					followersCount:
						followersCount !== undefined
							? followersCount
							: person.followers &&
							  typeof person.followers !== "string" &&
							  isCollectionOrOrderedCollection(person.followers)
							? person.followers.totalItems
							: undefined,
					followingCount:
						followingCount !== undefined
							? followingCount
							: person.following &&
							  typeof person.following !== "string" &&
							  isCollectionOrOrderedCollection(person.following)
							? person.following.totalItems
							: undefined,
					notesCount:
						notesCount !== undefined
							? notesCount
							: person.outbox &&
							  typeof person.outbox !== "string" &&
							  isCollectionOrOrderedCollection(person.outbox)
							? person.outbox.totalItems
							: undefined,
					featured: person.featured ? getApId(person.featured) : undefined,
					uri: person.id,
					tags,
					isBot,
					isCat: (person as any).isCat === true,
					showTimelineReplies: false,
				}),
			)) as IRemoteUser;

			await transactionalEntityManager.save(
				new UserProfile({
					userId: user.id,
					description: _description,
					url: url,
					fields,
					birthday: bday ? bday[0] : null,
					location: person["vcard:Address"] || null,
					userHost: host,
					followedMessage: person._misskey_followedMessage != null ? truncate(person._misskey_followedMessage, 256) : null,
				}),
			);

			if (person.publicKey) {
				await transactionalEntityManager.save(
					new UserPublickey({
						userId: user.id,
						keyId: person.publicKey.id,
						keyPem: person.publicKey.publicKeyPem,
					}),
				);
			}
		});
	} catch (e) {
		// 重複キーエラー
		if (isDuplicateKeyValueError(e)) {
			// /users/@a => /users/:id のようなエイリアス入力で発生しうるエラーに対応
			const u = await Users.findOneBy({
				uri: person.id,
			});

			if (u) {
				user = u as IRemoteUser;
			} else {
				throw new Error("already registered");
			}
		} else {
			logger.error(e instanceof Error ? e : new Error(e as string));
			throw e;
		}
	}

	// ホスト登録
	registerOrFetchInstanceDoc(host).then((i) => {
		Instances.increment({ id: i.id }, "usersCount", 1);
		instanceChart.newUser(i.host);
		fetchInstanceMetadata(i);
	});

	usersChart.update(user!, true);

	// ハッシュタグ更新
	updateUsertags(user!, tags);

	//#region アバター・ヘッダー画像の取得
	const [avatar, banner] = await Promise.all(
		[person.icon, person.image].map((img) =>
			img == null
				? Promise.resolve(null)
				: resolveImage(user!, img).catch(() => null),
		),
	);

	const avatarId = avatar ? avatar.id : null;
	const bannerId = banner ? banner.id : null;

	await Users.update(user!.id, {
		avatarId,
		bannerId,
	});

	user!.avatarId = avatarId;
	user!.bannerId = bannerId;
	//#endregion

	//#region カスタム絵文字取得
	const emojis = await extractEmojis(person.tag || [], host).catch((e) => {
		logger.info(`extractEmojis: ${e}`);
		return [] as Emoji[];
	});

	const emojiNames = emojis.map((emoji) => emoji.name);

	await Users.update(user!.id, {
		emojis: emojiNames,
	});
	//#endregion

	await updateFeatured(user!.id, resolver).catch((err) => logger.error(err));

	return user!;
}

/**
 * リモートから Person データを更新する。
 * 対象の Person が Calckey に登録されていなければ何もしない。
 * @param uri Person の URI
 * @param resolver Resolver
 * @param hint Person オブジェクトのヒント（有効な Person ならリモート解決なしで更新に使用）
 */
export async function updatePerson(
	uri: string,
	resolver?: Resolver | null,
	hint?: IObject,
): Promise<void> {
	if (typeof uri !== "string") throw new Error("uri is not string");

	// URI が当サーバーを指す場合はスキップ
	if (uri.startsWith(`${config.url}/`)) {
		return;
	}

	//#region 既に当サーバーに登録済みか
	const exist = (await Users.findOneBy({ uri })) as IRemoteUser;

	if (exist == null) {
		return;
	}
	//#endregion

	if (resolver == null) resolver = new Resolver();

	const object = hint || (await resolver.resolve(uri));

	const person = validateActor(object, uri);

	logger.info(`Updating the Person: ${person.id}`);

	// アバター・ヘッダー画像を取得
	const [avatar, banner] = await Promise.all(
		[person.icon, person.image].map((img) =>
			img == null
				? Promise.resolve(null)
				: resolveImage(exist, img).catch(() => null),
		),
	);

	// カスタム絵文字取得
	const emojis = await extractEmojis(person.tag || [], exist.host).catch(
		(e) => {
			logger.info(`extractEmojis: ${e}`);
			return [] as Emoji[];
		},
	);

	const emojiNames = emojis.map((emoji) => emoji.name);

	let { fields } = analyzeAttachments(person.attachment || []);

	const host = exist.host;

	if (host === "misskey.io") {
		try {
			let userInfo = await (
				await getResponse({
					url: `https://${host}/api/users/search-by-username-and-host`,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"User-Agent": config.userAgent2 ?? config.userAgent,
						Accept: "application/json, */*",
					},
					body: JSON.stringify({
						username: person.preferredUsername,
						host,
					}),
					timeout: 5000,
				})
			).json();
			if (Array.isArray(userInfo) && userInfo.length > 1) {
				userInfo = userInfo.filter(
					(x) =>
						person.preferredUsername?.toLowerCase() ===
						x.username.toLowerCase(),
				);
			}
			if (Array.isArray(userInfo) && userInfo.length === 1 && userInfo[0].id) {
				const skebInfo = (await getJson(
					`https://${host}/api/users/get-skeb-status?userId=${userInfo[0].id}`,
					"application/json, */*",
					5000,
					{"User-Agent": config.userAgent2 ?? config.userAgent},
				)) as Record<string, unknown>;
				if (skebInfo) {
					let status = "";

					if (skebInfo.isAcceptable || skebInfo.isCreator) {
						if (
							skebInfo.isAcceptable &&
							Array.isArray(skebInfo.skills) &&
							skebInfo.skills.length > 0
						) {
							const amounts = new Map<string, string>();
							const amounts_n = new Map<string, number>();
							for (const skill of skebInfo.skills) {
								if (skill !== null && typeof skill.amount === "number") {
									const genre = getSkebGenreIcon(skill.genre);
									const str = `${Math.ceil(skill.amount / 100) / 10}k`;
									amounts.set(str, (amounts.get(str) ?? "") + genre);
									amounts_n.set(str, (amounts_n.get(str) ?? 0) + 1);
								}
							}
							if (amounts.size >= 1) {
								status += `${amounts.get(Array.from(amounts.keys())[0])} ${
									Array.from(amounts.keys())[0]
								}`;
								if (amounts.size === 2) {
									status += ` ${amounts.get(Array.from(amounts.keys())[1])} ${
										Array.from(amounts.keys())[1]
									}`;
								} else if (amounts.size > 2 && amounts_n.size > 0) {
									status += ` (+${
										skebInfo.skills.length -
										(amounts_n.get(Array.from(amounts_n.keys())[0]) ?? 1)
									})`;
								}
							}
						}
						if (
							typeof skebInfo.creatorRequestCount === "number" &&
							skebInfo.creatorRequestCount > 0
						) {
							if (skebInfo.isAcceptable) {
								status += " | ";
							}
							status += `${skebInfo.creatorRequestCount.toLocaleString()}件`;
						}
						if (
							fields?.length >= 16 &&
							fields.filter((x) => !x.name.toLowerCase().includes("skeb"))
								.length < 16
						) {
							fields = fields.filter(
								(x) => !x.name.toLowerCase().includes("skeb"),
							);
						}
						if (fields?.length < 16) {
							fields.push({
								name: "Skeb(自動)",
								value: `[${skebInfo.isAcceptable ? "$[border.radius=5,color=FFF $[bg.color=F14668 $[fg.color=FFF  募集中 ]]]" : "$[border.radius=5,color=FFF $[bg.color=363636 $[fg.color=FFF  停止中 ]]]"}${
									status ? ` ${status}` : ""
								}](https://skeb.jp/@${skebInfo.screenName})`,
							});
						}
					} else {
						if (
							typeof skebInfo.clientRequestCount === "number" &&
							skebInfo.clientRequestCount > 0
						) {
							status = `${skebInfo.clientRequestCount.toLocaleString()}件`;
							if (
								fields?.length >= 16 &&
								fields.filter((x) => !x.name.toLowerCase().includes("skeb"))
									.length < 16
							) {
								fields = fields.filter(
									(x) => !x.name.toLowerCase().includes("skeb"),
								);
							}
							if (fields?.length < 16) {
								fields.push({
									name: "Skeb(自動)",
									value: `[$[border.radius=5,color=FFF $[bg.color=363636 $[fg.color=FFF  クライアント ]]]${
										status ? ` ${status}` : ""
									}](https://skeb.jp/@${skebInfo.screenName})`,
								});
							}
						}
					}
				}
			}
		} catch (e) {
			logger.warn(`fetch AddUserInfo err : ${e}`);
		}
	}

	const tags = extractApHashtags(person.tag)
		.map((tag) => normalizeForSearch(tag))
		.splice(0, 32);

	const bday = person["vcard:bday"]?.match(/^\d{4}-\d{2}-\d{2}/);

	const url = getOneApHrefNullable(person.url);

	if (url && !url.startsWith("https://")) {
		throw new Error(`unexpected schema of person url: ${url}`);
	}

	// GHSA-m2gq-69fp-6hv4 対策: person.url はプロフィールリンクとしてそのまま
	// クライアントへ渡るため、id（正規の Actor URI）と異なるホストの url を
	// 許すと、なりすましプロフィールから任意ホストへ誘導できてしまう。
	if (url && person.id && extractDbHost(url) !== extractDbHost(person.id)) {
		throw new Error(
			`person url has different host. id host: ${extractDbHost(
				person.id,
			)}, url host: ${extractDbHost(url)}`,
		);
	}

	let followersCount: number | undefined;

	if (typeof person.followers === "string") {
		try {
			let data = await fetch(person.followers, {
				headers: { Accept: "application/json" },
			});
			let json_data = JSON.parse(await data.text());

			followersCount = json_data.totalItems;
		} catch {
			followersCount = undefined;
		}
	}

	let followingCount: number | undefined;

	if (typeof person.following === "string") {
		try {
			let data = await fetch(person.following, {
				headers: { Accept: "application/json" },
			});
			let json_data = JSON.parse(await data.text());

			followingCount = json_data.totalItems;
		} catch {
			followingCount = undefined;
		}
	}

	let notesCount: number | undefined;

	if (typeof person.outbox === "string") {
		try {
			let data = await fetch(person.outbox, {
				headers: { Accept: "application/json" },
			});
			let json_data = JSON.parse(await data.text());

			notesCount = json_data.totalItems;
		} catch (e) {
			notesCount = undefined;
		}
	}

	let _description: string | null = null;

	if (person._misskey_summary) {
		_description = truncate(person._misskey_summary, summaryLength);
	} else if (person.summary) {
		_description = htmlToMfm(
			truncate(person.summary, summaryLength),
			person.tag,
		);
	}

	const updates = {
		lastFetchedAt: new Date(),
		inbox: person.inbox,
		sharedInbox:
			person.sharedInbox ||
			(person.endpoints ? person.endpoints.sharedInbox : undefined),
		followersUri: person.followers ? getApId(person.followers) : undefined,
		followersCount:
			followersCount !== undefined
				? followersCount
				: person.followers &&
				  typeof person.followers !== "string" &&
				  isCollectionOrOrderedCollection(person.followers)
				? person.followers.totalItems
				: undefined,
		followingCount:
			followingCount !== undefined
				? followingCount
				: person.following &&
				  typeof person.following !== "string" &&
				  isCollectionOrOrderedCollection(person.following)
				? person.following.totalItems
				: undefined,
		notesCount:
			notesCount !== undefined
				? notesCount
				: person.outbox &&
				  typeof person.outbox !== "string" &&
				  isCollectionOrOrderedCollection(person.outbox)
				? person.outbox.totalItems
				: undefined,
		featured: person.featured,
		emojis: emojiNames,
		name: truncate(person.name, nameLength),
		tags,
		isBot: getApType(object) !== "Person",
		isCat: (person as any).isCat === true,
		isLocked: !!person.manuallyApprovesFollowers,
		movedToUri: person.movedTo || null,
		alsoKnownAs: person.alsoKnownAs || null,
		isExplorable: !!person.discoverable,
		isDeleted: false,
	} as Partial<User>;

	if (avatar) {
		updates.avatarId = avatar.id;
	}

	if (banner) {
		updates.bannerId = banner.id;
	}

	// ユーザー更新
	await Users.update(exist.id, updates);

	if (person.publicKey) {
		await UserPublickeys.update(
			{ userId: exist.id },
			{
				keyId: person.publicKey.id,
				keyPem: person.publicKey.publicKeyPem,
			},
		);
	}

	await UserProfiles.update(
		{ userId: exist.id },
		{
			url: url,
			fields,
			description: _description,
			birthday: bday ? bday[0] : null,
			location: person["vcard:Address"] || null,
			followedMessage: person._misskey_followedMessage != null ? truncate(person._misskey_followedMessage, 256) : null,
		},
	);

	publishInternalEvent("remoteUserUpdated", { id: exist.id });

	// ハッシュタグ更新
	updateUsertags(exist, tags);

	// 対象ユーザーがフォロワーである場合、フォロワー情報も更新する
	await Followings.update(
		{
			followerId: exist.id,
		},
		{
			followerSharedInbox:
				person.sharedInbox ||
				(person.endpoints ? person.endpoints.sharedInbox : null),
		},
	);

	await updateFeatured(exist.id, resolver).catch((err) => logger.error(err));
}

/**
 * Person を解決する。
 *
 * 対象が Calckey に登録されていればそれを返し、
 * そうでなければリモートから取得して Calckey に登録して返す。
 */
export async function resolvePerson(
	uri: string,
	resolver?: Resolver,
): Promise<CacheableUser> {
	if (typeof uri !== "string") throw new Error("uri is not string");

	//#region 既に当サーバーに登録されていれば返す
	const exist = await fetchPerson(uri);

	if (exist) {
		return exist;
	}
	//#endregion

	// リモートから取得して登録
	if (resolver == null) resolver = new Resolver();
	return await createPerson(uri, resolver);
}

const services: {
	[x: string]: (id: string, username: string) => any;
} = {
	"misskey:authentication:twitter": (userId, screenName) => ({
		userId,
		screenName,
	}),
	"misskey:authentication:github": (id, login) => ({ id, login }),
	"misskey:authentication:discord": (id, name) => $discord(id, name),
};

const $discord = (id: string, name: string) => {
	if (typeof name !== "string") {
		name = "unknown#0000";
	}
	const [username, discriminator] = name.split("#");
	return { id, username, discriminator };
};

function addService(target: { [x: string]: any }, source: IApPropertyValue) {
	const service = services[source.name];

	if (typeof source.value !== "string") {
		source.value = "unknown";
	}

	const [id, username] = source.value.split("@");

	if (service) {
		target[source.name.split(":")[2]] = service(id, username);
	}
}

export function analyzeAttachments(
	attachments: IObject | IObject[] | undefined,
) {
	const fields: {
		name: string;
		value: string;
	}[] = [];
	const services: { [x: string]: any } = {};

	if (Array.isArray(attachments)) {
		for (const attachment of attachments.filter(isPropertyValue)) {
			if (isPropertyValue(attachment.identifier)) {
				addService(services, attachment.identifier);
			} else {
				fields.push({
					name: attachment.name,
					value: fromHtml(attachment.value),
				});
			}
		}
	}

	return { fields, services };
}

export async function updateFeatured(userId: User["id"], resolver?: Resolver) {
	const user = await Users.findOneByOrFail({ id: userId });
	if (!Users.isRemoteUser(user)) return;
	if (!user.featured) return;

	logger.info(`Updating the featured: ${user.uri}`);

	if (resolver == null) resolver = new Resolver();

	// (Ordered)Collection オブジェクトに解決
	const collection = await resolver.resolveCollection(user.featured);
	if (!isCollectionOrOrderedCollection(collection))
		throw new Error("Object is not Collection or OrderedCollection");

	// オブジェクト（Note 等）の配列に解決
	const unresolvedItems = isCollection(collection)
		? collection.items
		: collection.orderedItems;
	const items = await Promise.all(
		toArray(unresolvedItems).map((x) => resolver?.resolve(x)),
	);

	// Note を解決して登録
	const limit = promiseLimit<Note | null>(2);
	const featuredNotes = await Promise.all(
		items
			.filter((item) => getApType(item) === "Note") // TODO: Note でなくてもよい可能性あり
			.slice(0, 50)
			.map((item) => limit(() => resolveNote(item, resolver))),
	);

        await db.transaction(async (transactionalEntityManager) => {
                await transactionalEntityManager.delete(UserNotePining, {
                        userId: user.id,
                });

                // 現状は別時刻で ID を生成して順序を維持する
                let td = 0;
                const insertedNoteIds = new Set<string>();
                for (const note of featuredNotes.filter((note) => note != null)) {
                        if (insertedNoteIds.has(note!.id)) continue;
                        insertedNoteIds.add(note!.id);

                        td -= 1000;
                        const id = genId(new Date(Date.now() + td));
                        const createdAt = new Date();

                        try {
                                await transactionalEntityManager.insert(UserNotePining, {
                                        id,
                                        createdAt,
                                        userId: user.id,
                                        noteId: note!.id,
                                });
                        } catch (err) {
                                if (isDuplicateKeyValueError(err)) {
                                        await transactionalEntityManager.update(
                                                UserNotePining,
                                                {
                                                        userId: user.id,
                                                        noteId: note!.id,
                                                },
                                                {
                                                        id,
                                                        createdAt,
                                                },
                                        );
                                } else {
                                        throw err;
                                }
                        }
                }
        });
}

function getSkebGenreIcon(genre: string) {
	switch (genre) {
		case "art":
			return "🎨";
		case "comic":
			return "🖼";
		case "voice":
			return "💬";
		case "novel":
			return "✒";
		case "video":
			return "🎞️";
		case "music":
			return "🎵";
		case "correction":
			return "⭐️";
		default:
			return "❓️";
	}
}
