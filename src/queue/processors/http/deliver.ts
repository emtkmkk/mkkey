import * as bq from 'bee-queue';

import request from '../../../remote/activitypub/request';

export default async (job: bq.Job, done: any): Promise<void> => {
	try {
		await request(job.data.user, job.data.to, job.data.content);
		done();
	} catch (res) {
		if (res.statusCode == null) return done();
		if (res.statusCode >= 400 && res.statusCode < 500) {
			// HTTPステータスコード4xxはクライアントエラーであり、それはつまり
			// 何回再送しても成功することはないということなのでエラーにはしないでおく
			done();
		} else {
			console.warn(`deliver failed: ${res.statusMessage}`);
			done(res.statusMessage);
		}
	}
};
