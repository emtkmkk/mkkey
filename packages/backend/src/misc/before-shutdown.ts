/**
 * @packageDocumentation
 *
 * 終了シグナル（SIGINT/SIGTERM）の購読と、シャットダウン前のリスナー実行を行う。
 *
 * @remarks
 * - **役割**: SIGINT/SIGTERM を捕捉し、登録された shutdown リスナーを順に実行。タイムアウト後に強制終了。
 * - 参考: https://gist.github.com/nfantone/1eaa803772025df69d07f4dbf5df7e58
 *
 * @internal
 */
// https://gist.github.com/nfantone/1eaa803772025df69d07f4dbf5df7e58

"use strict";

/** シャットダウン時に受け取るシグナルまたはイベント名 */
const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"];

/** 強制終了まで待つ時間（ミリ秒） */
const SHUTDOWN_TIMEOUT = 15000;

/** シャットダウン前に実行するリスナーのキュー */
const shutdownListeners: ((signalOrEvent: string) => void)[] = [];

/**
 * 指定したシグナルを一度だけ購読し、発火時に fn を実行する。
 * @param signals - 購読するシグナル一覧
 * @param fn - シャットダウン時に実行する関数
 * @internal
 */
const processOnce = (
	signals: string[],
	fn: (signalOrEvent: string) => void,
) => {
	for (const sig of signals) {
		process.once(sig, fn);
	}
};

/**
 * 指定ミリ秒経過後にプロセスを強制終了する処理を返す。
 * @param timeout - 強制終了まで待つ時間（ミリ秒）
 * @internal
 */
const forceExitAfter = (timeout: number) => () => {
	setTimeout(() => {
		console.warn(
			`Could not close resources gracefully after ${timeout}ms: forcing shutdown`,
		);
		return process.exit(1);
	}, timeout).unref();
};

/**
 * メインのシャットダウンハンドラ。登録済みの非同期リスナーを順に実行し、終了コード 0 で終了する。
 * リスナーで Promise が reject しても警告ログのみで、他のコールバックは実行する。
 * @param signalOrEvent - プロセスが受け取った終了シグナルまたはイベント名
 * @internal
 */
async function shutdownHandler(signalOrEvent: string) {
	if (process.env.NODE_ENV === "test") return process.exit(0);

	console.warn(`Shutting down: received [${signalOrEvent}] signal`);

	for (const listener of shutdownListeners) {
		try {
			await listener(signalOrEvent);
		} catch (err) {
			if (err instanceof Error) {
				console.warn(
					`A shutdown handler failed before completing with: ${
						err.message || err
					}`,
				);
			}
		}
	}

	return process.exit(0);
}

/**
 * 終了前に実行するシャットダウンリスナーを登録する。登録順に実行される。
 * @param listener - 登録するリスナー
 * @returns 登録した listener をそのまま返す
 * @internal
 */
export function beforeShutdown(listener: () => void) {
	shutdownListeners.push(listener);
	return listener;
}

// SHUTDOWN_TIMEOUT 経過後にプロセスを強制終了するコールバックを登録（ハンドラのハング防止）
processOnce(SHUTDOWN_SIGNALS, forceExitAfter(SHUTDOWN_TIMEOUT));

// シグナル受信時に登録済みハンドラを実行するコールバックを登録
processOnce(SHUTDOWN_SIGNALS, shutdownHandler);
