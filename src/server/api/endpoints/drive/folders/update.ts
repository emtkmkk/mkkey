import $ from 'cafy'; import ID from '../../../../../misc/cafy-id';
import DriveFolder, { isValidFolderName, pack } from '../../../../../models/drive-folder';
import { publishDriveStream } from '../../../../../stream';
import { ILocalUser } from '../../../../../models/user';

export const meta = {
	desc: {
		'ja-JP': '指定したドライブのフォルダの情報を更新します。',
		'en-US': 'Update specified folder of drive.'
	},

	requireCredential: true,

	kind: 'drive-write'
};

export default (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'folderId' parameter
	const [folderId, folderIdErr] = $.type(ID).get(params.folderId);
	if (folderIdErr) return rej('invalid folderId param');

	// Fetch folder
	const folder = await DriveFolder
		.findOne({
			_id: folderId,
			userId: user._id
		});

	if (folder === null) {
		return rej('folder-not-found');
	}

	// Get 'name' parameter
	const [name, nameErr] = $.str.optional.pipe(isValidFolderName).get(params.name);
	if (nameErr) return rej('invalid name param');
	if (name) folder.name = name;

	// Get 'parentId' parameter
	const [parentId, parentIdErr] = $.type(ID).optional.nullable.get(params.parentId);
	if (parentIdErr) return rej('invalid parentId param');
	if (parentId !== undefined) {
		if (parentId === null) {
			folder.parentId = null;
		} else {
			// Get parent folder
			const parent = await DriveFolder
				.findOne({
					_id: parentId,
					userId: user._id
				});

			if (parent === null) {
				return rej('parent-folder-not-found');
			}

			// Check if the circular reference will occur
			async function checkCircle(folderId: any): Promise<boolean> {
				// Fetch folder
				const folder2 = await DriveFolder.findOne({
					_id: folderId
				}, {
					_id: true,
					parentId: true
				});

				if (folder2._id.equals(folder._id)) {
					return true;
				} else if (folder2.parentId) {
					return await checkCircle(folder2.parentId);
				} else {
					return false;
				}
			}

			if (parent.parentId !== null) {
				if (await checkCircle(parent.parentId)) {
					return rej('detected-circular-definition');
				}
			}

			folder.parentId = parent._id;
		}
	}

	// Update
	DriveFolder.update(folder._id, {
		$set: {
			name: folder.name,
			parentId: folder.parentId
		}
	});

	// Serialize
	const folderObj = await pack(folder);

	// Response
	res(folderObj);

	// Publish folder_updated event
	publishDriveStream(user._id, 'folder_updated', folderObj);
});
