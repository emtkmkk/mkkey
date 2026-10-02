/**
 * @packageDocumentation
 *
 * 自前 PDS の firehose（`com.atproto.sync.subscribeRepos`）を WebSocket で流す。
 *
 * @remarks
 * - Relay がここにつなぎっぱなしにして、コミットやアカウントの出来事を受け取る。
 * - 出来事は `atproto_repo_seq` を 1 秒ごとに読んで送る。書き込みはどのワーカーでも起きるので、
 *   ワーカーの中のメモリやイベントではなく、データベースを見る形にしている。
 *   つなぐのは Relay の数（1〜2 か所）だけなので、読み込みの回数は問題にならない。
 *   IDEA: 遅れを縮めたくなったら、Redis の Pub/Sub で「新しい出来事がある」とだけ知らせて、すぐ読みに行く。
 * - つなぐときの `cursor` は「最後に受け取った番号」。それより後の出来事から送る。
 *   - 無いとき: 今から後の出来事だけを送る
 *   - 今の最新より大きいとき: `FutureCursor` のエラーを送って閉じる
 *   - 古すぎて残っていないとき: `OutdatedCursor` のお知らせを送り、残っている一番古いものから送る
 * - ストリーミングの WebSocket サーバー（{@link ../api/streaming.ts}）が、パスを見てここに回す。
 *
 * @see {@link ../../remote/atproto/sequencer.ts} 出来事の保存と組み立て
 * @see {@link https://atproto.com/specs/event-stream | Event Stream の仕様}
 * @internal
 */

import type { ParsedUrlQuery } from "node:querystring";
import type * as websocket from "websocket";
import { MoreThan } from "typeorm";
import { AtprotoRepoSeqs } from "@/models/index.js";
import { getAtprotoConfig } from "@/remote/atproto/config.js";
import {
	encodeErrorFrame,
	encodeEventFrame,
	encodeInfoFrame,
} from "@/remote/atproto/sequencer.js";
import { remoteLogger } from "@/remote/logger.js";

/** このモジュールのログ */
const logger = remoteLogger.createSubLogger("atproto-firehose", "cyan");

// #region 定数

/** firehose のパス */
const SUBSCRIBE_REPOS_PATH = "/xrpc/com.atproto.sync.subscribeRepos";

/** 新しい出来事を見に行く間隔（ミリ秒） */
const POLL_INTERVAL_MS = 1000;

/** 1 回に読む出来事の数。これだけ読めたら、まだ続きがあるとみなして待たずに読む */
const BATCH_SIZE = 500;

/** 送り待ちがこれを超えたら、読み込みを少し待つ（相手が受け取り切れていないため） */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

// #endregion

// #region 公開メソッド

/**
 * firehose への接続なら引き受ける。
 *
 * @remarks
 * - パスが `subscribeRepos` でなければ何もせず false を返す（ふつうのストリーミングとして扱ってもらう）。
 * - パスは合っているが、ブリッジが無効・ホスト名が違うときは 404 で断り、true を返す。
 *
 * @param request - WebSocket の接続要求
 * @returns 引き受けた（または断った）なら true
 * @internal
 */
export function tryHandleSubscribeRepos(request: websocket.request): boolean {
	if (request.resourceURL.pathname !== SUBSCRIBE_REPOS_PATH) return false;

	const { enabled, pdsHostname } = getAtprotoConfig();
	// Host ヘッダーにはポート番号が付いていることがあるので外して比べる
	const host = (request.host ?? "").split(":")[0].toLowerCase();
	if (!enabled || host !== pdsHostname) {
		request.reject(404);
		return true;
	}

	// cursor は数字だけを受け付ける（それ以外は「無い」とみなさず、エラーにする）
	const cursorRaw = (request.resourceURL.query as ParsedUrlQuery | null)?.cursor;
	const cursorStr = Array.isArray(cursorRaw) ? cursorRaw[0] : cursorRaw;
	if (cursorStr != null && !/^\d+$/.test(cursorStr)) {
		request.reject(400, "invalid cursor");
		return true;
	}

	const connection = request.accept(undefined, request.origin);
	logger.info(`connected: ${request.remoteAddress} cursor=${cursorStr ?? "-"}`);
	void streamEvents(connection, cursorStr != null ? Number(cursorStr) : null);
	return true;
}

