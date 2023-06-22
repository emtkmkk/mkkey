export type Muted = {
	muted: boolean;
	matched: string[];
	what?: string; // "note" || "reply" || "renote" || "quote"
};

const NotMuted = { muted: false, matched: [] };

function checkWordMute(
	note: NoteLike,
	mutedWords: Array<string | string[]>,
	what?: string,
): Muted {
	const text = ((note.cw ?? "") + " " + (note.text ?? "")).trim();
	//if (text === "") return NotMuted;

	let result = { muted: false, matched: [] };

	for (const mutePattern of mutedWords) {
		if (Array.isArray(mutePattern)) {
			// Clean up
			const keywords = mutePattern.filter((keyword) => keyword !== "");

			if (
				keywords.length > 0 &&
				!(keywords[0].startsWith("pname:") && keywords.length == 1) &&
				keywords.every((keyword, index) => {
					// 反転オプション：- or !
					const reverse = keyword.startsWith("-") || keyword.startsWith("!");
					const checkRet = checkMuteKeyword(note,text,keyword.replace(/^\-/,"").replace(/^\!/,""),index,what ?? "note");
					reverse
						// エラーならば反転に関係なくfalse
						? checkRet != null ? !checkRet : false
						: checkRet ?? false
					})
			) {
				result.muted = true;
				let pname = keywords;
				if (keywords[0].startsWith("pname:")) {
					pname = [keywords[0].replace("pname:","").replace("<#id>",note.id)];
					if (pname === ["hidden"]) pname === [""];
				}
				result.matched.push(...pname);
			}
		} else {
			// represents RegExp
			const regexp = mutePattern.match(/^\/(.+)\/(.*)$/);

			// This should never happen due to input sanitisation.
			if (!regexp) {
				console.warn(`Found invalid regex in word mutes: ${mutePattern}`);
				continue;
			}

			try {
				if (new RegExp(regexp[1], regexp[2]).test(text)) {
					result.muted = true;
					result.matched.push(mutePattern);
				}
			} catch (err) {
				// This should never happen due to input sanitisation.
			}
		}
	}

	result.matched = [...new Set(result.matched)];
	return result;
}

