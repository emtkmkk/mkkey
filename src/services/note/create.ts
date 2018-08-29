import es from '../../db/elasticsearch';
import Note, { pack, INote } from '../../models/note';
import User, { isLocalUser, IUser, isRemoteUser, IRemoteUser, ILocalUser } from '../../models/user';
import { publishUserStream, publishLocalTimelineStream, publishHybridTimelineStream, publishGlobalTimelineStream, publishUserListStream } from '../../stream';
import Following from '../../models/following';
import { deliver } from '../../queue';
import renderNote from '../../remote/activitypub/renderer/note';
import renderCreate from '../../remote/activitypub/renderer/create';
import renderAnnounce from '../../remote/activitypub/renderer/announce';
import packAp from '../../remote/activitypub/renderer';
import { IDriveFile } from '../../models/drive-file';
import notify from '../../notify';
import NoteWatching from '../../models/note-watching';
import watch from './watch';
import Mute from '../../models/mute';
import parse from '../../mfm/parse';
import { IApp } from '../../models/app';
import UserList from '../../models/user-list';
import resolveUser from '../../remote/resolve-user';
import Meta from '../../models/meta';
import config from '../../config';
import registerHashtag from '../register-hashtag';
import isQuote from '../../misc/is-quote';
import { TextElementMention } from '../../mfm/parse/elements/mention';
import { TextElementHashtag } from '../../mfm/parse/elements/hashtag';
import { updateNoteStats } from '../update-chart';

type NotificationType = 'reply' | 'renote' | 'quote' | 'mention';

class NotificationManager {
	private notifier: IUser;
	private note: INote;
	private queue: Array<{
		target: ILocalUser['_id'];
		reason: NotificationType;
	}>;

	constructor(notifier: IUser, note: INote) {
		this.notifier = notifier;
		this.note = note;
		this.queue = [];
	}

	public push(notifiee: ILocalUser['_id'], reason: NotificationType) {
		// 自分自身へは通知しない
		if (this.notifier._id.equals(notifiee)) return;

		const exist = this.queue.find(x => x.target.equals(notifiee));

		if (exist) {
			// 「メンションされているかつ返信されている」場合は、メンションとしての通知ではなく返信としての通知にする
			if (reason != 'mention') {
				exist.reason = reason;
			}
		} else {
			this.queue.push({
				reason: reason,
				target: notifiee
			});
		}
	}

	public deliver() {
		this.queue.forEach(async x => {
			// ミュート情報を取得
			const mentioneeMutes = await Mute.find({
				muterId: x.target
			});

			const mentioneesMutedUserIds = mentioneeMutes.map(m => m.muteeId.toString());

			// 通知される側のユーザーが通知する側のユーザーをミュートしていない限りは通知する
			if (!mentioneesMutedUserIds.includes(this.notifier._id.toString())) {
				notify(x.target, this.notifier._id, x.reason, {
					noteId: this.note._id
				});
			}
		});
	}
}

type Option = {
	createdAt?: Date;
	text?: string;
	reply?: INote;
	renote?: INote;
	media?: IDriveFile[];
	geo?: any;
	poll?: any;
	viaMobile?: boolean;
	cw?: string;
	visibility?: string;
	visibleUsers?: IUser[];
	uri?: string;
	app?: IApp;
};

