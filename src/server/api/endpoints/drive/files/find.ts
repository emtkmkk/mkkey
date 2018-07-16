import $ from 'cafy'; import ID from '../../../../../misc/cafy-id';
import DriveFile, { pack } from '../../../../../models/drive-file';
import { ILocalUser } from '../../../../../models/user';

export const meta = {
	requireCredential: true,

	kind: 'drive-read'
};

export default (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'name' parameter
	const [name, nameErr] = $.str.get(params.name);
	if (nameErr) return rej('invalid name param');

	// Get 'folderId' parameter
	const [folderId = null, folderIdErr] = $.type(ID).optional.nullable.get(params.folderId);
	if (folderIdErr) return rej('invalid folderId param');

	// Issue query
	const files = await DriveFile
		.find({
			filename: name,
			'metadata.userId': user._id,
			'metadata.folderId': folderId
		});

	// Serialize
	res(await Promise.all(files.map(async file =>
		await pack(file))));
});
