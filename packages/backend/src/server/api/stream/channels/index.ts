/**
 * @packageDocumentation
 *
 * ストリーム用チャンネル一覧。main / homeTimeline / drive 等を export する。
 *
 * @remarks
 * - **役割**: 各チャンネル実装を集約し、stream/index が購読時に参照する。
 * - チャンネル名（chName）とクラスの対応はここで管理される。
 *
 * @see {@link stream/index} メイン接続
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import main from "./main.js";
import homeTimeline from "./home-timeline.js";
import localTimeline from "./local-timeline.js";
import hybridTimeline from "./hybrid-timeline.js";
import recommendedTimeline from "./recommended-timeline.js";
import globalTimeline from "./global-timeline.js";
import spotlightTimeline from "./spotlight-timeline.js";
import serverStats from "./server-stats.js";
import queueStats from "./queue-stats.js";
import healthStats from "./health-stats.js";
import userList from "./user-list.js";
import antenna from "./antenna.js";
import messaging from "./messaging.js";
import messagingIndex from "./messaging-index.js";
import drive from "./drive.js";
import hashtag from "./hashtag.js";
import channel from "./channel.js";
import admin from "./admin.js";

export default {
	main,
	homeTimeline,
	localTimeline,
	recommendedTimeline,
	hybridTimeline,
	globalTimeline,
	spotlightTimeline,
	serverStats,
	queueStats,
	healthStats,
	userList,
	antenna,
	messaging,
	messagingIndex,
	drive,
	hashtag,
	channel,
	admin,
};