export default async (user: IUser, data: Option, silent = false) => new Promise<INote>(async (res, rej) => {
	const isFirstNote = user.notesCount === 0;

	if (data.createdAt == null) data.createdAt = new Date();
	if (data.visibility == null) data.visibility = 'public';
	if (data.viaMobile == null) data.viaMobile = false;

	if (data.visibleUsers) {
		data.visibleUsers = data.visibleUsers.filter(x => x != null);
	}

	if (data.reply && data.reply.deletedAt != null) {
		return rej();
	}

	if (data.renote && data.renote.deletedAt != null) {
		return rej();
	}

	// リプライ先が自分以外の非公開の投稿なら禁止
	if (data.reply && data.reply.visibility == 'private' && !data.reply.userId.equals(user._id)) {
		return rej();
	}

	// Renote先が自分以外の非公開の投稿なら禁止
	if (data.renote && data.renote.visibility == 'private' && !data.renote.userId.equals(user._id)) {
		return rej();
	}

	if (data.text) {
		data.text = data.text.trim();
	}

	// Parse MFM
	const tokens = data.text ? parse(data.text) : [];

	const tags = extractHashtags(tokens);

	const mentionedUsers = await extractMentionedUsers(tokens);

	const note = await insertNote(user, data, tokens, tags, mentionedUsers);

	res(note);

	if (note == null) {
		return;
	}

	// 統計を更新
	updateNoteStats(note, true);

	// ハッシュタグ登録
	tags.map(tag => registerHashtag(user, tag));

	// Increment notes count
	incNotesCount(user);

	// Increment notes count (user)
	incNotesCountOfUser(user);

	if (data.reply) {
		saveReply(data.reply, note);
	}

	if (data.renote) {
		incRenoteCount(data.renote);
	}

	if (isQuote(note)) {
		saveQuote(data.renote, note);
	}

	// Pack the note
	const noteObj = await pack(note);

	if (isFirstNote) {
		noteObj.isFirstNote = true;
	}

	const nm = new NotificationManager(user, note);
	const nmRelatedPromises = [];

	createMentionedEvents(mentionedUsers, noteObj, nm);

	const noteActivity = await renderActivity(data, note);

	if (isLocalUser(user)) {
		deliverNoteToMentionedRemoteUsers(mentionedUsers, user, noteActivity);
	}

	// If has in reply to note
	if (data.reply) {
		// Fetch watchers
		nmRelatedPromises.push(notifyToWatchersOfReplyee(data.reply, user, nm));

		// この投稿をWatchする
		if (isLocalUser(user) && user.settings.autoWatch !== false) {
			watch(user._id, data.reply);
		}

		// 通知
		if (isLocalUser(data.reply._user)) {
			nm.push(data.reply.userId, 'reply');
			publishUserStream(data.reply.userId, 'reply', noteObj);
		}
	}

	// If it is renote
	if (data.renote) {
		const type = data.text ? 'quote' : 'renote';

		// Notify
		if (isLocalUser(data.renote._user)) {
			nm.push(data.renote.userId, type);
		}

		// Fetch watchers
		nmRelatedPromises.push(notifyToWatchersOfRenotee(data.renote, user, nm, type));

		// この投稿をWatchする
		if (isLocalUser(user) && user.settings.autoWatch !== false) {
			watch(user._id, data.renote);
		}

		// Publish event
		if (!user._id.equals(data.renote.userId) && isLocalUser(data.renote._user)) {
			publishUserStream(data.renote.userId, 'renote', noteObj);
		}
	}

	if (!silent) {
		publish(user, note, noteObj, data.reply, data.renote, data.visibleUsers, noteActivity);
	}

	Promise.all(nmRelatedPromises).then(() => {
		nm.deliver();
	});

	// Register to search database
	index(note);
});

async function renderActivity(data: Option, note: INote) {
	const content = data.renote && data.text == null
		? renderAnnounce(data.renote.uri ? data.renote.uri : `${config.url}/notes/${data.renote._id}`, note)
		: renderCreate(await renderNote(note, false), note);

	return packAp(content);
}

function incRenoteCount(renote: INote) {
	Note.update({ _id: renote._id }, {
		$inc: {
			renoteCount: 1
		}
	});
}

