import * as request from 'request-promise-native';
import User from '../../../models/user';
const createPost = require('../../../server/api/endpoints/posts/create');

export default async ({ data }, done) => {
	try {
		const asyncBot = User.findOne({ _id: data.userId });

		// Fetch parent status
		const parentStatuses = await request({
			url: `${data.parentUrl}/statuses`,
			headers: {
				'User-Agent': 'misskey'
			},
			json: true
		});

		const parentState = parentStatuses[0].state;
		const stillFailed = parentState == 'failure' || parentState == 'error';
		const text = stillFailed ?
			`**⚠️BUILD STILL FAILED⚠️**: ?[${data.message}](${data.htmlUrl})` :
			`**🚨BUILD FAILED🚨**: →→→?[${data.message}](${data.htmlUrl})←←←`;

		createPost({ text }, await asyncBot);
	} catch (error) {
		done(error);
		return;
	}

	done();
};
