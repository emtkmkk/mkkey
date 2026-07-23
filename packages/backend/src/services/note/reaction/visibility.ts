/**
 * @packageDocumentation
 *
 * 閲覧者から見えない利用者のリアクション件数を、複数ノート分まとめて集計する。
 *
 * @remarks
 * NOTE: `Note.reactions` は投稿者側ワードミュート等を反映した非正規化値である一方、
 * この集計は個別リアクション行を数えるため、差し引き過多になる場合がある。
 * ベータ仕様では見えないべきリアクションを残さないことを優先し、呼び出し側で0へ丸める。
 *
 * @internal
 */

import { In } from "typeorm";
import { hasMuteScope } from "@/misc/mute-scope.js";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import {
	Blockings,
	Mutings,
	NoteReactions,
	UserProfiles,
} from "@/models/index.js";

/** ノートIDごとの非表示リアクション件数。 */
export type HiddenReactionDeltaMap = Map<
	Note["id"],
	Record<string, number>
>;

/**
 * 閲覧者設定が有効な場合だけ、非表示利用者分を一括集計する。
 *
 * @param noteIds - 件数を補正するノートID群
 * @param viewerId - 閲覧者ID
 * @returns ノートIDごとのリアクション別差し引き件数。設定OFF時も空Map
 * @public
 */
export async function getHiddenReactionDeltas(
	noteIds: readonly Note["id"][],
	viewerId: User["id"],
): Promise<HiddenReactionDeltaMap> {
	const uniqueNoteIds = [...new Set(noteIds)];
	if (uniqueNoteIds.length === 0) return new Map();

	const profile = await UserProfiles.findOne({
		where: { userId: viewerId },
		select: ["hideMutedAndBlockedUserReactions"],
	});
	if (profile?.hideMutedAndBlockedUserReactions !== true) {
		return new Map();
	}

	const [mutings, blockedByViewer, blockingViewer] = await Promise.all([
		Mutings.findBy({ muterId: viewerId }),
		Blockings.findBy({ blockerId: viewerId }),
		Blockings.findBy({ blockeeId: viewerId }),
	]);
	const hiddenUserIds = new Set<User["id"]>(
		mutings
			.filter((muting) => hasMuteScope(muting.scope, "reaction"))
			.map((muting) => muting.muteeId),
	);
	for (const blocking of blockedByViewer) {
		hiddenUserIds.add(blocking.blockeeId);
	}
	for (const blocking of blockingViewer) {
		hiddenUserIds.add(blocking.blockerId);
	}
	if (hiddenUserIds.size === 0) return new Map();

	const rows = await NoteReactions.createQueryBuilder("reaction")
		.select("reaction.noteId", "noteId")
		.addSelect("reaction.reaction", "reaction")
		.addSelect("COUNT(*)", "count")
		.where({ noteId: In(uniqueNoteIds), userId: In([...hiddenUserIds]) })
		.groupBy("reaction.noteId")
		.addGroupBy("reaction.reaction")
		.getRawMany<{ noteId: string; reaction: string; count: string }>();

	const result: HiddenReactionDeltaMap = new Map();
	for (const row of rows) {
		const deltas = result.get(row.noteId) ?? {};
		deltas[row.reaction] = Number(row.count);
		result.set(row.noteId, deltas);
	}
	return result;
}
