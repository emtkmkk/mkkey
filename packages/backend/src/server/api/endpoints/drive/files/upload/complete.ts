/**
 * @packageDocumentation
 *
 * 分割アップロードを DriveFile として確定する API。
 *
 * @remarks
 * 全パートを確認してから既存の Drive 登録処理へ渡す。
 *
 * @internal
 */
import { DriveFiles } from "@/models/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import { createDriveFileProgressPublisher } from "@/services/drive/progress-publisher.js";
import {
	ChunkedUploadError,
	completeChunkedUpload,
} from "@/services/drive/chunked-upload.js";
import { HOUR } from "@/const.js";
import define from "../../../../define.js";
import { ApiError } from "../../../../error.js";

export const meta = {
	tags: ["drive"],
	requireCredential: true,
	kind: "write:drive",
	limit: { duration: HOUR, max: 60 },
	res: { type: "object", optional: false, nullable: false, ref: "DriveFile" },
	errors: {
		invalidUpload: {
			message: "The chunked upload cannot be completed.",
			code: "INVALID_CHUNKED_UPLOAD",
			id: "8f6217f7-8137-44fa-a965-c6d61f3e1684",
		},
		inappropriate: {
			message:
				"Cannot upload the file because it may contain inappropriate content.",
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
		uploadId: {
			type: "string",
			minLength: 36,
			maxLength: 36,
			pattern: "^[0-9a-fA-F-]+$",
		},
	},
	required: ["uploadId"],
} as const;

export default define(
	meta,
	paramDef,
	async (ps, user, _token, _file, _cleanup, ip, headers) => {
		const instance = await fetchMeta();
		try {
			const file = await completeChunkedUpload(
				ps.uploadId,
				user,
				instance.enableIpLogging ? ip ?? null : null,
				instance.enableIpLogging ? headers ?? null : null,
				(marker) => createDriveFileProgressPublisher(user.id, marker),
			);
			return await DriveFiles.pack(file, { self: true });
		} catch (error) {
			if (error instanceof ChunkedUploadError) {
				throw new ApiError(meta.errors.invalidUpload, { reason: error.code });
			}
			if (error instanceof IdentifiableError) {
				if (error.id === "282f77bf-5816-4f72-9264-aa14d8261a21") {
					throw new ApiError(meta.errors.inappropriate);
				}
				if (error.id === "c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6") {
					throw new ApiError(meta.errors.noFreeSpace);
				}
			}
			throw error;
		}
	},
);
