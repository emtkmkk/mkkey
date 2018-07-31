import $ from 'cafy';
import AccessToken from '../../../../models/access-token';
import { pack } from '../../../../models/app';
import { ILocalUser } from '../../../../models/user';

export const meta = {
	requireCredential: true,
	secure: true
};

export default (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'limit' parameter
	const [limit = 10, limitErr] = $.num.optional.range(1, 100).get(params.limit);
	if (limitErr) return rej('invalid limit param');

	// Get 'offset' parameter
	const [offset = 0, offsetErr] = $.num.optional.min(0).get(params.offset);
	if (offsetErr) return rej('invalid offset param');

	// Get 'sort' parameter
	const [sort = 'desc', sortError] = $.str.optional.or('desc asc').get(params.sort);
	if (sortError) return rej('invalid sort param');

	// Get tokens
	const tokens = await AccessToken
		.find({
			userId: user._id
		}, {
			limit: limit,
			skip: offset,
			sort: {
				_id: sort == 'asc' ? 1 : -1
			}
		});

	// Serialize
	res(await Promise.all(tokens.map(async token =>
		await pack(token.appId))));
});
