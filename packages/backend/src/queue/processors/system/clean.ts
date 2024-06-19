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
	const result = await Notes.createQueryBuilder("note")
		.delete()
		.where("createdAt < :date", { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) })
		.andWhere("renoteCount = :renoteCount", { renoteCount: 0 })
		.andWhere("repliesCount = :repliesCount", { repliesCount: 0 })
		.andWhere("score = :score", { score: 0 })
		.andWhere("userHost IS NOT NULL")
    .andWhere(new Brackets(qb => {
        qb.where("visibility = :public", { public: 'public' })
          .orWhere("visibility = :home", { home: 'home' });
    }))
		.execute();
	
	console.log(`Notes Cleaned. (${result.affected})`);

	done();
}
