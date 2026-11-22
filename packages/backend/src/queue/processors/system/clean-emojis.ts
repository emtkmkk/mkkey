/**
 * @packageDocumentation
 *
 * 長く更新されていないリモート絵文字のうち、画像がもう無いものを消す定期ジョブ。
 *
 * @remarks
 * - 対象は、最後の更新から {@link STALE_DAYS} 日以上たったリモート絵文字。
 * - 画像の URL を取りに行き、取れたら `updatedAt` を今にして残す。
 * - **消すのは、相手が 404 / 410（もう無い）と答えたときだけ。**
 *   CHANGED（2026-11-22）: 以前は失敗の理由を見ずに消していたため、相手サーバーのメンテや
 *   一時的な不通、タイムアウトでも絵文字がまとめて消えていた。
 *   それ以外の失敗は何もせず残し、次の実行で確かめ直す。
 * - 不通で自動停止中・不通と記録されているホストの絵文字は、確かめても失敗するだけなので飛ばす。
 * - 確かめ直しにならない絵文字（飛ばした・一時的な失敗）があっても同じ行を読み続けないよう、id の順に進める。
 *
 * @internal
 */
import type Bull from "bull";

import { queueLogger } from "../../logger.js";
import { Emojis, Instances } from "@/models/index.js";
import { IsNull, LessThan, MoreThan, Not } from "typeorm";
import { getResponse, StatusError } from "@/misc/fetch.js";
import config from "@/config/index.js";
import type { Emoji } from "@/models/entities/emoji.js";
import { getSuspendedHosts } from "@/services/instance-health/suspended-hosts.js";

const logger = queueLogger.createSubLogger("clean-emojis");

/** これより長く更新されていないリモート絵文字を確かめる（日） */
const STALE_DAYS = 365 / 4;

/** 1 回に読む件数 */
const BATCH_SIZE = 100;

/**
 * 取得の失敗が「画像がもう無い」ことを表すか
 *
 * @param err - getResponse が投げたエラー
 * @returns 404 / 410 なら true
 * @internal
 */
function isGoneError(err: unknown): boolean {
	return (
		err instanceof StatusError &&
		(err.statusCode === 404 || err.statusCode === 410)
	);
}

/**
 * 確かめても無駄なホスト（不通）の一覧を作る
 *
 * @remarks
 * - 不通で自動停止中のホスト（停止状態のメモリキャッシュから）
 * - 不通と記録されているホスト（`isNotResponding`）
 *
 * 手動停止・閉鎖（410）による停止は、画像が別の場所（CDN など）に残っていることがあるので確かめる。
 *
 * @returns ホスト（punycode）の集合
 * @internal
 */
async function getUnreachableHosts(): Promise<Set<string>> {
	const hosts = new Set<string>();
	for (const [host, state] of await getSuspendedHosts()) {
		if (state === "autoSuspendedForNotResponding") hosts.add(host);
	}
	const notResponding = await Instances.find({
		select: ["host"],
		where: { isNotResponding: true },
	});
	for (const row of notResponding) hosts.add(row.host);
	return hosts;
}

/**
 * 長く更新されていないリモート絵文字を確かめ、画像が無いものを消す
 *
 * @param job - ジョブ
 * @param done - 完了通知
 * @returns なし
 * @internal
 */
export async function cleanEmojis(
	job: Bull.Job<Record<string, unknown>>,
	done: any,
): Promise<void> {
	logger.info("Clean Emojis...");
	job.log("info - " + "Clean Emojis...");

	let deleteCount = 0;
	let foundCount = 0;
	let skipCount = 0;
	let errorCount = 0;

	const staleBefore = new Date(Date.now() - 1000 * 60 * 60 * 24 * STALE_DAYS);
	const unreachableHosts = await getUnreachableHosts();

	const total = await Emojis.countBy({
		host: Not(IsNull()),
		updatedAt: LessThan(staleBefore),
	});

	logger.info(`Clean Emojis Count: ${total}`);
	job.log(`info - Clean Emojis Count: ${total}`);

	const reportProgress = () => {
		const processed = deleteCount + foundCount + skipCount + errorCount;
		job.progress(total > 0 ? +((processed / total) * 100).toFixed(1) : 100);
	};

	let lastId: string | null = null;

	while (true) {
		const emojis = (await Emojis.find({
			where: {
				host: Not(IsNull()),
				updatedAt: LessThan(staleBefore),
				...(lastId != null ? { id: MoreThan(lastId) } : {}),
			},
			take: BATCH_SIZE,
			order: {
				id: 1,
			},
		})) as Emoji[];

		if (emojis.length === 0) {
			break;
		}
		lastId = emojis[emojis.length - 1].id;

		for (const x of emojis) {
			if (x.host != null && unreachableHosts.has(x.host)) {
				skipCount += 1;
				reportProgress();
				continue;
			}

			try {
				const res = await getResponse({
					url: x.publicUrl || x.originalUrl,
					method: "GET",
					headers: {
						"User-Agent": config.userAgent,
						Accept: "*/*",
					},
				});
				// 中身は使わないので読み捨てる。読まないと keepAlive の接続が空くまで塞がる
				await res.arrayBuffer().catch(() => undefined);
				await Emojis.update({ id: x.id }, { updatedAt: new Date() });
				foundCount += 1;
				logger.debug(`found Emoji ${x.name}@${x.host} (Total: ${foundCount})`);
			} catch (err) {
				if (isGoneError(err)) {
					await Emojis.delete(x.id);
					deleteCount += 1;
					logger.info(`gone Emoji ${x.name}@${x.host} (Total: ${deleteCount})`);
					job.log(`info - gone Emoji ${x.name}@${x.host} (Total: ${deleteCount})`);
				} else {
					// 一時的な失敗かもしれないので消さない。updatedAt も変えず、次の実行で確かめ直す
					errorCount += 1;
					logger.debug(`error Emoji ${x.name}@${x.host}: ${err}`);
				}
			}
			reportProgress();
		}
	}

	logger.succ("All emojis successfully cleaned.");
	job.log(
		`succ - All emojis successfully cleaned. (deleted: ${deleteCount}, found: ${foundCount}, skipped: ${skipCount}, error: ${errorCount})`,
	);
	job.progress(100);
	done();
}
