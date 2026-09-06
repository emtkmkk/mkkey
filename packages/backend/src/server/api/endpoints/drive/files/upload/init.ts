/**
 * @packageDocumentation
 *
 * 分割アップロードセッションを開始する API。
 *
 * @remarks
 * 宣言サイズと保存条件を検証し、パート受信前に一時容量を予約する。
 *
 * @internal
 */
import { DriveFiles } from "@/models/index.js";
import { DB_MAX_IMAGE_COMMENT_LENGTH } from "@/misc/hard-limits.js";
import {
	initChunkedUpload,
	ChunkedUploadError,
} from "@/services/drive/chunked-upload.js";
import { HOUR } from "@/const.js";
import define from "../../../../define.js";
import { ApiError } from "../../../../error.js";

export const meta = {
	tags: ["drive"],
	requireCredential: true,
	kind: "write:drive",
	limit: { duration: HOUR, max: 60 },
	errors: {
		invalidFileName: {
			message: "Invalid file name.",
			code: "INVALID_FILE_NAME",
			id: "f449b209-0c60-4e51-84d5-29486263bfd4",
		},
		unavailable: {
			message: "Chunked upload is unavailable.",
			code: "CHUNKED_UPLOAD_UNAVAILABLE",
			id: "127ad2e3-0d23-4cf8-b2da-f4e798dafbb7",
		},
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			uploadId: { type: "string", optional: false, nullable: false },
			chunkSize: { type: "integer", optional: false, nullable: false },
			totalParts: { type: "integer", optional: false, nullable: false },
			expiresAt: { type: "string", optional: false, nullable: false },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		name: { type: "string", nullable: true, default: null },
		size: { type: "integer", minimum: 1 },
		folderId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
		},
		comment: {
			type: "string",
			nullable: true,
			maxLength: DB_MAX_IMAGE_COMMENT_LENGTH,
			default: null,
		},
		isSensitive: { type: "boolean", default: false },
		force: { type: "boolean", default: false },
		marker: { type: "string", nullable: true, default: null },
	},
	required: ["size"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let name = ps.name?.trim() || null;
	if (name === "blob") name = null;
	if (name != null && !DriveFiles.validateFileName(name)) {
		throw new ApiError(meta.errors.invalidFileName);
	}
	try {
		return await initChunkedUpload(user.id, {
			name,
			size: ps.size,
			folderId: ps.folderId,
			comment: ps.comment,
			isSensitive: ps.isSensitive,
			force: ps.force,
			marker: ps.marker,
		});
	} catch (error) {
		if (error instanceof ChunkedUploadError) {
			throw new ApiError(meta.errors.unavailable, { reason: error.code });
		}
		throw error;
	}
});
