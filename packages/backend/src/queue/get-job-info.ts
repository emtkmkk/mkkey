/**
 * @packageDocumentation
 *
 * Bull ジョブの表示用情報文字列を生成する。
 *
 * @remarks
 * - **役割**: ログや管理画面用に、ジョブの id・試行回数・経過時間を人間向け文字列で返す。
 *
 * @see {@link queue/initialize} キュー初期化
 * @internal
 */
import type Bull from "bull";

/**
 * ジョブの id / 試行回数 / 経過時間を人間向け文字列で返す。
 * @param job - Bull ジョブ
 * @param increment - true のとき attemptsMade に 1 を足して表示（onActive/onCompleted では 0 始まりのため）
 * @internal
 */
export function getJobInfo(job: Bull.Job, increment = false) {
	const age = Date.now() - job.timestamp;

	const formated =
		age > 60000
			? `${Math.floor(age / 1000 / 60)}m`
			: age > 10000
			? `${Math.floor(age / 1000)}s`
			: `${age}ms`;

	const currentAttempts = job.attemptsMade + (increment ? 1 : 0);
	const maxAttempts = job.opts ? job.opts.attempts : 0;

	return `id=${job.id} attempts=${currentAttempts}/${maxAttempts} age=${formated}`;
}