// #endregion

// #region 送信

/**
 * つながっている間、出来事を読んで送り続ける。
 *
 * @param connection - WebSocket の接続
 * @param cursor - 最後に受け取った番号。無ければ null
 * @internal
 */
async function streamEvents(
	connection: websocket.connection,
	cursor: number | null,
): Promise<void> {
	let closed = false;
	connection.on("close", () => {
		closed = true;
		logger.info(`disconnected: ${connection.remoteAddress}`);
	});

	// #region 送り始める位置を決める
	let last: number;
	try {
		const start = await resolveStart(cursor);
		if (start.error) {
			connection.sendBytes(encodeErrorFrame(start.error, start.message));
			connection.close();
			return;
		}
		if (start.outdated) {
			connection.sendBytes(
				encodeInfoFrame("OutdatedCursor", "Requested cursor exceeded limit. Possibly missing events"),
			);
		}
		last = start.last;
	} catch (err) {
		logger.error(`failed to start: ${err}`);
		connection.close();
		return;
	}
	// #endregion

	// 閉じられるまで、新しい出来事を読んで送る
	while (!closed) {
		try {
			// 相手が受け取り切れていなければ、読まずに待つ
			if (connection.bytesWaitingToFlush > MAX_BUFFERED_BYTES) {
				await sleep(POLL_INTERVAL_MS);
				continue;
			}

			const rows = await AtprotoRepoSeqs.find({
				where: { seq: MoreThan(String(last)) },
				order: { seq: "ASC" },
				take: BATCH_SIZE,
			});
			for (const row of rows) {
				if (closed) break;
				connection.sendBytes(encodeEventFrame(row));
				last = Number(row.seq);
			}

			// 読めた数が上限に届かなければ、今は出し切ったので少し待つ
			if (rows.length < BATCH_SIZE) await sleep(POLL_INTERVAL_MS);
		} catch (err) {
			// データベースの一時的な失敗などは、待ってからやり直す（接続は切らない）
			logger.warn(`failed to read events: ${err}`);
			await sleep(POLL_INTERVAL_MS * 5);
		}
	}
}

/**
 * 送り始める位置を決める。
 *
 * @param cursor - 最後に受け取った番号。無ければ null
 * @returns 送り始める直前の番号と、古すぎたか。続けられないときはエラー
 * @internal
 */
async function resolveStart(cursor: number | null): Promise<{
	last: number;
	outdated?: boolean;
	error?: string;
	message?: string;
}> {
	const latest = await AtprotoRepoSeqs.find({ order: { seq: "DESC" }, take: 1 });
	const latestSeq = latest.length > 0 ? Number(latest[0].seq) : 0;

	// cursor が無ければ、今から後だけ
	if (cursor == null) return { last: latestSeq };

	// まだ無い番号を求められた
	if (cursor > latestSeq) {
		return {
			last: latestSeq,
			error: "FutureCursor",
			message: "Cursor in the future.",
		};
	}

	// 求められた番号の次が、もう残っていない
	const oldest = await AtprotoRepoSeqs.find({ order: { seq: "ASC" }, take: 1 });
	const oldestSeq = oldest.length > 0 ? Number(oldest[0].seq) : null;
	if (oldestSeq != null && cursor < oldestSeq - 1) {
		return { last: oldestSeq - 1, outdated: true };
	}
	return { last: cursor };
}

/**
 * 指定した時間だけ待つ。
 *
 * @param ms - 待つ時間（ミリ秒）
 * @internal
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// #endregion
