/**
 * @packageDocumentation
 *
 * 絵文字 1 つの詳細を返す API（`emoji`）。
 *
 * @remarks
 * - ローカル絵文字は `host` を省略（または空文字・"."）して引く。
 * - 手元に無いリモート絵文字は、ログインしている利用者からの照会のときだけ持ち主のサーバーに問い合わせて登録する
 *   （{@link fetchRemoteEmoji}）。未ログインの照会で外部に通信させないため。
 *
 * @public
 */
import { IsNull } from "typeorm";
import { Emojis, Instances } from "@/models/index.js";
import {
	extractFedibirdEmojiFields,
	normalizeLicenseName,
	toFedibirdColumns,
	toRemoteCategory,
} from "@/misc/emoji-fedibird.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";
import { isSuspendedHost } from "@/services/instance-health/suspended-hosts.js";
import define from "../define.js";
import { ApiError } from "../error.js";
import { toPuny } from "@/misc/convert-host.js";
import { getJson } from "@/misc/fetch.js";
import { genId } from "@/misc/gen-id.js";
import { toStoredCopyPermission } from "@/misc/copy-permission.js";

export const meta = {
	tags: ["meta"],

	requireCredential: false,
	allowGet: true,
	cacheSec: 3600,

	errors: {
		noSuchEmoji: {
			message: "No such emoji.",
			code: "NO_SUCH_EMOJI",
			id: "6023366f-c5a9-4f6d-a7f8-bff2cc53f963",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Emoji",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		name: {
			type: "string",
		},
		host: {
			type: "string",
		},
	},
	required: ["name"],
} as const;

type RemoteEmojiPayload = {
	name?: string;
	aliases?: unknown;
	category?: unknown;
	url?: unknown;
	uri?: string | null;
	copyPermission?: string | null;
	licenseName?: string | null;
	usageInfo?: string | null;
	creator?: string | null;
	description?: string | null;
	isBasedOnUrl?: string | null;
	license?: string | null;
	sensitive?: boolean;
};

/**
 * 手元に無いリモート絵文字を、持ち主のサーバーの `/api/emoji` から取って登録する
 *
 * @remarks
 * - 照会するのは、連合したことがある（インスタンスの記録がある）ホストだけ。ブロック中・配送停止中のホストには照会しない。
 *   以前はログインしていれば任意のホスト名で照会でき、知らないホストの絵文字の行をいくらでも作れた。
 * - 相手が返した名前は使わず、照会した名前で登録する（別の名前の絵文字を書き換えさせないため）。
 * - カテゴリは ActivityPub で受け取ったときと同じく「カテゴリ <ホスト>」の形にする（{@link toRemoteCategory}）。
 * - Fedibird 互換の項目（表示名・読み・関連リンク・著作権表示・クレジット）も受け取る。
 *   以前は受け取っておらず、ActivityPub で届いた絵文字より情報が少なくなっていた。
 *
 * @param name - 絵文字名
 * @param host - 持ち主のホスト
 * @returns 登録した絵文字。照会しない相手・見つからないときは null
 * @internal
 */
async function fetchRemoteEmoji(name: string, host: string) {
	const normalizedHost = toPuny(host);

	const instance = await Instances.findOneBy({ host: normalizedHost });
	if (instance == null) return null;
	if (await shouldBlockInstance(normalizedHost)) return null;
	if (await isSuspendedHost(normalizedHost)) return null;

	const apiurl = `https://${normalizedHost}/api/emoji?name=${encodeURIComponent(name)}`;
	const remote = (await getJson(
		apiurl,
		"application/json, */*",
		5000,
	)) as RemoteEmojiPayload;

	if (typeof remote?.url !== "string" || remote.url === "") {
		return null;
	}
	// 別の名前の絵文字が返ってきたら使わない
	if (remote.name != null && remote.name !== name) {
		return null;
	}

	const now = new Date();
	const exists = await Emojis.findOneBy({
		name,
		host: normalizedHost,
	});

	const fedibird = extractFedibirdEmojiFields(remote);

	const updateData = {
		updatedAt: now,
		name,
		host: normalizedHost,
		category: toRemoteCategory(
			typeof remote.category === "string" ? remote.category : null,
			normalizedHost,
		),
		originalUrl: remote.url,
		publicUrl: remote.url,
		uri: remote.uri ?? null,
		aliases: Array.isArray(remote.aliases)
			? remote.aliases.filter((x): x is string => typeof x === "string")
			: [],
		copyPermission: toStoredCopyPermission(remote.copyPermission ?? null),
		licenseName: normalizeLicenseName(remote.licenseName),
		usageInfo: remote.usageInfo ?? null,
		creator: remote.creator ?? null,
		description: remote.description ?? null,
		isBasedOnUrl: remote.isBasedOnUrl ?? fedibird.isBasedOn ?? null,
		license: remote.license ?? null,
		...toFedibirdColumns(fedibird),
		sensitive: remote.sensitive === true,
		// リモート絵文字は常に public（カラムのデフォルトが private のため明示する）
		usageVisibility: "public",
	};

	if (exists) {
		await Emojis.update({ id: exists.id }, updateData);
		return await Emojis.findOneBy({ id: exists.id });
	}

	const inserted = await Emojis.insert({
		id: genId(),
		createdAt: now,
		...updateData,
	});

	return await Emojis.findOneBy(inserted.identifiers[0]);
}

export default define(meta, paramDef, async (ps, me) => {
	// ローカルを表す書き方（未指定 / 空文字 / "."）は null に寄せ、それ以外をリモートホストとして扱う
	const remoteHost =
		ps.host == null || ps.host === "" || ps.host === "." ? null : ps.host;
	const whereHost = remoteHost == null ? IsNull() : toPuny(remoteHost);

	let emoji = await Emojis.findOne({
		where: {
			name: ps.name,
			host: whereHost,
		},
	});

	// 未知リモート絵文字の照会は認証済みユーザー時のみ行う
	if (!emoji && remoteHost != null && me) {
		emoji = await fetchRemoteEmoji(ps.name, remoteHost);
	}

	if (!emoji) {
		throw new ApiError(meta.errors.noSuchEmoji);
	}

	// 詳細表示用なので、関連リンク・著作権表示などの詳細項目も返す
	return Emojis.pack(emoji, { detail: true });
});