function checkMuteKeyword(
	note: NoteLike,
	text: string,
	keyword: string,
	index: number,
	what: string,
): boolean | undefined {
	// undefined : エラーの場合 反転を無視してfalse
	if (!keyword.includes(":") || keyword.startsWith("include:")) {
		const includeKeyword = keyword.replace("include:","");
		return text.includes(includeKeyword);
	}
	if (keyword.startsWith("pname:")) {
		if (index !== 0) return undefined;
		return true;
	}
	if (keyword.startsWith("exclude:")) {
		const excludeKeyword = keyword.replace("exclude:","");
		return !text.includes(excludeKeyword);
	}
	if (keyword.startsWith("or:")) {
		const orKeywords = keyword.replace("or:","").split(",");
		if (orKeywords.length > 12) return undefined;
		return orKeywords.some((orKeyword) => text.includes(orKeyword));
	}
	if (keyword.startsWith("fuzzy:")) {
		const fuzzyKeywords = keyword.replace("fuzzy:","").split("");
		if (fuzzyKeywords.length > 12) return undefined;
		return fuzzyKeywords.every((fuzzyKeyword) => text.includes(fuzzyKeyword));
	}
	if (keyword.startsWith("from:")) {
		const fromKeyword = keyword.replace("from:","").replace("@mkkey.net","");
		return !note.user ? undefined : note.user.host ? note.user.username + "@" + note.user.host === fromKeyword : note.user.username === fromKeyword;
	}
	if (keyword.startsWith("host:")) {
		const hostKeyword = keyword.replace("host:","") || "mkkey.net";
		return !note.user ? undefined : hostKeyword === "mkkey.net" ? !note.user.host : note.user.host === hostKeyword;
	}
	if (keyword.startsWith("fuzzyHost:")) {
		const hostKeyword = keyword.replace("host:","") || "mkkey.net";
		return !note.user ? undefined : ("mkkey.net".includes(hostKeyword) && !note.user.host) || note.user.host.includes(hostKeyword);
	}
	if (keyword.startsWith("username:")) {
		const usernameKeyword = keyword.replace("username:","");
		return !note.user ? undefined : note.user.username === usernameKeyword;
	}
	if (keyword.startsWith("fuzzyUsername:")) {
		const usernameKeyword = keyword.replace("username:","");
		return !note.user ? undefined : note.user.username.includes(usernameKeyword);
	}
	if (keyword.startsWith("name:")) {
		const nameKeyword = keyword.replace("name:","");
		return !note.user ? undefined : note.user.name === nameKeyword;
	}
	if (keyword.startsWith("fuzzyName:")) {
		const nameKeyword = keyword.replace("name:","");
		return !note.user ? undefined : note.user.name.includes(nameKeyword);
	}
	if (keyword.startsWith("visibility:")) {
		const visibilityKeyword = keyword.replace("visibility:","");
		if (visibilityKeyword === "visitor") return ["public","home","hidden"].includes(note.visibility) && note.localOnly === false;
		if (visibilityKeyword === "private") return ["followers","specified"].includes(note.visibility);
		return note.visibility === visibilityKeyword;
	}
	if (keyword.startsWith("localOnly:") || keyword.startsWith("localAndFollower:")) {
		const localOnlyKeyword = keyword.replace("localOnly:","").replace("localAndFollower:","");
		if (["true","yes","on"].includes(localOnlyKeyword)) return note.localOnly;
		if (["false","no","off"].includes(localOnlyKeyword)) return !note.localOnly;
		return undefined;
	}
	if (keyword.startsWith("what:")) {
		const whatKeyword = keyword.replace("what:","").replace("rt","renote");
		return what === whatKeyword;
	}
	if (keyword.startsWith("relation:")) {
		const relationKeyword = keyword.replace("relation:","");
		if (note.user.isFollowing == null) return undefined;
		if (["follow","following"].includes(relationKeyword)) return note.user.isFollowing;
		if (["FollowOnly","followOnly","FollowingOnly","followingOnly"].includes(relationKeyword)) return note.user.isFollowing && !note.user.isFollowed;
		if (["Follower","follower","Followed","followed"].includes(relationKeyword)) return note.user.isFollowed;
		if (["FollowerOnly","followerOnly","FollowedOnly","followedOnly"].includes(relationKeyword)) return !note.user.isFollowing && note.user.isFollowed;
		if (relationKeyword === "both") return note.user.isFollowed && note.user.isFollowing;
		if (relationKeyword === "none") return !note.user.isFollowed && !note.user.isFollowing;
		return undefined;
	}
	if (keyword.startsWith("filter:")) {
		const filterKeyword = keyword.replace("filter:","");
		if (filterKeyword.includes("mention")) {
			const isMention = (note.mentions && !note.replyId);
			return !!isMention;
		}
		if (filterKeyword.includes("reply")) {
			const isReply = (note.replyId);
			return !!isReply;
		}
		if (filterKeyword.includes("renote") || filterKeyword.includes("rt")) {
			const isRenote = (note.renoteId && !note.text);
			return !!isRenote;
		}
		if (filterKeyword.includes("quote")) {
			const isQuote = (note.renoteId && note.text);
			return !!isQuote;
		}
		if (filterKeyword.includes("media") || filterKeyword.includes("file") ) {
			const isMedia = (note.fileIds && note.fileIds.length !== 0);
			return !!isMedia;
		}
		if (filterKeyword.includes("poll")) {
			const isPoll = (note.hasPoll);
			return !!isPoll;
		}
		if (filterKeyword.includes("channel")) {
			const isChannel = (note.channelId);
			return !!isChannel;
		}
		if (filterKeyword.includes("cw")) {
			const isCw = (note.cw);
			return !!isCw;
		}
		if (filterKeyword.includes("nsfw")) {
			const isNsfw = (note.files && note.files.some((file) => file.isSensitive));
			return !!isNsfw;
		}
		return undefined;
	}
	return text.includes(keyword);
}

export function getWordSoftMute(
	note: Record<string, any>,
	me: Record<string, any> | null | undefined,
	mutedWords: Array<string | string[]>,
): Muted {
	// 自分自身
	if (me && note.userId === me.id) {
		return NotMuted;
	}

	if (mutedWords.length > 0) {
		let noteMuted = checkWordMute(note, mutedWords,"note");
		if (noteMuted.muted) {
			noteMuted.what = "note";
			return noteMuted;
		}

		if (note.renote) {
			let renoteMuted = checkWordMute(note.renote, mutedWords, note.text == null ? "renote" : "quote");
			if (renoteMuted.muted) {
				renoteMuted.what = note.text == null ? "renote" : "quote";
				return renoteMuted;
			}
		}

		if (note.reply) {
			let replyMuted = checkWordMute(note.reply, mutedWords , "reply");
			if (replyMuted.muted) {
				replyMuted.what = "reply";
				return replyMuted;
			}
		}
	}

	return NotMuted;
}
