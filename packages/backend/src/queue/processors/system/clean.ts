import type Bull from "bull";
import { Brackets, IsNull, LessThan } from "typeorm";
import { Notes, UserIps } from "@/models/index.js";

import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("clean");

export async function clean(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Cleaning...");

	logger.info("UserIps Cleaning...");
	UserIps.delete({
		createdAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)),
	});

	logger.succ("UserIps Cleaned.");

	logger.info("Notes Cleaning...");

	{
		let deleteCount = 0;
		let failedCount = 0;
		// Delete notes
		let cursor: Note["id"] | null = null;

		while (true) {
			const notes = (await Notes.createQueryBuilder('note')
			.where("note.createdAt < :date", { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) })
			.andWhere("note.repliesCount = :repliesCount", { repliesCount: 0 })
			.andWhere("note.score = :score", { score: 0 })
			.andWhere("note.userHost IS NOT NULL")
			.andWhere(new Brackets(qb => {
					qb.where("note.visibility = :public", { public: 'public' })
						.orWhere("note.visibility = :home", { home: 'home' });
			}))
			.andWhere(cursor ? "note.id > :cursor" : "1=1", { cursor })
			.orderBy("note.id", "ASC")
			.take(100)
			.getMany()) as Note[];

			if (notes.length === 0) {
				break;
			}

			cursor = notes[notes.length - 1].id;

			try {
				await Notes.delete(notes.map((note) => note.id));
				deleteCount += notes.length;
			} catch {
				failedCount += notes.length;
			}
		}

		if (deleteCount + failedCount)
			logger.succ(
				`Notes Cleaned. (${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
	}

	done();
}
