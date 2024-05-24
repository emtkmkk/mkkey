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

export async function checkReactionMute(
	reaction: string,
	note: Note,
	mutedWords: Array<string | string[]>,
): boolean {

	if (!reaction) return false;

	const text = reaction.trim();
	if (text === "") return false;

	for (const mutePattern of mutedWords) {
		if (Array.isArray(mutePattern)) {
			// Clean up
			const keywords = mutePattern.filter((keyword) => keyword !== "");

			if (
				keywords.length > 0 &&
				keywords.every((keyword) => {
					if (keyword.startsWith("from:")) {
						const fromKeyword = keyword
							.replace("from:", "")
							.replace(`@${config.host}`, "");
						return !note.user
							? false
							: note.user.host
							? `${note.user.username}@${note.user.host}` === fromKeyword
							: note.user.username === fromKeyword;
					}
					if (keyword.startsWith("host:")) {
						const hostKeyword = keyword.replace("host:", "");
						return !note.user
							? false
							: hostKeyword === config.host
							? !note.user.host
							: note.user.host === hostKeyword;
					}
					if (keyword.startsWith("fuzzyHost:")) {
						const hostKeyword = keyword.replace("fuzzyHost:", "");
						return !note.userHost
							? false
							: (config.host.includes(hostKeyword) && !note.userHost) ||
									note.userHost.includes(hostKeyword);
					}
					if (keyword.startsWith("username:")) {
						const usernameKeyword = keyword.replace("username:", "");
						return !note.user ? false : note.user.username === usernameKeyword;
					}
					if (keyword.startsWith("fuzzyUsername:")) {
						const usernameKeyword = keyword.replace("fuzzyUsername:", "");
						return !note.user
							? false
							: note.user.username.includes(usernameKeyword);
					}
					if (keyword.startsWith("name:")) {
						const nameKeyword = keyword.replace("name:", "");
						return !note.user?.name ? false : note.user.name === nameKeyword;
					}
					if (keyword.startsWith("fuzzyName:")) {
						const nameKeyword = keyword.replace("fuzzyName:", "");
						return !note.user?.name ? false : note.user.name.includes(nameKeyword);
					}
					if (keyword.startsWith("visibility:")) {
						const visibilityKeyword = keyword.replace("visibility:", "").toLowerCase();
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
						if (["true", "yes", "on"].includes(localOnlyKeyword)) return note.localOnly;
						if (["false", "no", "off"].includes(localOnlyKeyword))
							return !note.localOnly;
						return false;
					}
					if (keyword.startsWith("relation:")) {
						const relationKeyword = keyword.replace("relation:", "").toLowerCase();
						if (note.user?.isFollowing == null) return false;
						if (["follow", "following"].includes(relationKeyword))
							return note.user.isFollowing;
						if (["followonly", "followingonly"].includes(relationKeyword))
							return note.user.isFollowing && !note.user.isFollowed;
						if (["follower", "followed"].includes(relationKeyword))
							return note.user.isFollowed;
						if (["followeronly", "followedonly"].includes(relationKeyword))
							return !note.user.isFollowing && note.user.isFollowed;
						if (relationKeyword === "both")
							return note.user.isFollowed && note.user.isFollowing;
						if (relationKeyword === "none")
							return !note.user.isFollowed && !note.user.isFollowing;
						return false;
					}
					if (keyword.startsWith(":") && keyword.endsWith(":")) {
						return keyword === reaction.replace(/@[^@]:/,":")
					}
					return text.includes(keyword)
				})
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
