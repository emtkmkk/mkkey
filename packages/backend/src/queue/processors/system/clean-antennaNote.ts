import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import { AntennaNotes, Notes } from "@/models/index.js";
import { Brackets, IsNull, LessThan, Not } from "typeorm";
import { getResponse } from "@/misc/fetch.js";
import config from "@/config/index.js";
import { genId } from "@/misc/gen-id.js";
import { NoteReaction } from "@/models/entities/note-reaction.js";
import type { AntennaNote } from "@/models/entities/antenna-note.js";

const logger = queueLogger.createSubLogger("clean-antennanotes");

export async function cleanAntennaNotes(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Clean AntennaNotes...");
	job.log("info - " + "Clean AntennaNotes...");


	{
		let deleteCount = 0;
		let failedCount = 0;

		const maxDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)
		let cursor: AntennaNote["id"] | null = null;
		const total = (await AntennaNotes.createQueryBuilder("antenna")
		.where("antenna.id < :maxId", { maxId: genId(maxDate) })
		.andWhere(cursor ? "antenna.id > :cursor" : "1=1", { cursor })
		.getCount())

		logger.info(`Clean AntennaNotes Count: ${total}`);
		job.log(`info - Clean AntennaNotes Count: ${total}`);

		while (true) {
			const notes = (await AntennaNotes.createQueryBuilder('note')
				.where("antenna.id < :maxId", { maxId: genId(maxDate) })
				.andWhere(cursor ? "antenna.id > :cursor" : "1=1", { cursor })
				.orderBy("antenna.id", "ASC")
				.take(300)
				.getMany()) as AntennaNote[];

			if (notes.length === 0) {
				break;
			}

			cursor = notes[notes.length - 1].id;

			try {
				await AntennaNotes.delete(notes.map((note) => note.id));
				deleteCount += notes.length;
				logger.info(
					`AntennaNotes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log(`info - AntennaNotes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
			} catch {
				failedCount += notes.length;
				logger.info(
					`AntennaNotes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log(`info - AntennaNotes Cleaning... (Total: ${deleteCount}${failedCount ? ` / ${failedCount}` : ""
					})`,
				);
			}
			job.progress(+((deleteCount + failedCount) / total * 100).toFixed(2));

		}

		logger.succ("All AntennaNotes successfully cleaned.");
		job.log(`succ - All AntennaNotes successfully cleaned. (${deleteCount}${failedCount ? ` / ${failedCount}` : ""
			})`);
		job.progress(100);
		done();
	}
}
