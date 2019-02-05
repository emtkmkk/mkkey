import Note, { INote } from '../../models/note';
import { IUser, isLocalUser } from '../../models/user';
import { publishNoteStream } from '../stream';
import renderDelete from '../../remote/activitypub/renderer/delete';
import { renderActivity } from '../../remote/activitypub/renderer';
import { deliver } from '../../queue';
import Following from '../../models/following';
import renderTombstone from '../../remote/activitypub/renderer/tombstone';
import notesChart from '../../chart/notes';
import perUserNotesChart from '../../chart/per-user-notes';
import config from '../../config';
import NoteUnread from '../../models/note-unread';
import read from './read';
import DriveFile from '../../models/drive-file';

/**
 * 投稿を削除します。
 * @param user 投稿者
 * @param note 投稿
 */
export default async function(user: IUser, note: INote) {
	const deletedAt = new Date();

	await Note.update({
		_id: note._id,
		userId: user._id
	}, {
		$set: {
			deletedAt: deletedAt,
			text: null,
			tags: [],
			fileIds: [],
			renoteId: null,
			poll: null,
			geo: null,
			cw: null
		}
	});

	if (note.renoteId) {
		Note.update({ _id: note.renoteId }, {
			$inc: {
				renoteCount: -1,
				score: -1
			},
			$pull: {
				_quoteIds: note._id
			}
		});
	}

	publishNoteStream(note._id, 'deleted', {
		deletedAt: deletedAt
	});

	// この投稿が関わる未読通知を削除
	NoteUnread.find({
		noteId: note._id
	}).then(unreads => {
		for (const unread of unreads) {
			read(unread.userId, unread.noteId);
		}
	});

	// ファイルが添付されていた場合ドライブのファイルの「このファイルが添付された投稿一覧」プロパティからこの投稿を削除
	if (note.fileIds) {
		for (const fileId of note.fileIds) {
			DriveFile.update({ _id: fileId }, {
				$pull: {
					'metadata.attachedNoteIds': note._id
				}
			});
		}
	}

	//#region ローカルの投稿なら削除アクティビティを配送
	if (isLocalUser(user)) {
		const content = renderActivity(renderDelete(renderTombstone(`${config.url}/notes/${note._id}`), user));

		const followings = await Following.find({
			followeeId: user._id,
			'_follower.host': { $ne: null }
		});

		for (const following of followings) {
			deliver(user, content, following._follower.inbox);
		}
	}
	//#endregion

	// 統計を更新
	notesChart.update(note, false);
	perUserNotesChart.update(user, note, false);
}
