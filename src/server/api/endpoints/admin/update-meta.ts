import $ from 'cafy';
import Meta from '../../../../models/meta';
import define from '../../define';

export const meta = {
	desc: {
		'ja-JP': 'インスタンスの設定を更新します。'
	},

	requireCredential: true,
	requireAdmin: true,

	params: {
		broadcasts: {
			validator: $.arr($.obj()).optional.nullable,
			desc: {
				'ja-JP': 'ブロードキャスト'
			}
		},

		disableRegistration: {
			validator: $.bool.optional.nullable,
			desc: {
				'ja-JP': '招待制か否か'
			}
		},

		disableLocalTimeline: {
			validator: $.bool.optional.nullable,
			desc: {
				'ja-JP': 'ローカルタイムライン(とソーシャルタイムライン)を無効にするか否か'
			}
		},

		hidedTags: {
			validator: $.arr($.str).optional.nullable,
			desc: {
				'ja-JP': '統計などで無視するハッシュタグ'
			}
		},

		bannerUrl: {
			validator: $.str.optional.nullable,
			desc: {
				'ja-JP': 'インスタンスのバナー画像URL'
			}
		},

		name: {
			validator: $.str.optional.nullable,
			desc: {
				'ja-JP': 'インスタンス名'
			}
		},

		description: {
			validator: $.str.optional.nullable,
			desc: {
				'ja-JP': 'インスタンスの紹介文'
			}
		},

		maxNoteTextLength: {
			validator: $.num.optional.min(1),
			desc: {
				'ja-JP': '投稿の最大文字数'
			}
		},

		localDriveCapacityMb: {
			validator: $.num.optional.min(0),
			desc: {
				'ja-JP': 'ローカルユーザーひとりあたりのドライブ容量 (メガバイト単位)',
				'en-US': 'Drive capacity of a local user (MB)'
			}
		},

		remoteDriveCapacityMb: {
			validator: $.num.optional.min(0),
			desc: {
				'ja-JP': 'リモートユーザーひとりあたりのドライブ容量 (メガバイト単位)',
				'en-US': 'Drive capacity of a remote user (MB)'
			}
		},

		cacheRemoteFiles: {
			validator: $.bool.optional,
			desc: {
				'ja-JP': 'リモートのファイルをキャッシュするか否か'
			}
		},

		enableRecaptcha: {
			validator: $.bool.optional,
			desc: {
				'ja-JP': 'reCAPTCHAを使用するか否か'
			}
		},

		recaptchaSiteKey: {
			validator: $.str.optional.nullable,
			desc: {
				'ja-JP': 'reCAPTCHA site key'
			}
		},

		recaptchaSecretKey: {
			validator: $.str.optional.nullable,
			desc: {
				'ja-JP': 'reCAPTCHA secret key'
			}
		},

		proxyAccount: {
			validator: $.str.optional.nullable,
			desc: {
				'ja-JP': 'Proxy account username'
			}
		}
	}
};

export default define(meta, (ps) => new Promise(async (res, rej) => {
	const set = {} as any;

	if (ps.broadcasts) {
		set.broadcasts = ps.broadcasts;
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

	if (ps.name !== undefined) {
		set.name = ps.name;
	}

	if (ps.description !== undefined) {
		set.description = ps.description;
	}

	if (ps.maxNoteTextLength) {
		set.maxNoteTextLength = ps.maxNoteTextLength;
	}

	if (ps.localDriveCapacityMb !== undefined) {
		set.localDriveCapacityMb = ps.localDriveCapacityMb;
	}

	if (ps.remoteDriveCapacityMb !== undefined) {
		set.remoteDriveCapacityMb = ps.remoteDriveCapacityMb;
	}

	if (ps.cacheRemoteFiles !== undefined) {
		set.cacheRemoteFiles = ps.cacheRemoteFiles;
	}

	if (ps.enableRecaptcha !== undefined) {
		set.enableRecaptcha = ps.enableRecaptcha;
	}

	if (ps.recaptchaSiteKey !== undefined) {
		set.recaptchaSiteKey = ps.recaptchaSiteKey;
	}

	if (ps.recaptchaSecretKey !== undefined) {
		set.recaptchaSecretKey = ps.recaptchaSecretKey;
	}

	if (ps.proxyAccount !== undefined) {
		set.proxyAccount = ps.proxyAccount;
	}

	await Meta.update({}, {
		$set: set
	}, { upsert: true });

	res();
}));
