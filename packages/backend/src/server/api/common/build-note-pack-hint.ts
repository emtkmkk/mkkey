/**
 * Notes.packMany 用の userMap / noteMap をタイムラインから組み立てる共通ヘルパー
 *
 * @packageDocumentation
 *
 * メインクエリで JOIN 済みの user / reply / renote を packMany に渡すための hint を構築する。
 * user に avatar/banner が未ロードの場合は DriveFiles を一括取得して付与する。
 *
 * @internal
 */

import { In } from "typeorm";
import { DriveFiles } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";

export type NotePackHintMaps = {
	userMap: Map<User["id"], User>;
	noteMap: Map<Note["id"], Note>;
};

/**
 * ノート配列から userMap と noteMap だけを組み立てる（DriveFiles は取得しない）。
 * メインクエリで既に user/reply/renote を JOIN している場合に packMany の _hint_ 用に使う。
 *
 * @param notes - user / reply / renote が JOIN 済みのノート配列
 * @returns packMany の _hint_ に渡す { userMap, noteMap }
 *
 * @internal
 */
export function buildUserAndNoteMapsFromNotes(notes: Note[]): NotePackHintMaps {
	const userMap = new Map<User["id"], User>();
	const noteMap = new Map<Note["id"], Note>();
	for (const note of notes) {
		if (note.user) userMap.set(note.user.id, note.user);
		if (note.reply) {
			noteMap.set(note.reply.id, note.reply);
			if (note.reply.user) userMap.set(note.reply.user.id, note.reply.user);
		}
		if (note.renote) {
			noteMap.set(note.renote.id, note.renote);
			if (note.renote.user) userMap.set(note.renote.user.id, note.renote.user);
		}
	}
	return { userMap, noteMap };
}

/**
 * ノート配列から userMap と noteMap を組み立て、必要なら avatar/banner を DriveFiles で補完する。
 *
 * @param notes - user / reply / renote が JOIN 済み（または部分ロード済み）のノート配列
 * @returns packMany の _hint_ に渡す { userMap, noteMap }
 *
 * @remarks
 * user に avatar/banner が無い場合は avatarId/bannerId を集めて DriveFiles.findBy で一括取得し、
 * user に付与する。既に avatar/banner が入っている場合はスキップする。
 *
 * @internal
 */
export async function buildNotePackHintFromTimeline(
	notes: Note[],
): Promise<NotePackHintMaps> {
	const { userMap, noteMap } = buildUserAndNoteMapsFromNotes(notes);
	const userImageIds: string[] = [];
	for (const u of userMap.values()) {
		if (u.avatarId) userImageIds.push(u.avatarId);
		if (u.bannerId) userImageIds.push(u.bannerId);
	}
	if (userImageIds.length > 0) {
		const driveFiles = await DriveFiles.findBy({
			id: In([...new Set(userImageIds)]),
		});
		const driveFileMap = new Map(driveFiles.map((f) => [f.id, f]));
		for (const u of userMap.values()) {
			if (u.avatarId && !u.avatar)
				u.avatar = driveFileMap.get(u.avatarId) ?? null;
			if (u.bannerId && !u.banner)
				u.banner = driveFileMap.get(u.bannerId) ?? null;
		}
	}
	return { userMap, noteMap };
}
