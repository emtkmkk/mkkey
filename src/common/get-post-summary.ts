/**
 * 投稿を表す文字列を取得します。
 * @param {*} post 投稿
 */
const summarize = (post: any): string => {
	let summary = '';

	// チャンネル
	summary += post.channel ? `${post.channel.title}:` : '';

	// 本文
	summary += post.text ? post.text : '';

	// メディアが添付されているとき
	if (post.media) {
		summary += ` (${post.media.length}つのメディア)`;
	}

	// 投票が添付されているとき
	if (post.poll) {
		summary += ' (投票)';
	}

	// 返信のとき
	if (post.reply_to_id) {
		if (post.reply_to) {
			summary += ` RE: ${summarize(post.reply_to)}`;
		} else {
			summary += ' RE: ...';
		}
	}

	// Repostのとき
	if (post.repost_id) {
		if (post.repost) {
			summary += ` RP: ${summarize(post.repost)}`;
		} else {
			summary += ' RP: ...';
		}
	}

	return summary.trim();
};

export default summarize;