async function publish(user: IUser, note: INote, noteObj: any, reply: INote, renote: INote, visibleUsers: IUser[], noteActivity: any) {
	if (isLocalUser(user)) {
		// 投稿がリプライかつ投稿者がローカルユーザーかつリプライ先の投稿の投稿者がリモートユーザーなら配送
		if (reply && isRemoteUser(reply._user)) {
			deliver(user, noteActivity, reply._user.inbox);
		}

		// 投稿がRenoteかつ投稿者がローカルユーザーかつRenote元の投稿の投稿者がリモートユーザーなら配送
		if (renote && isRemoteUser(renote._user)) {
			deliver(user, noteActivity, renote._user.inbox);
		}

		if (['private', 'followers', 'specified'].includes(note.visibility)) {
			// Publish event to myself's stream
			publishUserStream(note.userId, 'note', await pack(note, user, {
				detail: true
			}));
		} else {
			// Publish event to myself's stream
			publishUserStream(note.userId, 'note', noteObj);

			// Publish note to local and hybrid timeline stream
			if (note.visibility != 'home') {
				publishLocalTimelineStream(noteObj);
			}

			if (note.visibility == 'public') {
				publishHybridTimelineStream(null, noteObj);
			}
		}
	}

	// Publish note to global timeline stream
	if (note.visibility == 'public' && note.replyId == null) {
		publishGlobalTimelineStream(noteObj);
	}

	if (note.visibility == 'specified') {
		visibleUsers.forEach(async (u) => {
			const n = await pack(note, u, {
				detail: true
			});
			publishUserStream(u._id, 'note', n);
			publishHybridTimelineStream(u._id, n);
		});
	}

	if (['public', 'home', 'followers'].includes(note.visibility)) {
		// フォロワーに配信
		publishToFollowers(note, noteObj, user, noteActivity);
	}

	// リストに配信
	publishToUserLists(note, noteObj);
}

async function insertNote(user: IUser, data: Option, tokens: ReturnType<typeof parse>, tags: string[], mentionedUsers: IUser[]) {
	const insert: any = {
		createdAt: data.createdAt,
		mediaIds: data.media ? data.media.map(file => file._id) : [],
		replyId: data.reply ? data.reply._id : null,
		renoteId: data.renote ? data.renote._id : null,
		text: data.text,
		poll: data.poll,
		cw: data.cw == null ? null : data.cw,
		tags,
		tagsLower: tags.map(tag => tag.toLowerCase()),
		userId: user._id,
		viaMobile: data.viaMobile,
		geo: data.geo || null,
		appId: data.app ? data.app._id : null,
		visibility: data.visibility,
		visibleUserIds: data.visibility == 'specified'
			? data.visibleUsers
				? data.visibleUsers.map(u => u._id)
				: []
			: [],

		// 以下非正規化データ
		_reply: data.reply ? {
			userId: data.reply.userId,
			user: {
				host: data.reply._user.host
			}
		} : null,
		_renote: data.renote ? {
			userId: data.renote.userId,
			user: {
				host: data.renote._user.host
			}
		} : null,
		_user: {
			host: user.host,
			inbox: isRemoteUser(user) ? user.inbox : undefined
		}
	};

	if (data.uri != null) insert.uri = data.uri;

	// Append mentions data
	if (mentionedUsers.length > 0) {
		insert.mentions = mentionedUsers.map(u => u._id);
		insert.mentionedRemoteUsers = mentionedUsers.filter(u => isRemoteUser(u)).map(u => ({
			uri: (u as IRemoteUser).uri,
			username: u.username,
			host: u.host
		}));
	}

	// 投稿を作成
	try {
		return await Note.insert(insert);
	} catch (e) {
		// duplicate key error
		if (e.code === 11000) {
			return null;
		}

		console.error(e);
		throw 'something happened';
	}
}

function extractHashtags(tokens: ReturnType<typeof parse>): string[] {
	// Extract hashtags
	const hashtags = tokens
		.filter(t => t.type == 'hashtag')
		.map(t => (t as TextElementHashtag).hashtag)
		.filter(tag => tag.length <= 100);

	return [...new Set(hashtags)];
}

function index(note: INote) {
	if (note.text == null || config.elasticsearch == null) return;

	es.index({
		index: 'misskey',
		type: 'note',
		id: note._id.toString(),
		body: {
			text: note.text
		}
	});
}

