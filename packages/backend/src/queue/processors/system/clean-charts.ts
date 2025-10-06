import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import {
        activeUsersChart,
        driveChart,
        federationChart,
        instanceChart,
        notesChart,
        perUserDriveChart,
        perUserFollowingChart,
        perUserNotesChart,
        perUserReactionsChart,
        usersChart,
        apRequestChart,
} from "@/services/chart/index.js";
import { db } from "@/db/postgre.js";
import { Users } from "@/models/index.js";
import { entity as PerUserNotesEntity } from "@/services/chart/charts/entities/per-user-notes.js";
import { entity as PerUserReactionsEntity } from "@/services/chart/charts/entities/per-user-reactions.js";
import { entity as PerUserFollowingEntity } from "@/services/chart/charts/entities/per-user-following.js";
import { entity as PerUserDriveEntity } from "@/services/chart/charts/entities/per-user-drive.js";

const logger = queueLogger.createSubLogger("clean-charts");

export async function cleanCharts(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
        logger.info("Clean charts...");
        job.log("info - " + "Clean charts...");

        await Promise.all([
                federationChart.clean(),
		notesChart.clean(),
		usersChart.clean(),
		activeUsersChart.clean(),
		instanceChart.clean(),
		perUserNotesChart.clean(),
		driveChart.clean(),
		perUserReactionsChart.clean(),
		perUserFollowingChart.clean(),
                perUserDriveChart.clean(),
                apRequestChart.clean(),
        ]);

        logger.info("リモートユーザーのチャートを整理します...");
        job.log("info - " + "リモートユーザーのチャートを整理します...");

        const threshold = Math.floor((Date.now() - 1000 * 60 * 60 * 24 * 365) / 1000);
        const remoteUsersQuery = Users.createQueryBuilder("user")
                .select("user.id")
                .where("user.host IS NOT NULL");
        const remoteUsersSql = remoteUsersQuery.getQuery();
        const remoteUsersParams = remoteUsersQuery.getParameters();

        const perUserEntities = [
                PerUserNotesEntity,
                PerUserReactionsEntity,
                PerUserFollowingEntity,
                PerUserDriveEntity,
        ];

        for (const entity of perUserEntities) {
                await Promise.all([
                        db.getRepository(entity.hour)
                                .createQueryBuilder()
                                .delete()
                                .where("date < :threshold", { threshold })
                                .andWhere(`"group" IN (${remoteUsersSql})`)
                                .setParameters(remoteUsersParams)
                                .execute(),
                        db.getRepository(entity.day)
                                .createQueryBuilder()
                                .delete()
                                .where("date < :threshold", { threshold })
                                .andWhere(`"group" IN (${remoteUsersSql})`)
                                .setParameters(remoteUsersParams)
                                .execute(),
                ]);
        }

        logger.succ("リモートユーザーのチャートの整理が完了しました。");
        job.log("succ - " + "リモートユーザーのチャートの整理が完了しました。");

        logger.succ("All charts successfully cleaned.");
        job.log("succ - " + "All charts successfully cleaned.");
        job.progress(100);
        done();
}
