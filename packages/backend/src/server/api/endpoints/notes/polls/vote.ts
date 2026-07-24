/**
 * @packageDocumentation
 *
 * ノートのアンケートに投票する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/polls/vote`（POST `/api/notes/polls/vote` で呼び出し）
 * - 認証必須。`choice` または `choices` のどちらか一方で指定する。`choices` は複数肢を 1 リクエストで投票する場合に使う。
 * - **単一回答**（`multiple === false`）: `choice` 1 件、または `choices` が要素 1 つだけ（`choice` 相当）。
 * - **複数回答可**（`multiple === true`）: `choice` 1 件、または `choices` が 1 件以上（重複なし・有効な添字のみ）。同一リクエスト内は DB トランザクションでまとめる。
 * - **通知**: `poll.multiple` のとき `pollVote` の in-app 通知は、同一ユーザー・同一ノートで **初回に票が入ったときだけ 1 回**（先頭の選択肢 index を付与）。2 票目以降のリクエストや同一バッチの 2 本目以降では `createNotification` しない。
 * - `choice` と `choices` の同時指定は拒否する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { Not } from "typeorm";
import { publishNoteStream } from "@/services/stream.js";
import { createNotification } from "@/services/create-notification.js";
import { deliver } from "@/queue/index.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderVote from "@/remote/activitypub/renderer/vote.js";
import { deliverQuestionUpdate } from "@/services/note/polls/update.js";
import {
	PollVotes,
	NoteWatchings,
	Users,
	Polls,
	Blockings,
} from "@/models/index.js";
import { touchLastActiveDate } from "@/services/update-last-active-date.js";
import type { IRemoteUser } from "@/models/entities/user.js";
import { PollVote } from "@/models/entities/poll-vote.js";
import { genId } from "@/misc/gen-id.js";
import { getNote } from "../../../common/getters.js";
import { ApiError } from "../../../error.js";
import define from "../../../define.js";
import { db } from "@/db/postgre.js";

export const meta = {
	tags: ["notes"],

	requireCredential: true,

	kind: "write:votes",

	errors: {
		noSuchNote: {
			message: "その投稿は存在しません。",
			code: "NO_SUCH_NOTE",
			id: "ecafbd2e-c283-4d6d-aecb-1a0a33b75396",
		},

		noPoll: {
			message: "その投稿に投票はありません。",
			code: "NO_POLL",
			id: "5f979967-52d9-4314-a911-1c673727f92f",
		},

		invalidChoice: {
			message: "選択が正しくありません。",
			code: "INVALID_CHOICE",
			id: "e0cc9a04-f2e8-41e4-a5f1-4127293260cc",
		},

		invalidPollVoteParams: {
			message:
				"投票パラメータが正しくありません。`choice` または `choices` のどちらか一方を指定してください。",
			code: "INVALID_POLL_VOTE_PARAMS",
			id: "7f2e9a1b-4c3d-4e5f-8a9b-0c1d2e3f4a5b",
		},

		alreadyVoted: {
			message: "既に投票済みです。",
			code: "ALREADY_VOTED",
			id: "0963fc77-efac-419b-9424-b391608dc6d8",
		},

		alreadyExpired: {
			message: "投票は既に終了しています。",
			code: "ALREADY_EXPIRED",
			id: "1022a357-b085-4054-9083-8f8de358337e",
		},

		youHaveBeenBlocked: {
			message: "あなたはこのユーザーにブロックされているため、投票できません。",
			code: "YOU_HAVE_BEEN_BLOCKED",
			id: "85a5377e-b1e9-4617-b0b9-5bea73331e49",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		noteId: {
			type: "string",
			format: "misskey:id",
			description: "投票する投稿の ID。",
		},
		choice: { type: "integer", description: "単一の選択肢 index。" },
		choices: {
			type: "array",
			items: { type: "integer" },
			description: "複数の選択肢 index。`choice` と同時に指定しない。",
		},
	},
	required: ["noteId"],
} as const;

/**
 * `choice` / `choices` から正規化した選択肢 index 配列を返す。
 *
 * @param ps リクエスト body
 * @throws {ApiError} 両方指定・両方未指定・`choices` が空・重複
 * @returns 重複除去後の index 列（順序は入力の初出順を維持）
 * @internal
 */
