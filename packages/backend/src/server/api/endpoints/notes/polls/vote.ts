/**
 * @packageDocumentation
 *
 * ノートのアンケートに投票する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `notes/polls/vote`（POST `/api/notes/polls/vote` で呼び出し）
 * - 認証必須。noteId と choice で指定した選択肢に投票する。重複投票は不可。
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
import type { IRemoteUser } from "@/models/entities/user.js";
import { genId } from "@/misc/gen-id.js";
import { getNote } from "../../../common/getters.js";
import { ApiError } from "../../../error.js";
import define from "../../../define.js";

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
		noteId: { type: "string", format: "misskey:id" },
		choice: { type: "integer" },
	},
	required: ["noteId", "choice"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const createdAt = new Date();

	// 投票先を取得する
	const note = await getNote(ps.noteId, user).catch((err) => {
		if (err.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24")
			throw new ApiError(meta.errors.noSuchNote);
		throw err;
	});

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

	if (poll.choices[ps.choice] == null) {
		throw new ApiError(meta.errors.invalidChoice);
	}

	// 既に投票済みの場合
	const exist = await PollVotes.findBy({
		noteId: note.id,
		userId: user.id,
	});

	if (exist.length) {
		if (poll.multiple) {
			if (exist.some((x) => x.choice === ps.choice)) {
				throw new ApiError(meta.errors.alreadyVoted);
			}
		} else {
			throw new ApiError(meta.errors.alreadyVoted);
		}
	}

	// 投票を作成する
	const vote = await PollVotes.insert({
		id: genId(),
		createdAt,
		noteId: note.id,
		userId: user.id,
		choice: ps.choice,
	}).then((x) => PollVotes.findOneByOrFail(x.identifiers[0]));

	// 投票数をインクリメントする
	const index = ps.choice + 1; // In SQL, array index is 1 based
	await Polls.query(
		`UPDATE poll SET votes[${index}] = votes[${index}] + 1 WHERE "noteId" = '${poll.noteId}'`,
	);

	publishNoteStream(note.id, "pollVoted", {
		choice: ps.choice,
		userId: user.id,
	});

	// 通知する
	createNotification(note.userId, "pollVote", {
		notifierId: user.id,
		noteId: note.id,
		choice: ps.choice,
	}, { notifier: user });

	// ウォッチャーを取得する（投稿者は投票者表示）
	NoteWatchings.findBy({
		noteId: note.id,
		userId: Not(user.id),
	}).then((watchers) => {
		for (const watcher of watchers) {
			const notifierId = watcher.userId === note.userId ? user.id : note.userId;
			createNotification(watcher.userId, "pollVote", {
				notifierId,
				noteId: note.id,
				choice: ps.choice,
			}, notifierId === user.id ? { notifier: user } : undefined);
		}
	});

	// リモート投票の場合リプライ送信
	if (note.userHost != null) {
		const pollOwner = (await Users.findOneByOrFail({
			id: note.userId,
		})) as IRemoteUser;

		deliver(
			user,
			renderActivity(await renderVote(user, vote, note, poll, pollOwner)),
			pollOwner.inbox,
		);
	}

	// リモートフォロワーにUpdate配信
	deliverQuestionUpdate(note.id);
});
