import { DriveFiles } from "@/models/index.js";
import define from "../../../define.js";
import { ApiError } from "../../../error.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "read:admin:drive",

	errors: {
		noSuchFile: {
			message: "そのファイルは存在しません。",
			code: "NO_SUCH_FILE",
			id: "caf3ca38-c6e5-472e-a30c-b05377dcc240",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			id: {
				type: "string",
				optional: false,
				nullable: false,
				format: "id",
				example: "xxxxxxxxxx",
			},
			createdAt: {
				type: "string",
				optional: false,
				nullable: false,
				format: "date-time",
			},
			userId: {
				type: "string",
				optional: false,
				nullable: true,
				format: "id",
				example: "xxxxxxxxxx",
			},
			userHost: {
				type: "string",
				optional: false,
				nullable: true,
				description: "ローカルホストは `null` で表します。",
			},
			md5: {
				type: "string",
				optional: false,
				nullable: false,
				format: "md5",
				example: "15eca7fba0480996e2245f5185bf39f2",
			},
			name: {
				type: "string",
				optional: false,
				nullable: false,
				example: "lenna.jpg",
			},
			type: {
				type: "string",
				optional: false,
				nullable: false,
				example: "image/jpeg",
			},
			size: {
				type: "number",
				optional: false,
				nullable: false,
				example: 51469,
			},
			comment: {
				type: "string",
				optional: false,
				nullable: true,
			},
			blurhash: {
				type: "string",
				optional: false,
				nullable: true,
			},
			properties: {
				type: "object",
				optional: false,
				nullable: false,
				// 画像以外のファイルでは width / height を持たない（エンティティ側も optional）
				properties: {
					width: {
						type: "number",
						optional: true,
						nullable: false,
						example: 1280,
					},
					height: {
						type: "number",
						optional: true,
						nullable: false,
						example: 720,
					},
					avgColor: {
						type: "string",
						optional: true,
						nullable: false,
						example: "rgb(40,65,87)",
					},
				},
			},
			storedInternal: {
				type: "boolean",
				optional: false,
				nullable: true,
				example: true,
			},
			url: {
				type: "string",
				optional: false,
				nullable: true,
				format: "url",
			},
			thumbnailUrl: {
				type: "string",
				optional: false,
				nullable: true,
				format: "url",
			},
			webpublicUrl: {
				type: "string",
				optional: false,
				nullable: true,
				format: "url",
			},
			// アクセスキーはリンクファイルなど保存していないものでは null になる（エンティティに合わせる）
			accessKey: {
				type: "string",
				optional: false,
				nullable: true,
			},
			thumbnailAccessKey: {
				type: "string",
				optional: false,
				nullable: true,
			},
			webpublicAccessKey: {
				type: "string",
				optional: false,
				nullable: true,
			},
			uri: {
				type: "string",
				optional: false,
				nullable: true,
			},
			src: {
				type: "string",
				optional: false,
				nullable: true,
			},
			folderId: {
				type: "string",
				optional: false,
				nullable: true,
				format: "id",
				example: "xxxxxxxxxx",
			},
			isSensitive: {
				type: "boolean",
				optional: false,
				nullable: false,
			},
			isLink: {
				type: "boolean",
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	anyOf: [
		{
			properties: {
				fileId: { type: "string", format: "misskey:id" },
			},
			required: ["fileId"],
		},
		{
			properties: {
				url: { type: "string" },
			},
			required: ["url"],
		},
	],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const file = ps.fileId
		? await DriveFiles.findOneBy({ id: ps.fileId })
		: await DriveFiles.findOne({
				where: [
					{
						url: ps.url,
					},
					{
						thumbnailUrl: ps.url,
					},
					{
						webpublicUrl: ps.url,
					},
				],
		  });

	if (file == null) {
		throw new ApiError(meta.errors.noSuchFile);
	}

	// NOTE: エンティティ（Date 型の createdAt など）をそのまま返しているため、res スキーマの型に合わせて
	// JSON 化後と同じ形（createdAt は ISO 文字列）に整える。出力は従来と同じ。
	const { requestIp, requestHeaders, ...rest } = file;
	const packed = {
		...rest,
		createdAt: file.createdAt.toISOString(),
	};

	// 管理者以外には要求元 IP とヘッダーを見せない（以前は undefined を代入して JSON から落としていた）
	return me.isAdmin ? { ...packed, requestIp, requestHeaders } : packed;
});
