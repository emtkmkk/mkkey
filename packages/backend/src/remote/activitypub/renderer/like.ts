import { IsNull } from "typeorm";
import config from "@/config/index.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import type { Note } from "@/models/entities/note.js";
import { Emojis } from "@/models/index.js";
import renderEmoji from "./emoji.js";
import { fetchMeta } from "@/misc/fetch-meta.js";

/**
 * リアクションを Like アクティビティとして描く
 *
 * @remarks
 * note からは `uri` しか読まないため、`{ uri: null }` のような最小オブジェクトも受け付ける
 * （resolver が /likes/:id を解決するときに使う）。
 *
 * @param noteReaction - 描くリアクション
 * @param note - 対象ノート（`uri` だけ参照する。null なら自サーバーのノート URL を使う）
 * @returns Like オブジェクト
 * @public
 */
export const renderLike = async (
	noteReaction: NoteReaction,
	note: Pick<Note, "uri">,
) => {
	const reaction = noteReaction.reaction;
	const custom = reaction.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/) || null;
	const sendReaction = custom
		? custom[2]
			? `:${reaction?.match(/[^:@]+/)?.[0]}:`
			: reaction
		: reaction;
	const meta = await fetchMeta();

	const object = {
		type: "Like",
		id: `${config.url}/likes/${noteReaction.id}`,
		actor: `${config.url}/users/${noteReaction.userId}`,
		object: note.uri ? note.uri : `${config.url}/notes/${noteReaction.noteId}`,
		...(!meta.defaultReaction.includes(reaction)
			? {
					content: sendReaction,
					_misskey_reaction: sendReaction,
			  }
			: {}),
	} as any;

	// カスタム絵文字の形（:name: / :name@host:）に一致したときだけ tag を付ける
	if (custom) {
		const name = custom[1];
		const host = custom[2] == "." ? IsNull() : custom[2] || IsNull();
		const emoji = await Emojis.findOneBy({
			name,
			host,
		});

		if (emoji) object.tag = [renderEmoji(emoji)];
	}

	return object;
};
