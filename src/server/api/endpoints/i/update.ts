import $ from 'cafy'; import ID from '../../../../misc/cafy-id';
import User, { isValidName, isValidDescription, isValidLocation, isValidBirthday, pack, ILocalUser } from '../../../../models/user';
import { publishUserStream } from '../../../../stream';
import DriveFile from '../../../../models/drive-file';
import acceptAllFollowRequests from '../../../../services/following/requests/accept-all';
import { IApp } from '../../../../models/app';
import config from '../../../../config';
import { publishToFollowers } from '../../../../services/i/update';

export const meta = {
	desc: {
		'ja-JP': 'アカウント情報を更新します。',
		'en-US': 'Update myself'
	},

	requireCredential: true,

	kind: 'account-write'
};

export default async (params: any, user: ILocalUser, app: IApp) => new Promise(async (res, rej) => {
	const isSecure = user != null && app == null;

	const updates = {} as any;

	// Get 'name' parameter
	const [name, nameErr] = $.str.optional.nullable.pipe(isValidName).get(params.name);
	if (nameErr) return rej('invalid name param');
	if (name) updates.name = name;

	// Get 'description' parameter
	const [description, descriptionErr] = $.str.optional.nullable.pipe(isValidDescription).get(params.description);
	if (descriptionErr) return rej('invalid description param');
	if (description !== undefined) updates.description = description;

	// Get 'location' parameter
	const [location, locationErr] = $.str.optional.nullable.pipe(isValidLocation).get(params.location);
	if (locationErr) return rej('invalid location param');
	if (location !== undefined) updates['profile.location'] = location;

	// Get 'birthday' parameter
	const [birthday, birthdayErr] = $.str.optional.nullable.pipe(isValidBirthday).get(params.birthday);
	if (birthdayErr) return rej('invalid birthday param');
	if (birthday !== undefined) updates['profile.birthday'] = birthday;

	// Get 'avatarId' parameter
	const [avatarId, avatarIdErr] = $.type(ID).optional.nullable.get(params.avatarId);
	if (avatarIdErr) return rej('invalid avatarId param');
	if (avatarId !== undefined) updates.avatarId = avatarId;

	// Get 'bannerId' parameter
	const [bannerId, bannerIdErr] = $.type(ID).optional.nullable.get(params.bannerId);
	if (bannerIdErr) return rej('invalid bannerId param');
	if (bannerId !== undefined) updates.bannerId = bannerId;

	// Get 'wallpaperId' parameter
	const [wallpaperId, wallpaperIdErr] = $.type(ID).optional.nullable.get(params.wallpaperId);
	if (wallpaperIdErr) return rej('invalid wallpaperId param');
	if (wallpaperId !== undefined) updates.wallpaperId = wallpaperId;

	// Get 'isLocked' parameter
	const [isLocked, isLockedErr] = $.bool.optional.get(params.isLocked);
	if (isLockedErr) return rej('invalid isLocked param');
	if (isLocked != null) updates.isLocked = isLocked;

	// Get 'isBot' parameter
	const [isBot, isBotErr] = $.bool.optional.get(params.isBot);
	if (isBotErr) return rej('invalid isBot param');
	if (isBot != null) updates.isBot = isBot;

	// Get 'isCat' parameter
	const [isCat, isCatErr] = $.bool.optional.get(params.isCat);
	if (isCatErr) return rej('invalid isCat param');
	if (isCat != null) updates.isCat = isCat;

	// Get 'autoWatch' parameter
	const [autoWatch, autoWatchErr] = $.bool.optional.get(params.autoWatch);
	if (autoWatchErr) return rej('invalid autoWatch param');
	if (autoWatch != null) updates['settings.autoWatch'] = autoWatch;

	if (avatarId) {
		const avatar = await DriveFile.findOne({
			_id: avatarId
		});

		if (avatar == null) return rej('avatar not found');

		updates.avatarUrl = avatar.metadata.thumbnailUrl || avatar.metadata.url || `${config.drive_url}/${avatar._id}`;

		if (avatar.metadata.properties.avgColor) {
			updates.avatarColor = avatar.metadata.properties.avgColor;
		}
	}

	if (bannerId) {
		const banner = await DriveFile.findOne({
			_id: bannerId
		});

		if (banner == null) return rej('banner not found');

		updates.bannerUrl = banner.metadata.url || `${config.drive_url}/${banner._id}`;

		if (banner.metadata.properties.avgColor) {
			updates.bannerColor = banner.metadata.properties.avgColor;
		}
	}

	if (wallpaperId !== undefined) {
		if (wallpaperId === null) {
			updates.wallpaperUrl = null;
			updates.wallpaperColor = null;
		} else {
			const wallpaper = await DriveFile.findOne({
				_id: wallpaperId
			});

			if (wallpaper == null) return rej('wallpaper not found');

			updates.wallpaperUrl = wallpaper.metadata.url || `${config.drive_url}/${wallpaper._id}`;

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
	publishUserStream(user._id, 'meUpdated', iObj);

	// 鍵垢を解除したとき、溜まっていたフォローリクエストがあるならすべて承認
	if (user.isLocked && isLocked === false) {
		acceptAllFollowRequests(user);
	}

	// フォロワーにUpdateを配信
	publishToFollowers(user._id);
});
