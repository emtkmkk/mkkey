import $ from 'cafy';
import User from '../../../../models/user';
import { publishMainStream } from '../../../../services/stream';
import define from '../../define';

export const meta = {
	requireCredential: true,

	secure: true,

	params: {
		name: {
			validator: $.str
		},

		value: {
			validator: $.any.nullable
		}
	}
};

export default define(meta, (ps, user) => new Promise(async (res, rej) => {
	const x: any = {};
	x[`clientSettings.${ps.name}`] = ps.value;

	await User.update(user._id, {
		$set: x
	});

	res();

	// Publish event
	publishMainStream(user._id, 'clientSettingUpdated', {
		key: ps.name,
		value: ps.value
	});
}));
