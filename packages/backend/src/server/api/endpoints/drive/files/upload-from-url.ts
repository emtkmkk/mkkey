import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import define from "../../../define.js";
import { DriveFiles } from "@/models/index.js";
import { publishMainStream } from "@/services/stream.js";
import { createDriveFileProgressPublisher } from "@/services/drive/progress-publisher.js";
import { HOUR } from "@/const.js";

export const meta = {
	tags: ["drive"],

	limit: {
		duration: HOUR,
		max: 60,
	},

	description:
		"Request the server to download a new drive file from the specified URL.",

	requireCredential: true,

	kind: "write:drive",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		url: { type: "string" },
		folderId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			default: null,
		},
		isSensitive: { type: "boolean", default: false },
		comment: { type: "string", nullable: true, maxLength: 512, default: null },
		marker: { type: "string", nullable: true, default: null },
		force: { type: "boolean", default: false },
	},
	required: ["url"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// NOTE: この API は即座に返り、実際の取得と登録は裏で走る。その間クライアントには
	// 何も見えないため、marker が指定されている場合は処理段階をストリームで通知する。
	const onProgress = createDriveFileProgressPublisher(user.id, ps.marker);

	uploadFromUrl({
		url: ps.url,
		user,
		folderId: ps.folderId,
		sensitive: ps.isSensitive,
		force: ps.force,
		comment: ps.comment,
		onProgress,
	})
		.then((file) => {
			DriveFiles.pack(file, { self: true }).then((packedFile) => {
				publishMainStream(user.id, "urlUploadFinished", {
					marker: ps.marker,
					file: packedFile,
				});
			});
		})
		.catch(() => {
			// NOTE: 失敗も通知しないと、完了を待っているクライアントが
			// タイムアウトするまで待たされ続ける。
			publishMainStream(user.id, "urlUploadFinished", {
				marker: ps.marker,
				file: null,
			});
		});
});
