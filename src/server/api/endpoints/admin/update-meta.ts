import $ from 'cafy';
import Meta from '../../../../models/meta';
import getParams from '../../get-params';

export const meta = {
	desc: {
		'ja-JP': 'インスタンスの設定を更新します。'
	},

	requireCredential: true,
	requireAdmin: true,

	params: {
		broadcasts: $.arr($.obj()).optional.nullable.note({
			desc: {
				'ja-JP': 'ブロードキャスト'
			}
		}),

		emojis: $.arr($.obj()).optional.note({
			desc: {
				'ja-JP': 'カスタム絵文字定義'
			}
		}),

		disableRegistration: $.bool.optional.nullable.note({
			desc: {
				'ja-JP': '招待制か否か'
			}
		}),

		disableLocalTimeline: $.bool.optional.nullable.note({
			desc: {
				'ja-JP': 'ローカルタイムライン(とソーシャルタイムライン)を無効にするか否か'
			}
		}),

		hidedTags: $.arr($.str).optional.nullable.note({
			desc: {
				'ja-JP': '統計などで無視するハッシュタグ'
			}
		}),

		bannerUrl: $.str.optional.nullable.note({
			desc: {
				'ja-JP': 'インスタンスのバナー画像URL'
			}
		}),
	}
};

export default (params: any) => new Promise(async (res, rej) => {
	const [ps, psErr] = getParams(meta, params);
	if (psErr) return rej(psErr);

	const set = {} as any;

	if (ps.broadcasts) {
		set.broadcasts = ps.broadcasts;
	}

	if (ps.emojis) {
		set.emojis = ps.emojis;
	}

	if (typeof ps.disableRegistration === 'boolean') {
		set.disableRegistration = ps.disableRegistration;
	}

	if (typeof ps.disableLocalTimeline === 'boolean') {
		set.disableLocalTimeline = ps.disableLocalTimeline;
	}

	if (Array.isArray(ps.hidedTags)) {
		set.hidedTags = ps.hidedTags;
	}

	if (ps.bannerUrl !== undefined) {
		set.bannerUrl = ps.bannerUrl;
	}

	await Meta.update({}, {
		$set: set
	}, { upsert: true });

	res();
});
