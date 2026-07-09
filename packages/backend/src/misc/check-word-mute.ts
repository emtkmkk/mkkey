/**
 * @packageDocumentation
 *
 * ワードミュート・リアクションミュートの判定。キーワード配列・正規表現によるマッチを行う。
 *
 * @remarks
 * - **役割**: ノート投稿・TL 表示時にミュート条件に合致するか判定し、フィルタに利用する。
 *
 * @see {@link services/note/create} ノート作成
 * @internal
 */
import RE2 from "re2";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import config from "@/config/index.js";
import Logger from "@/services/logger.js";

const muteLogger = new Logger("mute");

type NoteLike = {
	id?: Note["id"];
	userId: Note["userId"];
	text: Note["text"];
	cw?: Note["cw"];
	reply?: NoteLike;
	renote?: NoteLike;
};

type UserLike = {
	id: User["id"];
};

function checkWordMute(
	note: NoteLike,
	mutedWords: Array<string | string[]> | null | undefined,
): boolean {
	if (note == null) return false;
	if (!Array.isArray(mutedWords) || mutedWords.length === 0) return false;

	const text = `${note.cw ?? ""} ${note.text ?? ""}`.trim();
	if (text === "") return false;

	for (const mutePattern of mutedWords) {
		if (Array.isArray(mutePattern)) {
			// 空キーワードを除いて整える
			const keywords = mutePattern.filter((keyword) => keyword !== "");

			if (keywords.length === 1 && note.id === keywords[0]) {
				return true;
			}

			if (
				keywords.length > 0 &&
				keywords.every((keyword) => text.includes(keyword))
			)
				return true;
		} else {
			// 正規表現パターン
			const regexp = mutePattern.match(/^\/(.+)\/(.*)$/);

			// 入力サニタイズにより通常は発生しない
			if (!regexp) {
				muteLogger.warn(`Found invalid regex in word mutes: ${mutePattern}`);
				continue;
			}

			try {
				if (new RE2(regexp[1], regexp[2]).test(text)) return true;
			} catch (err) {
				// 入力サニタイズにより通常は発生しない
			}
		}
	}

	return false;
}

/**
 * ノートがワードミュートに該当するか判定する（自分自身は除外）。
 *
 * @param note 判定対象のノート相当オブジェクト
 * @param me 判定を行うユーザー
 * @param mutedWords ミュート設定のキーワード配列
 * @returns ミュート対象なら `true`
 * @remarks
 * NOTE: `create.ts` などノート作成途中の経路から呼ばれるため、`id`・`reply`・`renote` は未設定の可能性がある。
 * @internal
 */
export async function getWordHardMute(
	note: NoteLike,
	me: UserLike | null | undefined,
	mutedWords: Array<string | string[]> | null | undefined,
): Promise<boolean> {
	// 自分自身はミュート対象外
	if (me && note.userId === me.id) {
		return false;
	}

	if (Array.isArray(mutedWords) && mutedWords.length > 0) {
		return (
			checkWordMute(note, mutedWords) ||
			checkWordMute(note.reply, mutedWords) ||
			checkWordMute(note.renote, mutedWords)
		);
	}

	return false;
}

/**
 * リアクションがミュート条件に該当するか判定する。
 * @internal
 */
export function checkReactionMute(
	reaction: string,
	note: Note,
	user: User,
	mutedWords: Array<string | string[]> | null | undefined,
): boolean | { muted: boolean; reject?: boolean } {
	if (!reaction) return false;
	if (!Array.isArray(mutedWords) || mutedWords.length === 0) return false;

	const text = reaction.trim();
	if (text === "") return false;

	for (const mutePattern of mutedWords) {
		if (Array.isArray(mutePattern)) {
			const reject =
				mutePattern.filter((keyword) => keyword.startsWith("reject:")).length >
				0
					? ["true", "yes", "on"].includes(
							mutePattern
								.filter((keyword) => keyword.startsWith("reject:"))[0]
								.replace("reject:", ""),
					  )
					: undefined;

			// 空キーワードと reject: を除いて整える
			const keywords = mutePattern.filter(
				(keyword) => keyword !== "" && !keyword.startsWith("reject:"),
			);

			if (
				keywords.length > 0 &&
				keywords.every((keyword) => {
					if (keyword.startsWith("from:")) {
						const fromKeyword = keyword
							.replace("from:", "")
							.replace(`@${config.host}`, "");
						return !user
							? false
							: user.host
							? `${user.username}@${user.host}` === fromKeyword
							: user.username === fromKeyword;
					}
					if (keyword.startsWith("host:")) {
						const hostKeyword = keyword.replace("host:", "");
						return !user
							? false
							: hostKeyword === config.host
							? !user.host
							: user.host === hostKeyword;
					}
					if (keyword.startsWith("fuzzyHost:")) {
						const hostKeyword = keyword.replace("fuzzyHost:", "");
						return !user.host
							? false
							: (config.host.includes(hostKeyword) && !user.host) ||
									user.host.includes(hostKeyword);
					}
					if (keyword.startsWith("username:")) {
						const usernameKeyword = keyword.replace("username:", "");
						return !user ? false : user.username === usernameKeyword;
					}
					if (keyword.startsWith("fuzzyUsername:")) {
						const usernameKeyword = keyword.replace("fuzzyUsername:", "");
						return !user ? false : user.username.includes(usernameKeyword);
					}
					if (keyword.startsWith("name:")) {
						const nameKeyword = keyword.replace("name:", "");
						return !user?.name ? false : user.name === nameKeyword;
					}
					if (keyword.startsWith("fuzzyName:")) {
						const nameKeyword = keyword.replace("fuzzyName:", "");
						return !user?.name ? false : user.name.includes(nameKeyword);
					}
					if (keyword.startsWith("visibility:")) {
						const visibilityKeyword = keyword
							.replace("visibility:", "")
							.toLowerCase();
						if (visibilityKeyword === "visitor")
							return (
								["public", "home", "hidden"].includes(note.visibility) &&
								note.localOnly === false
							);
						if (visibilityKeyword === "private")
							return ["followers", "specified"].includes(note.visibility);
						return note.visibility === visibilityKeyword;
					}
					if (
						keyword.startsWith("localOnly:") ||
						keyword.startsWith("localAndFollower:")
					) {
						const localOnlyKeyword = keyword
							.replace("localOnly:", "")
							.replace("localAndFollower:", "")
							.toLowerCase();
						if (["true", "yes", "on"].includes(localOnlyKeyword))
							return note.localOnly;
						if (["false", "no", "off"].includes(localOnlyKeyword))
							return !note.localOnly;
						return false;
					}
					if (keyword.startsWith(":") && keyword.endsWith(":")) {
						const muted = keyword === text.replace(/@[^@]+:/, ":") || keyword === text;
						return muted;
					}
					return text.includes(keyword);
				})
			) return reject === undefined ? true : { muted: true, reject: reject };
		} else {
			// 正規表現パターン
			const regexp = mutePattern.match(/^\/(.+)\/(.*)$/);

			// 入力サニタイズにより通常は発生しない
			if (!regexp) {
				muteLogger.warn(`Found invalid regex in word mutes: ${mutePattern}`);
				continue;
			}

			let reject = false;
			if (regexp[2].includes("r")) {
				reject = true;
			}
			try {
				if (new RE2(regexp[1], regexp[2]?.replaceAll("r", "")).test(text))
					return reject ? { muted: true, reject: true } : true;
			} catch (err) {
				// 入力サニタイズにより通常は発生しない
			}
		}
	}

	return false;
}
