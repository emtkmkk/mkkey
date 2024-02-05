import type Bull from "bull";
import { queueLogger } from "../../logger.js";
import deleteNote from "@/services/note/delete.js";
import {
	Followings,
	DriveFiles,
	Notes,
	UserProfiles,
	Users,
} from "@/models/index.js";
import type { DbUserDeleteJobData } from "@/queue/types.js";
import type { Note } from "@/models/entities/note.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { MoreThan } from "typeorm";
import { deleteFileSync } from "@/services/drive/delete-file.js";
import { sendEmail } from "@/services/send-email.js";
import deleteFollowing from "@/services/following/delete.js";
import { getUser } from "@/server/api/common/getters.js";

const logger = queueLogger.createSubLogger("delete-account");

export async function deleteAccount(
	job: Bull.Job<DbUserDeleteJobData>,
): Promise<string | void> {
	const user = await Users.findOneBy({ id: job.data.user.id });
	if (user == null) {
		return;
	}

	logger.info(
		`Deleting account of ${job.data.user.id} @${user.username}${
			user.host ? `@${user.host}` : ""
		} ...`,
	);

	try {
		let tryCount = 0;
		let deleteCount = 0;
		while (tryCount <= 100) {
			const relations = await Followings.find({
				where: {
					followerId: user.id,
				},
				take: 100,
			});

			if (relations.length === 0) {
				break;
			}

			relations.forEach(async (x) => {
				try {
					const followee = await getUser(x.followeeId);
					deleteCount += 1;
					if (followee) await deleteFollowing(user, followee);
				} catch {}
			});
			tryCount += 1;
		}
		logger.succ(`All of relations removed (${deleteCount})`);
	} catch {}

	{
		let deleteCount = 0;
		// Delete notes
		let cursor: Note["id"] | null = null;

		while (true) {
			const notes = (await Notes.find({
				where: {
					userId: user.id,
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			})) as Note[];

			if (notes.length === 0) {
				break;
			}

			cursor = notes[notes.length - 1].id;

			for (const note of notes) {
				deleteCount += 1;
				await deleteNote(user, note, false, false);
			}
		}

		logger.succ(`All of notes deleted (${deleteCount})`);
	}

	{
		let deleteCount = 0;
		// Delete files
		let cursor: DriveFile["id"] | null = null;

		while (true) {
			const files = (await DriveFiles.find({
				where: {
					userId: user.id,
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 10,
				order: {
					id: 1,
				},
			})) as DriveFile[];

			if (files.length === 0) {
				break;
			}

			cursor = files[files.length - 1].id;

			for (const file of files) {
				deleteCount += 1;
				await deleteFileSync(file);
			}
		}

		logger.succ(`All of files deleted (${deleteCount})`);
	}

	{
		// Send email notification
		const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
		if (profile.email && profile.emailVerified) {
			sendEmail(
				profile.email,
				"アカウントは消去されました。",
				"あなたのアカウントは消去されました。",
				"あなたのアカウントは消去されました。",
			);
		}
	}

	// soft指定されている場合は物理削除しない
	if (job.data.soft) {
		// nop
	} else {
		// await Users.delete(job.data.user.id);
	}

	return "Account deleted";
}
