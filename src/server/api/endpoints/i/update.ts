import $ from 'cafy'; import ID from '../../../../misc/cafy-id';
import User, { isValidName, isValidDescription, isValidLocation, isValidBirthday, pack, ILocalUser } from '../../../../models/user';
import { publishMainStream } from '../../../../stream';
import DriveFile from '../../../../models/drive-file';
import acceptAllFollowRequests from '../../../../services/following/requests/accept-all';
import { IApp } from '../../../../models/app';
import { publishToFollowers } from '../../../../services/i/update';
import getParams from '../../get-params';
import getDriveFileUrl from '../../../../misc/get-drive-file-url';

export const meta = {
	desc: {
		'ja-JP': 'アカウント情報を更新します。',
		'en-US': 'Update myself'
	},

	requireCredential: true,

	kind: 'account-write',

	params: {
		name: $.str.optional.nullable.pipe(isValidName).note({
			desc: {
				'ja-JP': '名前(ハンドルネームやニックネーム)'
			}
		}),

		description: $.str.optional.nullable.pipe(isValidDescription).note({
			desc: {
				'ja-JP': 'アカウントの説明や自己紹介'
			}
		}),

		location: $.str.optional.nullable.pipe(isValidLocation).note({
			desc: {
				'ja-JP': '住んでいる地域、所在'
			}
		}),

		birthday: $.str.optional.nullable.pipe(isValidBirthday).note({
			desc: {
				'ja-JP': '誕生日 (YYYY-MM-DD形式)'
			}
		}),

		avatarId: $.type(ID).optional.nullable.note({
			desc: {
				'ja-JP': 'アイコンに設定する画像のドライブファイルID'
			}
		}),

		bannerId: $.type(ID).optional.nullable.note({
			desc: {
				'ja-JP': 'バナーに設定する画像のドライブファイルID'
			}
		}),

		wallpaperId: $.type(ID).optional.nullable.note({
			desc: {
				'ja-JP': '壁紙に設定する画像のドライブファイルID'
			}
		}),

		isLocked: $.bool.optional.note({
			desc: {
				'ja-JP': '鍵アカウントか否か'
			}
		}),

		carefulBot: $.bool.optional.note({
			desc: {
				'ja-JP': 'Botからのフォローを承認制にするか'
			}
		}),

		isBot: $.bool.optional.note({
			desc: {
				'ja-JP': 'Botか否か'
			}
		}),

		isCat: $.bool.optional.note({
			desc: {
				'ja-JP': '猫か否か'
			}
		}),

		autoWatch: $.bool.optional.note({
			desc: {
				'ja-JP': '投稿の自動ウォッチをするか否か'
			}
		}),

		alwaysMarkNsfw: $.bool.optional.note({
			desc: {
				'ja-JP': 'アップロードするメディアをデフォルトで「閲覧注意」として設定するか'
			}
		}),
	}
};

export default async (params: any, user: ILocalUser, app: IApp) => new Promise(async (res, rej) => {
	const [ps, psErr] = getParams(meta, params);
	if (psErr) return rej(psErr);

	const isSecure = user != null && app == null;

	const updates = {} as any;

	if (ps.name !== undefined) updates.name = ps.name;
	if (ps.description !== undefined) updates.description = ps.description;
	if (ps.location !== undefined) updates['profile.location'] = ps.location;
	if (ps.birthday !== undefined) updates['profile.birthday'] = ps.birthday;
	if (ps.avatarId !== undefined) updates.avatarId = ps.avatarId;
	if (ps.bannerId !== undefined) updates.bannerId = ps.bannerId;
	if (ps.wallpaperId !== undefined) updates.wallpaperId = ps.wallpaperId;
	if (typeof ps.isLocked == 'boolean') updates.isLocked = ps.isLocked;
	if (typeof ps.isBot == 'boolean') updates.isBot = ps.isBot;
	if (typeof ps.carefulBot == 'boolean') updates.carefulBot = ps.carefulBot;
	if (typeof ps.isCat == 'boolean') updates.isCat = ps.isCat;
	if (typeof ps.autoWatch == 'boolean') updates['settings.autoWatch'] = ps.autoWatch;
	if (typeof ps.alwaysMarkNsfw == 'boolean') updates['settings.alwaysMarkNsfw'] = ps.alwaysMarkNsfw;

	if (ps.avatarId) {
		const avatar = await DriveFile.findOne({
			_id: ps.avatarId
		});

		if (avatar == null) return rej('avatar not found');
		if (!avatar.contentType.startsWith('image/')) return rej('avatar not an image');

		updates.avatarUrl = getDriveFileUrl(avatar, true);

		if (avatar.metadata.properties.avgColor) {
			updates.avatarColor = avatar.metadata.properties.avgColor;
		}
	}

	if (ps.bannerId) {
		const banner = await DriveFile.findOne({
			_id: ps.bannerId
		});

		if (banner == null) return rej('banner not found');
		if (!banner.contentType.startsWith('image/')) return rej('banner not an image');

		updates.bannerUrl = getDriveFileUrl(banner, false);

		if (banner.metadata.properties.avgColor) {
			updates.bannerColor = banner.metadata.properties.avgColor;
		}
	}

	if (ps.wallpaperId !== undefined) {
		if (ps.wallpaperId === null) {
			updates.wallpaperUrl = null;
			updates.wallpaperColor = null;
		} else {
			const wallpaper = await DriveFile.findOne({
				_id: ps.wallpaperId
			});

			if (wallpaper == null) return rej('wallpaper not found');

			updates.wallpaperUrl = getDriveFileUrl(wallpaper);

			if (wallpaper.metadata.properties.avgColor) {
				updates.wallpaperColor = wallpaper.metadata.properties.avgColor;
			}
		}
	}

	await User.update(user._id, {
		$set: updates
	});

	// Serialize
	const iObj = await pack(user._id, user, {
		detail: true,
		includeSecrets: isSecure
	});

	// Send response
	res(iObj);

	// Publish meUpdated event
	publishMainStream(user._id, 'meUpdated', iObj);

	// 鍵垢を解除したとき、溜まっていたフォローリクエストがあるならすべて承認
	if (user.isLocked && ps.isLocked === false) {
		acceptAllFollowRequests(user);
	}

	// フォロワーにUpdateを配信
	publishToFollowers(user._id);
});
