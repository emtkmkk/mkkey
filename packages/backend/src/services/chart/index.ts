/**
 * @packageDocumentation
 *
 * チャートサービスの共有インスタンスを生成し、定期保存と終了時保存を登録する。
 *
 * @internal
 */
import { beforeShutdown } from "@/misc/before-shutdown.js";
import Logger from "../logger.js";

import FederationChart from "./charts/federation.js";
import NotesChart from "./charts/notes.js";
import UsersChart from "./charts/users.js";
import ActiveUsersChart from "./charts/active-users.js";
import InstanceChart from "./charts/instance.js";
import PerUserNotesChart from "./charts/per-user-notes.js";
import DriveChart from "./charts/drive.js";
import PerUserReactionsChart from "./charts/per-user-reactions.js";
import PerUserFollowingChart from "./charts/per-user-following.js";
import PerUserDriveChart from "./charts/per-user-drive.js";
import ApRequestChart from "./charts/ap-request.js";

export const federationChart = new FederationChart();
export const notesChart = new NotesChart();
export const usersChart = new UsersChart();
export const activeUsersChart = new ActiveUsersChart();
export const instanceChart = new InstanceChart();
export const perUserNotesChart = new PerUserNotesChart();
export const driveChart = new DriveChart();
export const perUserReactionsChart = new PerUserReactionsChart();
//export const hashtagChart = new HashtagChart();
export const perUserFollowingChart = new PerUserFollowingChart();
export const perUserDriveChart = new PerUserDriveChart();
export const apRequestChart = new ApRequestChart();

const logger = new Logger("chart");

const charts = [
	federationChart,
	notesChart,
	usersChart,
	activeUsersChart,
	instanceChart,
	perUserNotesChart,
	driveChart,
	perUserReactionsChart,
	//hashtagChart,
	perUserFollowingChart,
	perUserDriveChart,
	apRequestChart,
];

// 20分おきにメモリ情報をDBに書き込み
setInterval(() => {
	for (const chart of charts) {
		void chart.save().catch((error: unknown) => {
			// 失敗分は Chart 側の buffer に戻され、次の定期保存で再試行される。
			logger.error(error instanceof Error ? error : String(error));
		});
	}
}, 1000 * 60 * 20);

beforeShutdown(() => Promise.all(charts.map((chart) => chart.save())));
