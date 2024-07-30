import RE2 from "re2";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import config from "@/config/index.js";

type NoteLike = {
	userId: Note["userId"];
	text: Note["text"];
	cw?: Note["cw"];
};

type UserLike = {
	id: User["id"];
};

function checkWordMute(
	note: NoteLike,
	mutedWords: Array<string | string[]>,
): boolean {
	if (note == null) return false;

	const text = `${note.cw ?? ""} ${note.text ?? ""}`.trim();
	if (text === "") return false;

	for (const mutePattern of mutedWords) {
		if (Array.isArray(mutePattern)) {
			// Clean up
			const keywords = mutePattern.filter((keyword) => keyword !== "");

			if (
				keywords.length > 0 &&
				keywords.every((keyword) => text.includes(keyword))
			)
				return true;
		} else {
			// represents RegExp
			const regexp = mutePattern.match(/^\/(.+)\/(.*)$/);

			// This should never happen due to input sanitisation.
			if (!regexp) {
				console.warn(`Found invalid regex in word mutes: ${mutePattern}`);
				continue;
			}

			try {
				if (new RE2(regexp[1], regexp[2]).test(text)) return true;
			} catch (err) {
				// This should never happen due to input sanitisation.
			}
		}
	}

	return false;
}

export async function getWordHardMute(
	note: NoteLike,
	me: UserLike | null | undefined,
	mutedWords: Array<string | string[]>,
): Promise<boolean> {
	// 自分自身
	if (me && note.userId === me.id) {
		return false;
	}

	if (mutedWords.length > 0) {
		return (
			checkWordMute(note, mutedWords) ||
			checkWordMute(note.reply, mutedWords) ||
			checkWordMute(note.renote, mutedWords)
		);
	}

	return false;
}

export function checkReactionMute(
	reaction: string,
	note: Note,
	user: User,
	mutedWords: Array<string | string[]>,
): boolean | { muted: boolean; reject?: boolean } {
	if (!reaction) return false;

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

			// Clean up
			const keywords = mutePattern.filter(
				(keyword) => keyword !== "" && !keyword.startsWith("reject:"),
			);

			if (
				keywords.length > 0 &&
				keywords.every((keyword) => {
					console.log(keyword + " = " + text);
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
						return (
							keyword === text.replace(/@[^@]:/, ":") ||
							keyword === text
						);
					}
					return text.includes(keyword);
				})
			)
				return reject === undefined ? true : { muted: true, reject: reject };
		} else {
			// represents RegExp
			const regexp = mutePattern.match(/^\/(.+)\/(.*)$/);

			// This should never happen due to input sanitisation.
			if (!regexp) {
				console.warn(`Found invalid regex in word mutes: ${mutePattern}`);
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
				// This should never happen due to input sanitisation.
			}
		}
	}

	return false;
}