function resolveChoiceIndices(ps: {
	choice?: number;
	choices?: number[];
}): number[] {
	const hasChoice = typeof ps.choice === "number";
	const hasChoices = Array.isArray(ps.choices) && ps.choices.length > 0;

	if (hasChoice && hasChoices) {
		throw new ApiError(meta.errors.invalidPollVoteParams);
	}
	if (!hasChoice && !hasChoices) {
		throw new ApiError(meta.errors.invalidPollVoteParams);
	}
	if (hasChoices) {
		const seen = new Set<number>();
		const out: number[] = [];
		for (const c of ps.choices!) {
			if (seen.has(c)) {
				throw new ApiError(meta.errors.invalidChoice);
			}
			seen.add(c);
			out.push(c);
		}
		return out;
	}
	return [ps.choice!];
}

export default define(meta, paramDef, async (ps, user) => {
	const createdAt = new Date();

	const choiceIndices = resolveChoiceIndices(ps);

	// 投票先を取得する
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

	if (note == null) {
		throw new ApiError(meta.errors.noSuchNote);
	}

	if (!note.hasPoll) {
		throw new ApiError(meta.errors.noPoll);
	}

	// ブロック関係を確認する
	if (note.userId !== user.id) {
		const block = await Blockings.findOneBy({
			blockerId: note.userId,
			blockeeId: user.id,
		});
		if (block) {
			throw new ApiError(meta.errors.youHaveBeenBlocked);
		}
	}

	const poll = await Polls.findOneByOrFail({ noteId: note.id });

	if (poll.expiresAt && poll.expiresAt < createdAt) {
		throw new ApiError(meta.errors.alreadyExpired);
	}

	if (!poll.multiple && choiceIndices.length !== 1) {
		throw new ApiError(meta.errors.invalidChoice);
	}

	for (const c of choiceIndices) {
		if (poll.choices[c] == null) {
			throw new ApiError(meta.errors.invalidChoice);
		}
	}

	const exist = await PollVotes.findBy({
		noteId: note.id,
		userId: user.id,
	});
	const existBeforeCount = exist.length;

	// 既存票との整合（単一は 1 票まで、複数は同一肢の重複禁止）
	if (!poll.multiple) {
		if (exist.length !== 0) {
			throw new ApiError(meta.errors.alreadyVoted);
		}
	} else {
		for (const c of choiceIndices) {
			if (exist.some((x) => x.choice === c)) {
				throw new ApiError(meta.errors.alreadyVoted);
			}
		}
	}

	/** `poll.multiple` のとき pollVote 通知に載せる choice（初回のみ。null なら通知しない） */
	const pollVoteNotifyChoice: number | null = !poll.multiple
		? choiceIndices[0]
		: existBeforeCount === 0
			? choiceIndices[0]
			: null;

	const insertedVoteIds: string[] = [];

	await db.transaction(async (manager) => {
		for (const c of choiceIndices) {
			const id = genId();
			await manager.insert(PollVote, {
				id,
				createdAt,
				noteId: note.id,
				userId: user.id,
				choice: c,
			});
			insertedVoteIds.push(id);
			const index = c + 1;
			await manager.query(
				`UPDATE poll SET votes[${index}] = votes[${index}] + 1 WHERE "noteId" = $1`,
				[poll.noteId],
			);
		}
	});

	touchLastActiveDate(user.id);

	let i = 0;
	for (const c of choiceIndices) {
		const voteId = insertedVoteIds[i++]!;
		publishNoteStream(note.id, "pollVoted", {
			choice: c,
			userId: user.id,
		});

		if (pollVoteNotifyChoice !== null && c === pollVoteNotifyChoice) {
			createNotification(
				note.userId,
				"pollVote",
				{
					notifierId: user.id,
					noteId: note.id,
					choice: c,
				},
				{ notifier: user },
			);

			NoteWatchings.findBy({
				noteId: note.id,
				userId: Not(user.id),
			}).then((watchers) => {
				for (const watcher of watchers) {
					const notifierId =
						watcher.userId === note.userId ? user.id : note.userId;
					createNotification(
						watcher.userId,
						"pollVote",
						{
							notifierId,
							noteId: note.id,
							choice: c,
						},
						notifierId === user.id
							? { notifier: user }
							: undefined,
					);
				}
			});
		}

		if (note.userHost != null) {
			const vote = await PollVotes.findOneByOrFail({ id: voteId });
			const pollOwner = (await Users.findOneByOrFail({
				id: note.userId,
			})) as IRemoteUser;

			deliver(
				user,
				renderActivity(await renderVote(user, vote, note, poll, pollOwner)),
				pollOwner.inbox,
			);
		}
	}

	deliverQuestionUpdate(note.id);
});
