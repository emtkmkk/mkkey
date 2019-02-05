import Notification from '../../../../models/notification';
import { publishMainStream } from '../../../../services/stream';
import User from '../../../../models/user';
import define from '../../define';

export const meta = {
	desc: {
		'ja-JP': '全ての通知を既読にします。',
		'en-US': 'Mark all notifications as read.'
	},

	requireCredential: true,

	kind: 'notification-write'
};

export default define(meta, (ps, user) => new Promise(async (res, rej) => {
	// Update documents
	await Notification.update({
		notifieeId: user._id,
		isRead: false
	}, {
			$set: {
				isRead: true
			}
		}, {
			multi: true
		});

	// Response
	res();

	// Update flag
	User.update({ _id: user._id }, {
		$set: {
			hasUnreadNotification: false
		}
	});

	// 全ての通知を読みましたよというイベントを発行
	publishMainStream(user._id, 'readAllNotifications');
}));
