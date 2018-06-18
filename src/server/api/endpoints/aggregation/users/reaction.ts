import $ from 'cafy'; import ID from '../../../../../cafy-id';
import User from '../../../../../models/user';
import Reaction from '../../../../../models/note-reaction';

/**
 * Aggregate reaction of a user
 */
module.exports = (params: any) => new Promise(async (res, rej) => {
	// Get 'userId' parameter
	const [userId, userIdErr] = $.type(ID).get(params.userId);
	if (userIdErr) return rej('invalid userId param');

	// Lookup user
	const user = await User.findOne({
		_id: userId
	}, {
		fields: {
			_id: true
		}
	});

	if (user === null) {
		return rej('user not found');
	}

	const datas = await Reaction
		.aggregate([
			{ $match: { userId: user._id } },
			{ $project: {
				createdAt: { $add: ['$createdAt', 9 * 60 * 60 * 1000] } // Convert into JST
			}},
			{ $project: {
				date: {
					year: { $year: '$createdAt' },
					month: { $month: '$createdAt' },
					day: { $dayOfMonth: '$createdAt' }
				}
			}},
			{ $group: {
				_id: '$date',
				count: { $sum: 1 }
			}}
		]);

	datas.forEach((data: any) => {
		data.date = data._id;
		delete data._id;
	});

	const graph = [];

	for (let i = 0; i < 30; i++) {
		const day = new Date(new Date().setDate(new Date().getDate() - i));

		const data = datas.filter((d: any) =>
			d.date.year == day.getFullYear() && d.date.month == day.getMonth() + 1 && d.date.day == day.getDate()
		)[0];

		if (data) {
			graph.push(data);
		} else {
			graph.push({
				date: {
					year: day.getFullYear(),
					month: day.getMonth() + 1, // In JavaScript, month is zero-based.
					day: day.getDate()
				},
				count: 0
			});
		}
	}

	res(graph);
});