async function notifyToWatchersOfRenotee(renote: INote, user: IUser, nm: NotificationManager, type: NotificationType) {
	const watchers = await NoteWatching.find({
		noteId: renote._id,
		userId: { $ne: user._id }
	}, {
			fields: {
				userId: true
			}
		});

	watchers.forEach(watcher => {
		nm.push(watcher.userId, type);
	});
}

async function notifyToWatchersOfReplyee(reply: INote, user: IUser, nm: NotificationManager) {
	const watchers = await NoteWatching.find({
		noteId: reply._id,
		userId: { $ne: user._id }
	}, {
			fields: {
				userId: true
			}
		});

	watchers.forEach(watcher => {
		nm.push(watcher.userId, 'reply');
	});
}

async function publishToUserLists(note: INote, noteObj: any) {
	const lists = await UserList.find({
		userIds: note.userId
	});

	lists.forEach(list => {
		publishUserListStream(list._id, 'note', noteObj);
	});
}

async function publishToFollowers(note: INote, noteObj: any, user: IUser, noteActivity: any) {
	const followers = await Following.find({
		followeeId: note.userId
	});

	const queue: string[] = [];

	followers.map(following => {
		const follower = following._follower;

		if (isLocalUser(follower)) {
			// ストーキングしていない場合
			if (!following.stalk) {
				// この投稿が返信ならスキップ
				if (note.replyId && !note._reply.userId.equals(following.followerId) && !note._reply.userId.equals(note.userId))
					return;
			}

			// Publish event to followers stream
			publishUserStream(following.followerId, 'note', noteObj);

			if (isRemoteUser(user) || note.visibility != 'public') {
				publishHybridTimelineStream(following.followerId, noteObj);
			}
		} else {
			// フォロワーがリモートユーザーかつ投稿者がローカルユーザーなら投稿を配信
			if (isLocalUser(user)) {
				const inbox = follower.sharedInbox || follower.inbox;
				if (!queue.includes(inbox)) queue.push(inbox);
			}
		}
	});

	queue.forEach(inbox => {
		deliver(user as any, noteActivity, inbox);
	});
}

function deliverNoteToMentionedRemoteUsers(mentionedUsers: IUser[], user: ILocalUser, noteActivity: any) {
	mentionedUsers.filter(u => isRemoteUser(u)).forEach(async (u) => {
		deliver(user, noteActivity, (u as IRemoteUser).inbox);
	});
}

function createMentionedEvents(mentionedUsers: IUser[], noteObj: any, nm: NotificationManager) {
	mentionedUsers.filter(u => isLocalUser(u)).forEach(async (u) => {
		publishUserStream(u._id, 'mention', noteObj);

		// Create notification
		nm.push(u._id, 'mention');
	});
}

function saveQuote(renote: INote, note: INote) {
	Note.update({ _id: renote._id }, {
		$push: {
			_quoteIds: note._id
		},

	});
}

function saveReply(reply: INote, note: INote) {
	Note.update({ _id: reply._id }, {
		$push: {
			_replyIds: note._id
		},
		$inc: {
			repliesCount: 1
		}
	});
}

function incNotesCountOfUser(user: IUser) {
	User.update({ _id: user._id }, {
		$inc: {
			notesCount: 1
		}
	});
}

function incNotesCount(user: IUser) {
	if (isLocalUser(user)) {
		Meta.update({}, {
			$inc: {
				'stats.notesCount': 1,
				'stats.originalNotesCount': 1
			}
		}, { upsert: true });
	} else {
		Meta.update({}, {
			$inc: {
				'stats.notesCount': 1
			}
		}, { upsert: true });
	}
}

async function extractMentionedUsers(tokens: ReturnType<typeof parse>): Promise<IUser[]> {
	if (tokens == null) return [];

	const mentionTokens = [...new Set(
		tokens
			.filter(t => t.type == 'mention') as TextElementMention[]
	)];

	const mentionedUsers = [...new Set(
		(await Promise.all(mentionTokens.map(async m => {
			try {
				return await resolveUser(m.username, m.host);
			} catch (e) {
				return null;
			}
		}))).filter(x => x != null)
	)];

	return mentionedUsers;
}
