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
	job.log("info - " + "Cleaning...");

	logger.info("UserIps Cleaning...");
	job.log("info - " + "UserIps Cleaning...");
	UserIps.delete({
		createdAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)),
	});

	logger.succ("UserIps Cleaned.");
	job.log("succ - " + "UserIps Cleaned.");

	job.progress(10);

	logger.info("Notes Cleaning...");
	job.log("info - " + "Notes Cleaning...");

	{
		let deleteCount = 0;
		let failedCount = 0;
		// Delete notes
		let cursor: Note["id"] | null = null;

		const total = (await Notes.createQueryBuilder('note')
		.where("note.createdAt < :date", { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) })
		.andWhere("note.repliesCount = :repliesCount", { repliesCount: 0 })
		.andWhere("note.score = :score", { score: 0 })
		.andWhere("note.userHost IS NOT NULL")
		.andWhere(new Brackets(qb => {
				qb.where("note.visibility = :public", { public: 'public' })
					.orWhere("note.visibility = :home", { home: 'home' });
		}))
		.getCount())

		logger.info(`Clean Notes Count: ${total}`);
		job.log(`info - Clean Notes Count: ${total}`);

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
				logger.info(
					`Notes Cleaning... (Total: ${deleteCount}${
						failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log("info - " +
					`Notes Cleaning... (Total: ${deleteCount}${
						failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				deleteCount += notes.length;
			} catch {
				logger.info(
					`Notes Cleaning... (Total: ${deleteCount}${
						failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				job.log("info - " +
					`Notes Cleaning... (Total: ${deleteCount}${
						failedCount ? ` / ${failedCount}` : ""
					})`,
				);
				failedCount += notes.length;
			}
			job.progress(10 + ((deleteCount + failedCount) / total * 90));
		}

		if (deleteCount + failedCount)
			logger.succ(
				`Notes Cleaned. (${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
			job.log("succ - " + 
				`Notes Cleaned. (${deleteCount}${
					failedCount ? ` / ${failedCount}` : ""
				})`,
			);
	}

	done();
}
