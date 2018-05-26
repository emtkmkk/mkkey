import * as mongo from 'mongodb';
import * as deepcopy from 'deepcopy';
import db from '../db/mongodb';
import DriveFile from './drive-file';

const DriveFolder = db.get<IDriveFolder>('driveFolders');
export default DriveFolder;

export type IDriveFolder = {
	_id: mongo.ObjectID;
	createdAt: Date;
	name: string;
	userId: mongo.ObjectID;
	parentId: mongo.ObjectID;
};

export function isValidFolderName(name: string): boolean {
	return (
		(name.trim().length > 0) &&
		(name.length <= 200)
	);
}

/**
 * DriveFolderを物理削除します
 */
export async function deleteDriveFolder(driveFolder: string | mongo.ObjectID | IDriveFolder) {
	let d: IDriveFolder;

	// Populate
	if (mongo.ObjectID.prototype.isPrototypeOf(driveFolder)) {
		d = await DriveFolder.findOne({
			_id: driveFolder
		});
	} else if (typeof driveFolder === 'string') {
		d = await DriveFolder.findOne({
			_id: new mongo.ObjectID(driveFolder)
		});
	} else {
		d = driveFolder as IDriveFolder;
	}

	if (d == null) return;

	// このDriveFolderに格納されているDriveFileがあればすべてルートに移動
	await DriveFile.update({
		'metadata.folderId': d._id
	}, {
		$set: {
			'metadata.folderId': null
		}
	});

	// このDriveFolderに格納されているDriveFolderがあればすべてルートに移動
	await DriveFolder.update({
		parentId: d._id
	}, {
		$set: {
			parentId: null
		}
	});

	// このDriveFolderを削除
	await DriveFolder.remove({
		_id: d._id
	});
}

/**
 * Pack a drive folder for API response
 */
export const pack = (
	folder: any,
	options?: {
		detail: boolean
	}
) => new Promise<any>(async (resolve, reject) => {
	const opts = Object.assign({
		detail: false
	}, options);

	let _folder: any;

	// Populate the folder if 'folder' is ID
	if (mongo.ObjectID.prototype.isPrototypeOf(folder)) {
		_folder = await DriveFolder.findOne({ _id: folder });
	} else if (typeof folder === 'string') {
		_folder = await DriveFolder.findOne({ _id: new mongo.ObjectID(folder) });
	} else {
		_folder = deepcopy(folder);
	}

	// Rename _id to id
	_folder.id = _folder._id;
	delete _folder._id;

	if (opts.detail) {
		const childFoldersCount = await DriveFolder.count({
			parentId: _folder.id
		});

		const childFilesCount = await DriveFile.count({
			'metadata.folderId': _folder.id
		});

		_folder.foldersCount = childFoldersCount;
		_folder.filesCount = childFilesCount;
	}

	if (opts.detail && _folder.parentId) {
		// Populate parent folder
		_folder.parent = await pack(_folder.parentId, {
			detail: true
		});
	}

	resolve(_folder);
});
