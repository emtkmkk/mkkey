/**
 * @packageDocumentation
 *
 * ドライブへの登録処理の進捗を、依頼したユーザーの main ストリームへ流すための組み立て。
 *
 * @remarks
 * リクエストボディの送信（あるいは URL の指定）が終わってからファイルが作成されるまでの間、
 * クライアントには進捗を出す手段が無い。その区間の処理段階をストリームで通知するために使う。
 *
 * @internal
 */
import type { User } from "@/models/entities/user.js";
import type {
	DriveFileProcessStage,
	DriveFileProgressReporter,
} from "@/misc/drive-file-progress.js";
import { publishMainStream } from "@/services/stream.js";

/** 同じ段階の進捗を流す最短間隔（ミリ秒）。 */
const PUBLISH_INTERVAL_MS = 200;

/**
 * 進捗をストリームへ流す関数を作る。
 *
 * 段階が変わったときは即座に、同じ段階の進捗更新は一定間隔に間引いて配信する。
 *
 * @param userId - 通知先のユーザー
 * @param marker - クライアントが自分のアップロードを見分けるための識別子
 * @returns 進捗の通知先。marker が無い場合は null（＝通知しない）
 */
export function createDriveFileProgressPublisher(
	userId: User["id"],
	marker: string | null | undefined,
): DriveFileProgressReporter | null {
	if (!marker) return null;

	let lastStage: DriveFileProcessStage | null = null;
	let lastPublishedAt = 0;

	return (stage, progress) => {
		const now = Date.now();
		if (stage === lastStage && now - lastPublishedAt < PUBLISH_INTERVAL_MS) {
			return;
		}
		lastStage = stage;
		lastPublishedAt = now;
		publishMainStream(userId, "driveFileProgress", {
			marker,
			stage,
			progress: progress ?? null,
		});
	};
}
