/**
 * @packageDocumentation
 *
 * misskey.io リモートユーザーの Skeb プロフィールフィールド補完。
 *
 * @remarks
 * - **役割**: `createPerson` / `updatePerson` から共通的に Skeb 情報を取得し、プロフィール fields に追記する。
 * - **最適化**: Person `id` から userId を抽出して search API を省略。`get-skeb-status` は 1 時間キャッシュする。
 *
 * @see {@link remote/activitypub/models/person} 呼び出し元
 * @internal
 */

import { URL } from "node:url";
import config from "@/config/index.js";
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_USER } from "@/misc/cache-limits.js";
import { getJson, getResponse } from "@/misc/fetch.js";
import type { IActor } from "../type.js";
import { apLogger } from "../logger.js";

const logger = apLogger;

/** Skeb 状態 API のキャッシュ TTL（1 時間） */
const SKEB_STATUS_CACHE_TTL_MS = 60 * 60 * 1000;

const MISSKEY_IO_HOST = "misskey.io";

type ProfileField = {
	name: string;
	value: string;
};

type SkebSkill = {
	genre?: string;
	amount?: number;
};

type SkebInfo = {
	isAcceptable?: boolean;
	isCreator?: boolean;
	skills?: SkebSkill[];
	creatorRequestCount?: number;
	clientRequestCount?: number;
	screenName?: string;
};

const skebStatusCache = new Cache<SkebInfo | null>(SKEB_STATUS_CACHE_TTL_MS, {
	maxEntries: CACHE_MAX_USER,
});

/**
 * Skeb フィールドの表示スタイル。
 *
 * @remarks
 * - `create`: 新規作成時（`★Skeb`・プレーンテキスト）
 * - `update`: 更新時（`Skeb(自動)`・MFM 装飾）
 *
 * @public
 */
export type MisskeyIoSkebFieldStyle = "create" | "update";

/**
 * {@link appendMisskeyIoSkebFieldIfNeeded} のオプション。
 *
 * @public
 */
export type AppendMisskeyIoSkebFieldOptions = {
	/** 表示スタイル */
	style: MisskeyIoSkebFieldStyle;
};

/**
 * Person `id` から misskey.io の内部 userId を抽出する。
 *
 * @param personId - ActivityPub Actor の `id`（例: `https://misskey.io/users/...`）
 * @returns userId。抽出できない場合は `null`
 * @public
 */
export function extractMisskeyIoUserIdFromPersonId(
	personId: string | undefined,
): string | null {
	if (personId == null || personId.length === 0) return null;

	try {
		const url = new URL(personId);
		if (url.hostname.toLowerCase() !== MISSKEY_IO_HOST) return null;

		const match = url.pathname.match(/^\/users\/([^/]+)\/?$/);
		return match?.[1] ?? null;
	} catch {
		return null;
	}
}

/**
 * fields に Skeb 行が既に含まれるか判定する。
 *
 * @param fields - プロフィール fields
 * @returns Skeb 行があれば true
 * @internal
 */
function hasSkebField(fields: ProfileField[]): boolean {
	return fields.some((field) => field.name.toLowerCase().includes("skeb"));
}

/**
 * Skeb ジャンルのアイコンを返す。
 *
 * @param genre - Skeb ジャンル名
 * @returns 絵文字アイコン
 * @internal
 */
function getSkebGenreIcon(genre: string): string {
	switch (genre) {
		case "art":
			return "🎨";
		case "comic":
			return "🖼";
		case "voice":
			return "💬";
		case "novel":
			return "✒";
		case "music":
			return "🎵";
		case "video":
			return "🎞️";
		case "correction":
			return "⭐️";
		default:
			return "❓️";
	}
}

/**
 * search-by-username-and-host で userId を取得する（フォールバック）。
 *
 * @param username - preferredUsername
 * @param host - ホスト（misskey.io）
 * @returns userId。取得できない場合は `null`
 * @internal
 */
