/**
 * @packageDocumentation
 *
 * 分割アップロードを中止する API。
 *
 * @remarks
 * 所有者のセッション、予約容量、一時ファイルをまとめて解放する。
 *
 * @internal
 */
import {
	abortChunkedUpload,
	ChunkedUploadError,
} from "@/services/drive/chunked-upload.js";
import { HOUR } from "@/const.js";
import define from "../../../../define.js";
import { ApiError } from "../../../../error.js";

export const meta = {
	tags: ["drive"],
	requireCredential: true,
	kind: "write:drive",
	limit: { duration: HOUR, max: 120 },
	errors: {
		invalidUpload: {
			message: "The chunked upload cannot be aborted.",
			code: "INVALID_CHUNKED_UPLOAD",
			id: "aa963049-0a2b-493f-83f8-c8d7b7781c61",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		uploadId: {
			type: "string",
			minLength: 36,
			maxLength: 36,
			pattern: "^[0-9a-fA-F-]+$",
		},
	},
	required: ["uploadId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		await abortChunkedUpload(ps.uploadId, user.id);
	} catch (error) {
		if (error instanceof ChunkedUploadError) {
			throw new ApiError(meta.errors.invalidUpload, { reason: error.code });
		}
		throw error;
	}
});
