import * as promiseLimit from 'promise-limit';
import del from '../services/drive/delete-file';
import { DriveFiles } from '../models';
import { Not, IsNull } from 'typeorm';
import { DriveFile } from '../models/entities/drive-file';
import { ensure } from '../prelude/ensure';

const limit = promiseLimit(16);

DriveFiles.find({
	userHost: Not(IsNull())
}).then(async files => {
	console.log(`there is ${files.length} files`);

	await Promise.all(files.map(file => limit(() => job(file))));

	console.log('ALL DONE');
});

async function job(file: DriveFile): Promise<any> {
	file = await DriveFiles.findOne(file.id).then(ensure);

	await del(file, true);

	console.log('done', file.id);
}
