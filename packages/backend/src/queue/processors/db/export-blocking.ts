/**
 * @packageDocumentation
 *
 * ブロック一覧エクスポートジョブ。ユーザーのブロックリストを CSV でドライブに保存する。
 *
 * @remarks
 * - **役割**: エクスポートキューで実行し、ブロック一覧を CSV にしてドライブに追加する。
 *
 * @see {@link queue/processors/db/export-mute} ミュートエクスポート
 * @internal
 */
import type Bull from "bull";
import * as fs from "node:fs";

import { queueLogger } from "../../logger.js";
import { addFile } from "@/services/drive/add-file.js";
import { format as dateFormat } from "date-fns";
import { getFullApAccount } from "@/misc/convert-host.js";
import { createTemp } from "@/misc/create-temp.js";
import { Users, Blockings } from "@/models/index.js";
import { MoreThan } from "typeorm";
import type { DbUserJobData } from "@/queue/types.js";

const logger = queueLogger.createSubLogger("export-blocking");

export async function exportBlocking(
	job: Bull.Job<DbUserJobData>,
	done: any,
): Promise<void> {
	logger.info(`Exporting blocking of ${job.data.user.id} ...`);
	job.log("info - " + `Exporting blocking of ${job.data.user.id} ...`);

	const user = await Users.findOneBy({ id: job.data.user.id });
	if (user == null) {
		done();
		return;
	}

	// 一時ファイルを作成
	const [path, cleanup] = await createTemp();

	logger.info(`Temp file is ${path}`);
	job.log("info - " + `Temp file is ${path}`);

	const total = await Blockings.countBy({
		blockerId: user.id,
	});

	try {
		const stream = fs.createWriteStream(path, { flags: "a" });

		let exportedCount = 0;
		let cursor: any = null;

		while (true) {
			const blockings = await Blockings.find({
				where: {
					blockerId: user.id,
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			});

			if (blockings.length === 0) {
				job.progress(100);
				break;
			}

			cursor = blockings[blockings.length - 1].id;

			for (const block of blockings) {
				const u = await Users.findOneBy({ id: block.blockeeId });
				if (u == null) {
					exportedCount++;
					continue;
				}

				const content = getFullApAccount(u.username, u.host);
				await new Promise<void>((res, rej) => {
					stream.write(content + "\n", (err) => {
						if (err) {
							logger.error(err);
							job.log("error - " + err);
							rej(err);
						} else {
							res();
						}
					});
				});
				exportedCount++;
			}

			job.progress(+(exportedCount / total * 100).toFixed(1));
		}

		stream.end();
		logger.succ(`Exported to: ${path}`);
		job.log("succ - " + `Exported to: ${path}`);

		const fileName = `blocking-${dateFormat(
			new Date(),
			"yyyy-MM-dd-HH-mm-ss",
		)}.csv`;
		const driveFile = await addFile({
			user,
			path,
			name: fileName,
			force: true,
		});

		logger.succ(`Exported to: ${driveFile.id}`);
		job.log("succ - " + `Exported to: ${driveFile.id}`);
	} finally {
		cleanup();
	}

	done();
}