async function resolveMisskeyIoUserIdBySearch(
	username: string | undefined,
	host: string,
): Promise<string | null> {
	if (username == null || username.length === 0) return null;

	try {
		let userInfo = (await (
			await getResponse({
				url: `https://${host}/api/users/search-by-username-and-host`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"User-Agent": config.userAgent2 ?? config.userAgent,
					Accept: "application/json, */*",
				},
				body: JSON.stringify({
					username,
					host,
				}),
				timeout: 5000,
			})
		).json()) as Array<{ id?: string; username?: string }>;

		if (Array.isArray(userInfo) && userInfo.length > 1) {
			userInfo = userInfo.filter(
				(x) => username.toLowerCase() === x.username?.toLowerCase(),
			);
		}

		if (Array.isArray(userInfo) && userInfo.length === 1 && userInfo[0].id) {
			return userInfo[0].id;
		}
	} catch (e) {
		logger.warn(`misskey.io user search fallback failed: ${e}`);
	}

	return null;
}

/**
 * misskey.io の userId を解決する（Person id 優先、失敗時 search API）。
 *
 * @param person - ActivityPub Person
 * @param host - ホスト
 * @returns userId。取得できない場合は `null`
 * @internal
 */
async function resolveMisskeyIoUserId(
	person: IActor,
	host: string,
): Promise<string | null> {
	const fromPersonId = extractMisskeyIoUserIdFromPersonId(
		typeof person.id === "string" ? person.id : undefined,
	);
	if (fromPersonId != null) return fromPersonId;

	return await resolveMisskeyIoUserIdBySearch(person.preferredUsername, host);
}

/**
 * Skeb 状態 API をキャッシュ付きで取得する。
 *
 * @param userId - misskey.io 内部 userId
 * @returns Skeb 情報。取得失敗時は `null`
 * @internal
 */
async function fetchMisskeyIoSkebStatus(
	userId: string,
): Promise<SkebInfo | null> {
	const cacheKey = `misskey-io:skeb:${userId}`;
	return await skebStatusCache.fetch(cacheKey, async () => {
		try {
			return (await getJson(
				`https://${MISSKEY_IO_HOST}/api/users/get-skeb-status?userId=${userId}`,
				"application/json, */*",
				5000,
				{ "User-Agent": config.userAgent2 ?? config.userAgent },
			)) as SkebInfo;
		} catch (e) {
			logger.warn(`fetch misskey.io skeb status failed: ${e}`);
			return null;
		}
	});
}

/**
 * Skeb 情報からステータス文字列を組み立てる。
 *
 * @param skebInfo - Skeb API 応答
 * @returns 表示用ステータス文字列
 * @internal
 */
