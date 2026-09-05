/**
 * @packageDocumentation
 *
 * ドライブにファイルをアップロードする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `drive/files/create`（POST `/api/drive/files/create` で呼び出し）
 * - 認証必須。ファイルをアップロードして DriveFile を作成する。requireFile: true。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { addFile } from "@/services/drive/add-file.js";
import { publishMainStream } from "@/services/stream.js";
import type {
	DriveFileProcessStage,
	DriveFileProgressReporter,
} from "@/misc/drive-file-progress.js";
import { DriveFiles } from "@/models/index.js";
import { DB_MAX_IMAGE_COMMENT_LENGTH } from "@/misc/hard-limits.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { HOUR } from "@/const.js";
import define from "../../../define.js";
import { apiLogger } from "../../../logger.js";
import { ApiError } from "../../../error.js";

export const meta = {
	tags: ["drive"],

	requireCredential: true,

	limit: {
		duration: HOUR,
		max: 480,
	},

	requireFile: true,

	kind: "write:drive",

	description:
		"ドライブに新規ファイルをアップロードする。multipart でファイル本体を送る。フォルダ・コメント・閲覧注意フラグを指定できる。投稿に添付するときは返却された ID を notes/create の fileIds に渡す。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "DriveFile",
	},

	errors: {
		invalidFileName: {
			message: "Invalid file name.",
			code: "INVALID_FILE_NAME",
			id: "f449b209-0c60-4e51-84d5-29486263bfd4",
		},

		inappropriate: {
			message:
				"Cannot upload the file because it has been determined that it possibly contains inappropriate content.",
			code: "INAPPROPRIATE",
			id: "bec5bd69-fba3-43c9-b4fb-2894b66ad5d2",
		},

		noFreeSpace: {
			message:
				"Cannot upload the file because you have no free space of drive.",
			code: "NO_FREE_SPACE",
			id: "d08dbc37-a6a9-463a-8c47-96c32ab5f064",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		folderId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
			description: "保存先フォルダの ID。省略時はルートに保存される。",
		},
		name: { type: "string", nullable: true, default: null },
		comment: {
			type: "string",
			nullable: true,
			maxLength: DB_MAX_IMAGE_COMMENT_LENGTH,
			default: null,
		},
		isSensitive: { type: "boolean", default: false },
		force: { type: "boolean", default: false },
		marker: {
			type: "string",
			nullable: true,
			default: null,
			description:
				"サーバ側の処理進捗を main ストリームの driveFileProgress で受け取るための識別子。",
		},
	},
	required: [],
} as const;

export default define(
	meta,
	paramDef,
	async (ps, user, _, file, cleanup, ip, headers) => {
		// 'name' パラメータを取得する
		let name = ps.name || file.originalname;
		if (name !== undefined && name !== null) {
			name = name.trim();
			if (name.length === 0) {
				name = null;
			} else if (name === "blob") {
				name = null;
			} else if (!DriveFiles.validateFileName(name)) {
				throw new ApiError(meta.errors.invalidFileName);
			}
		} else {
			name = null;
		}

		const m = await fetchMeta();

		// NOTE: ボディの送信が終わってからファイル作成が終わるまでの間、クライアントには
		// 進捗が出せない。marker が指定されている場合は、その間の処理段階をストリームで通知する。
		// 通知が過剰にならないよう、同じ段階の更新は一定間隔に間引く。
		const marker = ps.marker;
		let lastStage: DriveFileProcessStage | null = null;
		let lastPublishedAt = 0;
		const onProgress: DriveFileProgressReporter | null =
			marker && user
				? (stage, progress) => {
						const now = Date.now();
						if (stage === lastStage && now - lastPublishedAt < 200) return;
						lastStage = stage;
						lastPublishedAt = now;
						publishMainStream(user.id, "driveFileProgress", {
							marker,
							stage,
							progress: progress ?? null,
						});
				  }
				: null;

		try {
			// ファイルを作成する
			const driveFile = await addFile({
				user,
				path: file.path,
				name,
				comment: ps.comment,
				folderId: ps.folderId,
				force: ps.force,
				sensitive: ps.isSensitive,
				requestIp: m.enableIpLogging ? ip : null,
				requestHeaders: m.enableIpLogging ? headers : null,
				onProgress,
			});
			return await DriveFiles.pack(driveFile, { self: true });
		} catch (e) {
			if (e instanceof Error || typeof e === "string") {
				apiLogger.error(e);
			}
			if (e instanceof IdentifiableError) {
				if (e.id === "282f77bf-5816-4f72-9264-aa14d8261a21")
					throw new ApiError(meta.errors.inappropriate);
				if (e.id === "c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6")
					throw new ApiError(meta.errors.noFreeSpace);
			}
			throw new ApiError();
		} finally {
			cleanup!();
		}
	},
);
