/**
 * @packageDocumentation
 *
 * 分割アップロードの 1 パートを受信する API。
 *
 * @remarks
 * 64 MiB 以下の multipart を受け、所有者確認後に完成ファイルの所定位置へ書く。
 *
 * @internal
 */
import {
	CHUNKED_UPLOAD_PART_SIZE,
	ChunkedUploadError,
	writeChunkedUploadPart,
} from "@/services/drive/chunked-upload.js";
import { HOUR } from "@/const.js";
import define from "../../../../define.js";
import { ApiError } from "../../../../error.js";

export const meta = {
	tags: ["drive"],
	requireCredential: true,
	requireFile: true,
	fileSizeLimit: CHUNKED_UPLOAD_PART_SIZE,
	kind: "write:drive",
	limit: { duration: HOUR, max: 480 },
	errors: {
		invalidPart: {
			message: "The upload part is invalid.",
			code: "INVALID_UPLOAD_PART",
			id: "3e43d198-cdf6-4df5-bf58-71546a59092e",
		},
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			receivedBytes: { type: "integer", optional: false, nullable: false },
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
		partNumber: { type: "integer", minimum: 1 },
	},
	required: ["uploadId", "partNumber"],
} as const;

export default define(
	meta,
	paramDef,
	async (ps, user, _token, file, cleanup) => {
		try {
			return {
				receivedBytes: await writeChunkedUploadPart(
					ps.uploadId,
					user.id,
					ps.partNumber,
					file.path,
				),
			};
		} catch (error) {
			if (error instanceof ChunkedUploadError) {
				throw new ApiError(meta.errors.invalidPart, { reason: error.code });
			}
			throw error;
		} finally {
			cleanup?.();
		}
	},
);
