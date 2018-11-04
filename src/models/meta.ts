import db from '../db/mongodb';
import config from '../config';

const Meta = db.get<IMeta>('meta');
export default Meta;

// 後方互換性のため。
// 過去のMisskeyではインスタンス名や紹介を設定ファイルに記述していたのでそれを移行
if ((config as any).name) {
	Meta.findOne({}).then(m => {
		if (m != null && m.name == null) {
			Meta.update({}, {
				$set: {
					name: (config as any).name
				}
			});
		}
	});
}
if ((config as any).description) {
	Meta.findOne({}).then(m => {
		if (m != null && m.description == null) {
			Meta.update({}, {
				$set: {
					description: (config as any).description
				}
			});
		}
	});
}

export type IMeta = {
	name?: string;
	description?: string;
	broadcasts?: any[];
	stats?: {
		notesCount: number;
		originalNotesCount: number;
		usersCount: number;
		originalUsersCount: number;
	};
	disableRegistration?: boolean;
	disableLocalTimeline?: boolean;
	hidedTags?: string[];
	bannerUrl?: string;
};
