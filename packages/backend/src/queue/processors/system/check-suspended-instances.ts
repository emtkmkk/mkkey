import type Bull from "bull";
import { Instances } from "@/models/index.js";
import { fetchInstanceMetadata } from "@/services/fetch-instance-metadata.js";
import pLimit from "p-limit";
import { LessThan, Not } from "typeorm";
import { queueLogger } from "../../logger.js";

const logger = queueLogger.createSubLogger("check-suspended-instances");

export async function checkSuspendedInstances(
        job: Bull.Job<Record<string, unknown>>,
        done: any,
): Promise<void> {
        logger.info("Checking suspended instances...");
        job.log("info - Checking suspended instances...");

        const twoWeeksAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
        const limit = pLimit(5);

        const notSuspended = await Instances.find({
                where: {
                        isSuspended: false,
                        isNotResponding: true,
                        infoUpdatedAt: LessThan(twoWeeksAgo),
                        latestRequestReceivedAt: LessThan(twoWeeksAgo),
                        lastCommunicatedAt: LessThan(twoWeeksAgo),
                        latestStatus: Not(410),
                },
        });

        await Promise.allSettled(
                notSuspended.map((inst) =>
                        limit(async () => {
                                try {
                                        const ok = await fetchInstanceMetadata(inst, true);

                                        const update: Record<string, any> = {
                                                latestRequestSentAt: new Date(),
                                        };
                                        if (ok) {
                                                update.isNotResponding = false;
                                                update.lastCommunicatedAt = new Date();
                                        } else {
                                                update.isSuspended = true;
                                        }

                                        await Instances.update(inst.id, update);

                                        if (ok) {
                                                logger.succ(`recovered ${inst.host}`);
                                                job.log(`succ - recovered ${inst.host}`);
                                        } else {
                                                logger.warn(`suspend ${inst.host}`);
                                                job.log(`warn - suspend ${inst.host}`);
                                        }
                                } catch (err) {
                                        await Instances.update(inst.id, {
                                                latestRequestSentAt: new Date(),
                                                isSuspended: true,
                                        });
                                        logger.warn(`check failed for ${inst.host}: ${err}`);
                                        job.log(`warn - check failed for ${inst.host}: ${err}`);
                                }
                        }),
                ),
        );

        const goneServers = await Instances.find({
                where: {
                        isSuspended: false,
                        latestStatus: 410,
                },
        });

        await Promise.allSettled(
                goneServers.map((inst) =>
                        limit(async () => {
                                await Instances.update(inst.id, {
                                        latestRequestSentAt: new Date(),
                                        isSuspended: true,
                                });
                                logger.warn(`suspend ${inst.host} by 410`);
                                job.log(`warn - suspend ${inst.host} by 410`);
                        }),
                ),
        );

        const targets = await Instances.find({
                where: {
                        isSuspended: true,
                        latestRequestSentAt: LessThan(twoWeeksAgo),
                },
        });

        await Promise.allSettled(
                targets.map((inst) =>
                        limit(async () => {
                                if (
                                        inst.latestStatus === 410 ||
                                        (inst.latestStatus == null && inst.isNotResponding)
                                ) {
                                        return;
                                }

                                try {
                                        const ok = await fetchInstanceMetadata(inst, true);

                                        const update: Record<string, any> = {
                                                latestRequestSentAt: new Date(),
                                        };

                                        if (ok) {
                                                update.isSuspended = false;
                                                update.isNotResponding = false;
                                                update.lastCommunicatedAt = new Date();
                                                logger.succ(`unsuspended ${inst.host}`);
                                                job.log(`succ - unsuspended ${inst.host}`);
                                        }

                                        await Instances.update(inst.id, update);
                                } catch (err) {
                                        await Instances.update(inst.id, {
                                                latestRequestSentAt: new Date(),
                                        });
                                        logger.warn(`check failed for ${inst.host}: ${err}`);
                                        job.log(`warn - check failed for ${inst.host}: ${err}`);
                                }
                        }),
                ),
        );

        logger.succ("Check finished.");
        job.log("succ - Check finished.");
        job.progress(100);
        done();
}
