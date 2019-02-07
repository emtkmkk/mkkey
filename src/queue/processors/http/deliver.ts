import * as bq from 'bee-queue';

import request from '../../../remote/activitypub/request';
import { queueLogger } from '../../logger';
import { registerOrFetchInstanceDoc } from '../../../services/register-or-fetch-instance-doc';
import Instance from '../../../models/instance';

export default async (job: bq.Job, done: any): Promise<void> => {
	try {
		await request(job.data.user, job.data.to, job.data.content);

		// Update stats
		registerOrFetchInstanceDoc(job.data.user.host).then(i => {
			Instance.update({ _id: i._id }, {
				$set: {
					latestRequestSentAt: new Date(),
					latestStatus: 200
				}
			});
		});

		done();
	} catch (res) {
		// Update stats
		registerOrFetchInstanceDoc(job.data.user.host).then(i => {
			Instance.update({ _id: i._id }, {
				$set: {
					latestRequestSentAt: new Date(),
					latestStatus: res != null && res.hasOwnProperty('statusCode') ? res.statusCode : null
				}
			});
		});

		if (res != null && res.hasOwnProperty('statusCode')) {
			queueLogger.warn(`deliver failed: ${res.statusCode} ${res.statusMessage} to=${job.data.to}`);

			if (res.statusCode >= 400 && res.statusCode < 500) {
				// HTTPステータスコード4xxはクライアントエラーであり、それはつまり
				// 何回再送しても成功することはないということなのでエラーにはしないでおく
				done();
			} else {
				done(res.statusMessage);
			}
		} else {
			queueLogger.warn(`deliver failed: ${res} to=${job.data.to}`);
			done();
		}
	}
};
