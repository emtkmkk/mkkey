export type Muted = {
	muted: boolean;
	matched: string[];
	what?: string; // "note" || "reply" || "renote" || "quote"
};

const NotMuted = { muted: false, matched: [] };

function checkWordMute(
	note: NoteLike,
	mutedWords: Array<string | string[]>,
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
				keywords.every((keyword, index) => checkMuteKeyword(note,text,keyword,index))
			) {
				result.muted = true;
				let pname = keywords;
				if (keywords[0].startsWith("pname:")) {
					pname = [keywords[0].replace("pname:","").replace("<#id>",note.id)];
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
): boolean {
	if (!keyword.includes(":") || keyword.startsWith("include:")) {
		const includeKeyword = keyword.replace("include:","");
		return text.includes(includeKeyword);
	}
	if (keyword.startsWith("pname:")) {
		return index === 0;
	}
	if (keyword.startsWith("exclude:")) {
		const excludeKeyword = keyword.replace("exclude:","");
		return !text.includes(excludeKeyword);
	}
	if (keyword.startsWith("or:")) {
		const orKeywords = keyword.replace("or:","").split(",");
		if (orKeywords.length > 12) return false;
		return orKeywords.some((orKeyword) => text.includes(orKeyword));
	}
	if (keyword.startsWith("fuzzy:")) {
		const fuzzyKeywords = keyword.replace("fuzzy:","").split("");
		if (fuzzyKeywords.length > 12) return false;
		return fuzzyKeywords.every((fuzzyKeyword) => text.includes(fuzzyKeyword));
	}
	if (keyword.startsWith("from:")) {
		const fromKeyword = keyword.replace("from:","").replace("@mkkey.net","");
		return !note.user ? false : note.user.host ? note.user.username + "@" + note.user.host === fromKeyword : note.user.username === fromKeyword;
	}
	if (keyword.startsWith("name:")) {
		const nameKeyword = keyword.replace("name:","");
		return !note.user ? false : note.user.name.includes(nameKeyword);
	}
	if (keyword.startsWith("visibility:")) {
		const visibilityKeyword = keyword.replace("visibility:","");
		return note.visibility === visibilityKeyword;
	}
	if (keyword.startsWith("-visibility:")) {
		const visibilityKeyword = keyword.replace("-visibility:","");
		return note.visibility !== visibilityKeyword;
	}
	if (keyword.startsWith("localOnly:")) {
		const localOnlyKeyword = keyword.replace("localOnly:","");
		return note.localOnly === localOnlyKeyword;
	}
	if (keyword.startsWith("relation:") || keyword.startsWith("-relation:")) {
		let reverse = keyword.startsWith("-");
		const relationKeyword = keyword.replace("-relation:","").replace("relation:","");
		if (note.user.isFollowing == null) return false;
		if (relationKeyword === "Follow" || relationKeyword === "Following") return reverse ? !note.user.isFollowing : note.user.isFollowing;
		if (relationKeyword === "FollowOnly" || relationKeyword === "FollowingOnly") return reverse ? !(note.user.isFollowing && !note.user.isFollowed) : note.user.isFollowing && !note.user.isFollowed;
		if (relationKeyword === "Follower" || relationKeyword === "Followed") return reverse ? !note.user.isFollowed : note.user.isFollowed;
		if (relationKeyword === "FollowerOnly" || relationKeyword === "FollowedOnly") return reverse ? !(!note.user.isFollowing && note.user.isFollowed) : !note.user.isFollowing && note.user.isFollowed;
		if (relationKeyword === "both") return reverse ? !(note.user.isFollowed && note.user.isFollowing) : note.user.isFollowed && note.user.isFollowing;
		if (relationKeyword === "none") return reverse ? !(!note.user.isFollowed && !note.user.isFollowing) : !note.user.isFollowed && !note.user.isFollowing;
		return false;
	}
	if (keyword.startsWith("filter:") || keyword.startsWith("-filter:")) {
		let reverse = keyword.startsWith("-");
		
		const filterKeyword = keyword.replace("-filter:","").replace("filter:","");
		if (filterKeyword.includes("mention")) {
			const isMention = (note.mentions && !note.replyId);
			return reverse ? !isMention : !!isMention;
		}
		if (filterKeyword.includes("reply")) {
			const isReply = (note.replyId);
			return reverse ? !isReply : !!isReply;
		}
		if (filterKeyword.includes("renote") || filterKeyword.includes("rt")) {
			const isRenote = (note.renoteId && !note.text);
			return reverse ? !isRenote : !!isRenote;
		}
		if (filterKeyword.includes("quote")) {
			const isQuote = (note.renoteId && note.text);
			return reverse ? !isQuote : !!isQuote;
		}
		if (filterKeyword.includes("media") || filterKeyword.includes("file") ) {
			const isMedia = (note.fileIds && note.fileIds.length !== 0);
			return reverse ? !isMedia : !!isMedia;
		}
		if (filterKeyword.includes("poll")) {
			const isPoll = (note.hasPoll);
			return reverse ? !isPoll : !!isPoll;
		}
		if (filterKeyword.includes("channel")) {
			const isChannel = (note.channelId);
			return reverse ? !isChannel : !!isChannel;
		}
		if (filterKeyword.includes("cw")) {
			const isCw = (note.cw);
			return reverse ? !isCw : !!isCw;
		}
		if (filterKeyword.includes("nsfw")) {
			const isNsfw = (note.files && note.files.some((file) => file.isSensitive));
			return reverse ? !isNsfw : !!isNsfw;
		}
		return false;
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
		let noteMuted = checkWordMute(note, mutedWords);
		if (noteMuted.muted) {
			noteMuted.what = "note";
			return noteMuted;
		}

		if (note.renote) {
			let renoteMuted = checkWordMute(note.renote, mutedWords);
			if (renoteMuted.muted) {
				renoteMuted.what = note.text == null ? "renote" : "quote";
				return renoteMuted;
			}
		}

		if (note.reply) {
			let replyMuted = checkWordMute(note.reply, mutedWords);
			if (replyMuted.muted) {
				replyMuted.what = "reply";
				return replyMuted;
			}
		}
	}

	return NotMuted;
}