function buildSkebStatusText(skebInfo: SkebInfo): string {
	let status = "";

	if (skebInfo.isAcceptable || skebInfo.isCreator) {
		if (
			skebInfo.isAcceptable &&
			Array.isArray(skebInfo.skills) &&
			skebInfo.skills.length > 0
		) {
			const amounts = new Map<string, string>();
			const amountsN = new Map<string, number>();
			for (const skill of skebInfo.skills) {
				if (skill != null && typeof skill.amount === "number") {
					const genre = getSkebGenreIcon(skill.genre ?? "");
					const str = `${Math.ceil(skill.amount / 100) / 10}k`;
					amounts.set(str, (amounts.get(str) ?? "") + genre);
					amountsN.set(str, (amountsN.get(str) ?? 0) + 1);
				}
			}
			if (amounts.size >= 1) {
				const keys = Array.from(amounts.keys());
				status += `${amounts.get(keys[0])} ${keys[0]}`;
				if (amounts.size === 2) {
					status += ` ${amounts.get(keys[1])} ${keys[1]}`;
				} else if (amounts.size > 2 && amountsN.size > 0) {
					const nKeys = Array.from(amountsN.keys());
					status += ` (+${
						skebInfo.skills.length - (amountsN.get(nKeys[0]) ?? 1)
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
	} else if (
		typeof skebInfo.clientRequestCount === "number" &&
		skebInfo.clientRequestCount > 0
	) {
		status = `${skebInfo.clientRequestCount.toLocaleString()}件`;
	}

	return status;
}

/**
 * Skeb フィールドの name / value をスタイルに応じて生成する。
 *
 * @param skebInfo - Skeb API 応答
 * @param status - ステータス文字列
 * @param style - 表示スタイル
 * @returns 追記するフィールド。追記不要なら `null`
 * @internal
 */
function buildSkebProfileField(
	skebInfo: SkebInfo,
	status: string,
	style: MisskeyIoSkebFieldStyle,
): ProfileField | null {
	if (skebInfo.screenName == null) return null;

	if (skebInfo.isAcceptable || skebInfo.isCreator) {
		if (style === "create") {
			return {
				name: "★Skeb",
				value: `[${skebInfo.isAcceptable ? "募集中" : "停止中"}${
					status ? ` ${status}` : ""
				}](https://skeb.jp/@${skebInfo.screenName})`,
			};
		}

		return {
			name: "Skeb(自動)",
			value: `[${skebInfo.isAcceptable ? "$[border.radius=5,color=FFF $[bg.color=F14668 $[fg.color=FFF  募集中 ]]]" : "$[border.radius=5,color=FFF $[bg.color=363636 $[fg.color=FFF  停止中 ]]]"}${
				status ? ` ${status}` : ""
			}](https://skeb.jp/@${skebInfo.screenName})`,
		};
	}

	if (
		typeof skebInfo.clientRequestCount === "number" &&
		skebInfo.clientRequestCount > 0
	) {
		if (style === "create") {
			return {
				name: "★Skeb",
				value: `[クライアント${status ? ` ${status}` : ""}](https://skeb.jp/@${skebInfo.screenName})`,
			};
		}

		return {
			name: "Skeb(自動)",
			value: `[$[border.radius=5,color=FFF $[bg.color=363636 $[fg.color=FFF  クライアント ]]]${
				status ? ` ${status}` : ""
			}](https://skeb.jp/@${skebInfo.screenName})`,
		};
	}

	return null;
}

/**
 * 既存 Skeb 行を除去して fields 上限内に収める。
 *
 * @param fields - プロフィール fields
 * @returns Skeb 行を除いた fields
 * @internal
 */
function removeExistingSkebFields(fields: ProfileField[]): ProfileField[] {
	if (
		fields.length >= 16 &&
		fields.filter((x) => !x.name.toLowerCase().includes("skeb")).length < 16
	) {
		return fields.filter((x) => !x.name.toLowerCase().includes("skeb"));
	}
	return fields;
}

/**
 * misskey.io ユーザーの Skeb フィールドを必要に応じて追記する。
 *
 * @param person - ActivityPub Person
 * @param fields - 既存のプロフィール fields
 * @param host - ユーザーのホスト
 * @param opts - 表示スタイル等
 * @returns Skeb 追記後の fields
 * @public
 */
export async function appendMisskeyIoSkebFieldIfNeeded(
	person: IActor,
	fields: ProfileField[],
	host: string,
	opts: AppendMisskeyIoSkebFieldOptions,
): Promise<ProfileField[]> {
	if (host !== MISSKEY_IO_HOST) return fields;
	if (hasSkebField(fields)) return fields;

	try {
		const userId = await resolveMisskeyIoUserId(person, host);
		if (userId == null) return fields;

		const skebInfo = await fetchMisskeyIoSkebStatus(userId);
		if (skebInfo == null) return fields;

		const status = buildSkebStatusText(skebInfo);
		const skebField = buildSkebProfileField(skebInfo, status, opts.style);
		if (skebField == null) return fields;

		let nextFields = removeExistingSkebFields([...fields]);
		if (nextFields.length < 16) {
			nextFields = [...nextFields, skebField];
		}
		return nextFields;
	} catch (e) {
		logger.warn(`fetch AddUserInfo err : ${e}`);
		return fields;
	}
}

/**
 * テスト用に Skeb キャッシュをクリアする。
 *
 * @internal
 */
export function clearMisskeyIoSkebStatusCacheForTests(): void {
	skebStatusCache.cache.clear();
}

/**
 * テスト用に Skeb キャッシュへ値を直接設定する。
 *
 * @param userId - misskey.io 内部 userId
 * @param info - キャッシュする Skeb 情報
 * @internal
 */
export function setMisskeyIoSkebStatusCacheForTests(
	userId: string,
	info: SkebInfo | null,
): void {
	skebStatusCache.set(`misskey-io:skeb:${userId}`, info);
}
