import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import { Emojis, Notes } from "@/models/index.js";
import { Brackets, IsNull, LessThan, Not } from "typeorm";
import { getResponse } from "@/misc/fetch.js";
import config from "@/config/index.js";

const logger = queueLogger.createSubLogger("clean-emojis");

export async function cleanEmojis(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Clean Emojis...");
	job.log("info - " + "Clean Emojis...");


	{
		let deleteCount = 0;
		let foundCount = 0;

		const total = await Emojis.countBy({
			host: Not(IsNull()),
			updatedAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * (365 / 4))),
		});

		logger.info(`Clean Emojis Count: ${total}`);
		job.log(`info - Clean Emojis Count: ${total}`);

		while (true) {
			const emojis = (await Emojis.find({
				where: {
					host: Not(IsNull()),
					updatedAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * (365 / 4))),
				},
				take: 100,
				order: {
					id: 1,
				},
			})) as Emojis[];

			if (emojis.length === 0) {
				break;
			}

			for ( const x of emojis ) {
				try {
					await getResponse({
						url: x.publicUrl || x.originalUrl,
						method: "GET",
						headers: {
							"User-Agent": config.userAgent,
							Accept: "*/*",
						},
					})
					await Emojis.update(
						{
							id: x.id
						},
						{
							updatedAt: new Date(),
						},
					);
					foundCount += 1;
					logger.info(
						`found Emoji ${x.name}@${x.host} (Total: ${foundCount})`);
					job.log(`info - found Emoji ${x.name}@${x.host} (Total: ${foundCount})`);
					job.progress(+((deleteCount + foundCount) / total * 100).toFixed(1));
				} catch {
					await Emojis.delete(x.id)
					deleteCount += 1;
					logger.info(
						`error Emoji ${x.name}@${x.host} (Total: ${deleteCount})`);
					job.log(`info - error Emoji ${x.name}@${x.host} (Total: ${deleteCount})`);
					job.progress(+((deleteCount + foundCount) / total * 100).toFixed(1));
				}
			}

		}

		logger.succ("All emojis successfully cleaned.");
		job.log(`succ - All emojis successfully cleaned. (${deleteCount}${foundCount ? ` / ${foundCount}` : ""
			})`);
		job.progress(100);
		done();
	}
}
