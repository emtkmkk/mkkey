/**
 * @packageDocumentation
 *
 * ドライブファイルを削除する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/files/delete`（POST `/api/drive/files/delete` で呼び出し）
 * - 認証必須。fileId で指定したドライブファイルを削除する。
 * - レート制限は 20 回/時間・最短間隔 1 秒（投稿削除がかつて使っていた引き締め値に合わせる）。
 * - ノートの `fileIds` は掃除しない。欠落添付はクライアント側でプレースホルダ表示する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { deleteFile } from "@/services/drive/delete-file.js";
import { publishDriveStream } from "@/services/stream.js";
import { SECOND, HOUR } from "@/const.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { DriveFiles } from "@/models/index.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	kind: "write:drive",

	limit: {
		duration: HOUR,
		max: 20,
		minInterval: SECOND,
	},

	description: "指定したドライブファイルを削除します。",

	errors: {
		noSuchFile: {
			message: "No such file.",
			code: "NO_SUCH_FILE",
			id: "908939ec-e52b-4458-b395-1025195cea58",
		},

		accessDenied: {
			message: "Access denied.",
			code: "ACCESS_DENIED",
			id: "5eb8d909-2540-4970-90b8-dd6f86088121",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		fileId: { type: "string", format: "misskey:id" },
	},
	required: ["fileId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const file = await DriveFiles.findOneBy({ id: ps.fileId });

	if (file == null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	if (!(user.isAdmin || user.isModerator) && file.userId !== user.id) {
		throw new ApiError(meta.errors.accessDenied);
	}

	// 削除する
	await deleteFile(file);

	// fileDeleted イベントを発行する
	publishDriveStream(user.id, "fileDeleted", file.id);
});
