import $ from 'cafy';
import define from '../../../define';
import perUserDriveChart from '../../../../../services/chart/per-user-drive';
import ID, { transform } from '../../../../../misc/cafy-id';

export const meta = {
	stability: 'stable',

	desc: {
		'ja-JP': 'ユーザーごとのドライブのチャートを取得します。'
	},

	params: {
		span: {
			validator: $.str.or(['day', 'hour']),
			desc: {
				'ja-JP': '集計のスパン (day または hour)'
			}
		},

		limit: {
			validator: $.num.optional.range(1, 500),
			default: 30,
			desc: {
				'ja-JP': '最大数。例えば 30 を指定したとすると、スパンが"day"の場合は30日分のデータが、スパンが"hour"の場合は30時間分のデータが返ります。'
			}
		},

		userId: {
			validator: $.type(ID),
			transform: transform,
			desc: {
				'ja-JP': '対象のユーザーのID',
				'en-US': 'Target user ID'
			}
		}
	}
};

export default define(meta, (ps) => new Promise(async (res, rej) => {
	const stats = await perUserDriveChart.getChart(ps.span as any, ps.limit, ps.userId);

	res(stats);
}));
