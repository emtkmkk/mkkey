/**
 * @packageDocumentation
 *
 * ActivityPub 配信ジョブ。inbox へ Activity を送信し、統計を更新する。
 *
 * @remarks
 * - **役割**: 配信キューで実行し、リモート inbox へ署名付き POST で Activity を送る。
 * - 送る前にサーキットブレーカー（{@link services/instance-health}）を確認する。不調なサーバ宛ては通信せずに
 *   `HostCircuitOpenError` を投げ、Bull の通常の再送に任せる（再送回数を 1 回使う）。この場合、配送の統計には数えない。
 * - 不通・閉鎖・応答の記録（長期の状態）も recordDeliverError / recordDeliverSuccess に任せる。ここでは停止状態を直接書かない。
 * - `instance` 行の最終送信日時などは、ホストごとに 1 分に 1 回だけ書く（{@link shouldWriteStats}）。
 * - 通信はジョブのタイムアウトより少し早く打ち切る（{@link getDeliverRequestTimeoutMs}）。
 *   そうしないと Bull のタイムアウトが先に来て、ここで失敗を受け取れず、ブレーカーで分類できない。
 *
 * @see {@link remote/activitypub/request} AP リクエスト
 * @see plans/instance-delivery-health-plan.md 配送先の健康状態の計画
 * @internal
 */
import { URL } from "node:url";
import request from "@/remote/activitypub/request.js";
import { registerOrFetchInstanceDoc } from "@/services/register-or-fetch-instance-doc.js";
import { deliverJobLogger } from "@/queue/logger.js";
import { Instances } from "@/models/index.js";
import {
	apRequestChart,
	federationChart,
	instanceChart,
} from "@/services/chart/index.js";
import { fetchInstanceMetadata } from "@/services/fetch-instance-metadata.js";
import { toPuny } from "@/misc/convert-host.js";
import { StatusError } from "@/misc/fetch.js";
import { shouldSkipInstance } from "@/misc/skipped-instances.js";
import {
	beforeDeliver,
	recordDeliverError,
	recordDeliverSuccess,
} from "@/services/instance-health/index.js";
import { shouldWriteStats } from "@/services/instance-health/state.js";
import { getDeliverRequestTimeoutMs } from "@/queue/job-timeouts.js";
import type { DeliverJobData } from "@/queue/types.js";
import type Bull from "bull";

const logger = deliverJobLogger;

let latest: string | null = null;

/**
 * 配送ジョブを 1 件処理する。
 *
 * @param job - 配送ジョブ
 * @returns 結果の説明（`Success` / `skip` / 4xx のステータス）
 * @throws HostCircuitOpenError 配送先が不調で、通信せずに返す場合（Bull が後で再送する）
 * @throws Error 5xx・接続の失敗など、再送すべき失敗の場合
 * @internal
 */
export default async (job: Bull.Job<DeliverJobData>) => {
	const { host } = new URL(job.data.to);
	const puny = toPuny(host);

	if (await shouldSkipInstance(puny)) return "skip";

	// 不調なサーバ宛ては、通信せずにここで例外を投げる
	beforeDeliver(puny, job.data.to);

	try {
		if (latest !== (latest = JSON.stringify(job.data.content, null, 2))) {
			logger.debug(`delivering ${latest}`);
			job.log("debug - " + `delivering ${latest}`);
		}

		await request(job.data.user, job.data.to, job.data.content, {
			totalTimeoutMs: getDeliverRequestTimeoutMs(),
		});
		await recordDeliverSuccess(puny, job.id).catch((e) =>
			logger.warn(`failed to record delivery success of ${puny}: ${e}`),
		);
		job.progress(50);

		// 統計を更新（チャートは毎回、instance 行はホストごとに間引く）
		registerOrFetchInstanceDoc(host).then((i) => {
			if (shouldWriteStats(puny, "sent")) {
				Instances.update(i.id, {
					latestRequestSentAt: new Date(),
					latestStatus: 200,
					lastCommunicatedAt: new Date(),
				});
			}

			fetchInstanceMetadata(i);

			instanceChart.requestSent(i.host, true);
			apRequestChart.deliverSucc();
			federationChart.deliverd(i.host, true);
		});

		job.progress(100);
		return "Success";
	} catch (res) {
		// サーキットブレーカーに失敗を伝える（サーバ全体の不調かどうかはここで分類する）
		await recordDeliverError(puny, job, res);

		// 統計を更新（チャートは毎回、instance 行はホストごとに間引く）
		registerOrFetchInstanceDoc(host).then((i) => {
			if (shouldWriteStats(puny, "sent")) {
				Instances.update(i.id, {
					latestRequestSentAt: new Date(),
					latestStatus: res instanceof StatusError ? res.statusCode : null,
				});
			}

			instanceChart.requestSent(i.host, false);
			apRequestChart.deliverFail();
			federationChart.deliverd(i.host, false);
		});

		if (res instanceof StatusError) {
			// 4xx
			if (!res.isRetryable) {
				// shared inbox の 410（サーバ自体の閉鎖）は、recordDeliverError で閉鎖停止にしている
				// HTTPステータスコード4xxはクライアントエラーであり、それはつまり
				// 何回再送しても成功することはないということなのでエラーにはしないでおく
				return `${res.statusCode} ${res.statusMessage}`;
			}

			// 5xx etc.
			throw new Error(`${res.statusCode} ${res.statusMessage}`);
		} else {
			// DNS error, socket error, timeout ...
			throw res;
		}
	}
};
