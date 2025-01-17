import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import { NoteReactions, Notes } from "@/models/index.js";
import { Brackets, IsNull, LessThan, Not } from "typeorm";
import { getResponse } from "@/misc/fetch.js";
import config from "@/config/index.js";
import { genId } from "@/misc/gen-id.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";

const logger = queueLogger.createSubLogger("clean-reactions");

export async function cleanReactions(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Clean Reactions...");
	job.log("info - " + "Clean Reactions...");


	{
		let deleteCount = 0;
		let failedCount = 0;

		const maxDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180)
		let cursor: NoteReaction["id"] | null = null;
		const total = (await NoteReactions.createQueryBuilder("reaction")
		.innerJoin("reaction.note", "note")
		.innerJoin("reaction.user", "user")
		.where("reaction.id < :maxId", { maxId: genId(maxDate) })
		.andWhere(cursor ? "reaction.id > :cursor" : "1=1", { cursor })
		.andWhere("note.userHost IS NOT NULL")
		.andWhere("user.host IS NOT NULL")
		.getCount())

		logger.info(`Clean Reactions Count: ${total}`);
		job.log(`info - Clean Reactions Count: ${total}`);

		while (true) {
			const reactions = (await NoteReactions.createQueryBuilder("reaction")
				.innerJoin("reaction.note", "note")
				.innerJoin("reaction.user", "user")
				.where("reaction.id < :maxId", { maxId: genId(maxDate) })
				.andWhere(cursor ? "reaction.id > :cursor" : "1=1", { cursor })
				.andWhere("note.userHost IS NOT NULL")
				.andWhere("user.host IS NOT NULL")
				.orderBy("reaction.id", "ASC")
				.take(300)
				.getMany()) as NoteReaction[];

			if (reactions.length === 0) {
				break;
			}

			cursor = reactions[reactions.length - 1].id;

			try {
				await NoteReactions.delete(reactions.map((note) => note.id));
				deleteCount += reactions.length;
				logger.info(
					`Reactions Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log(`info - Reactions Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
			} catch {
				failedCount += reactions.length;
				logger.info(
					`Reactions Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log(`info - Reactions Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
			}
			job.progress(+((deleteCount + failedCount) / total * 100).toFixed(2));
		}

		if (deleteCount + failedCount)
			logger.succ(
				`Reactions Cleaned. (${deleteCount}${failedCount ? ` / ${failedCount}` : ""
				})`,
			);
		job.log(`succ - Reactions Cleaned. (${deleteCount}${failedCount ? ` / ${failedCount}` : ""
			})`,
		);
	}

	job.progress(100);
	done();
}
