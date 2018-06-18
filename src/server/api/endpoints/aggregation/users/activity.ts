import $ from 'cafy'; import ID from '../../../../../cafy-id';
import User from '../../../../../models/user';
import Note from '../../../../../models/note';

// TODO: likeやfollowも集計

/**
 * Aggregate activity of a user
 */
module.exports = (params: any) => new Promise(async (res, rej) => {
	// Get 'limit' parameter
	const [limit = 365, limitErr] = $.num.optional().range(1, 365).get(params.limit);
	if (limitErr) return rej('invalid limit param');

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

	const datas = await Note
		.aggregate([
			{ $match: { userId: user._id } },
			{ $project: {
				renoteId: '$renoteId',
				replyId: '$replyId',
				createdAt: { $add: ['$createdAt', 9 * 60 * 60 * 1000] } // Convert into JST
			}},
			{ $project: {
				date: {
					year: { $year: '$createdAt' },
					month: { $month: '$createdAt' },
					day: { $dayOfMonth: '$createdAt' }
				},
				type: {
					$cond: {
						if: { $ne: ['$renoteId', null] },
						then: 'renote',
						else: {
							$cond: {
								if: { $ne: ['$replyId', null] },
								then: 'reply',
								else: 'note'
							}
						}
					}
				}}
			},
			{ $group: { _id: {
				date: '$date',
				type: '$type'
			}, count: { $sum: 1 } } },
			{ $group: {
				_id: '$_id.date',
				data: { $addToSet: {
					type: '$_id.type',
					count: '$count'
				}}
			} }
		]);

	datas.forEach((data: any) => {
		data.date = data._id;
		delete data._id;

		data.notes = (data.data.filter((x: any) => x.type == 'note')[0] || { count: 0 }).count;
		data.renotes = (data.data.filter((x: any) => x.type == 'renote')[0] || { count: 0 }).count;
		data.replies = (data.data.filter((x: any) => x.type == 'reply')[0] || { count: 0 }).count;

		delete data.data;
	});

	const graph = [];

	for (let i = 0; i < limit; i++) {
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
				notes: 0,
				renotes: 0,
				replies: 0
			});
		}
	}

	res(graph);
});
