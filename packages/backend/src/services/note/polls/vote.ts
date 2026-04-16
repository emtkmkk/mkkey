/**
 * @packageDocumentation
 *
 * アンケート（投票）の投票処理を行うサービス。
 *
 * @remarks
 * - **役割**: ActivityPub 経由の投票取り込みなどで呼ばれ、PollVotes に保存し通知・ストリームを発火する。
 * - **通知**: REST の `notes/polls/vote` と同様、`poll.multiple` のときは同一 user+note で **初回の 1 票だけ** `pollVote` 通知を送る（2 票目以降は `createNotification` しない）。
 *
 * @see {@link endpoints/notes/polls/vote} 投票 API（クライアント向け）
 * @internal
 */
import { publishNoteStream } from "@/services/stream.js";
import type { CacheableUser } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import type { Note } from "@/models/entities/note.js";
import { PollVotes, NoteWatchings, Polls, Blockings } from "@/models/index.js";
import { Not } from "typeorm";
import { genId } from "@/misc/gen-id.js";
import { createNotification } from "../../create-notification.js";

export default async function (
	user: CacheableUser,
	note: Note,
	choice: number,
) {
	const poll = await Polls.findOneBy({ noteId: note.id });

	if (poll == null) throw new Error("poll not found");

	// 有効な選択肢かどうかを確認
	if (poll.choices[choice] == null) throw new Error("invalid choice param");

	// ブロック関係を確認
	if (note.userId !== user.id) {
		const block = await Blockings.findOneBy({
			blockerId: note.userId,
			blockeeId: user.id,
		});
		if (block) {
			throw new Error("blocked");
		}
	}

	// 既に投票済みの場合
	const exist = await PollVotes.findBy({
		noteId: note.id,
		userId: user.id,
	});

	if (poll.multiple) {
		if (exist.some((x) => x.choice === choice)) {
			throw new Error("already voted");
		}
	} else if (exist.length !== 0) {
		throw new Error("already voted");
	}

	// 投票を作成
	await PollVotes.insert({
		id: genId(),
		createdAt: new Date(),
		noteId: note.id,
		userId: user.id,
		choice: choice,
	});

	// 投票数をインクリメント
	const index = choice + 1; // SQLでは配列インデックスは1始まり
	await Polls.query(
		`UPDATE poll SET votes[${index}] = votes[${index}] + 1 WHERE "noteId" = '${poll.noteId}'`,
	);

	publishNoteStream(note.id, "pollVoted", {
		choice: choice,
		userId: user.id,
	});

	// 投票時、ユーザの最終更新時刻を更新
	Users.update(user.id, {
		lastActiveDate: new Date(),
	});

	// 複数回答可では初回の 1 票のみ in-app 通知（REST と揃える）
	const shouldNotifyPollVote = !poll.multiple || exist.length === 0;
	if (shouldNotifyPollVote) {
		createNotification(note.userId, "pollVote", {
			notifierId: user.id,
			noteId: note.id,
			choice: choice,
		}, { notifier: user });

		// ウォッチャーを取得（投稿者には投票者を表示）
		NoteWatchings.findBy({
			noteId: note.id,
			userId: Not(user.id),
		}).then((watchers) => {
			for (const watcher of watchers) {
				const notifierId = watcher.userId === note.userId ? user.id : note.userId;
				createNotification(watcher.userId, "pollVote", {
					notifierId,
					noteId: note.id,
					choice: choice,
				}, notifierId === user.id ? { notifier: user } : undefined);
			}
		});
	}
}
