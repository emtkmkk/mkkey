import $ from 'cafy';
import Hashtag from '../../../../models/hashtag';
import define from '../../define';
import * as escapeRegexp from 'escape-regexp';

export const meta = {
	desc: {
		'ja-JP': 'ハッシュタグを検索します。'
	},

	requireCredential: false,

	params: {
		limit: {
			validator: $.num.optional.range(1, 100),
			default: 10,
			desc: {
				'ja-JP': '最大数'
			}
		},

		query: {
			validator: $.str,
			desc: {
				'ja-JP': 'クエリ'
			}
		},

		offset: {
			validator: $.num.optional.min(0),
			default: 0,
			desc: {
				'ja-JP': 'オフセット'
			}
		}
	}
};

export default define(meta, (ps) => new Promise(async (res, rej) => {
	const hashtags = await Hashtag
		.find({
			tag: new RegExp('^' + escapeRegexp(ps.query.toLowerCase()))
		}, {
			sort: {
				count: -1
			},
			limit: ps.limit,
			skip: ps.offset
		});

	res(hashtags.map(tag => tag.tag));
}));
