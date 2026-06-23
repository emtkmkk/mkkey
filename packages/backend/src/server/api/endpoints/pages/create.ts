import { Pages, DriveFiles } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { Page } from "@/models/entities/page.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { HOUR } from "@/const.js";

export const meta = {
	tags: ["pages"],

	requireCredential: true,

	kind: "write:pages",

	description:
		"新規ページを作成する。タイトル・URL用名前・ブロック配列（content）・変数（variables）・スクリプト（script）で構成。アイキャッチ画像・フォント・公開可否なども指定できる。",

	limit: {
		duration: HOUR,
		max: 300,
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "Page",
	},

	errors: {
		noSuchFile: {
			message: "そのファイルは存在しません。",
			code: "NO_SUCH_FILE",
			id: "b7b97489-0f66-4b12-a5ff-b21bd63f6e1c",
		},
		nameAlreadyExists: {
			message: "ページ名が重複しています。",
			code: "NAME_ALREADY_EXISTS",
			id: "4650348e-301c-499a-83c9-6aa988c66bc1",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		title: {
			type: "string",
			description: "ページのタイトル。表示用。",
		},
		name: {
			type: "string",
			minLength: 1,
			description: "URL 用の一意な名前。例: my-page → /@user/my-page。",
		},
		summary: {
			type: "string",
			nullable: true,
			description: "ページの要約。一覧やプレビューに使われる。",
		},
		content: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: true,
			},
			description:
				"ブロック配列。各ブロックは type とそのブロック用のプロパティを持つ。",
		},
		variables: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: true,
			},
			description:
				"ページ内で使う変数定義の配列。script や content から参照する。",
		},
		script: {
			type: "string",
			maxLength: 65536,
			description: "ページの挙動を制御する AiScript コード。",
		},
		eyeCatchingImageId: {
			type: "string",
			format: "misskey:id",
			nullable: true,
			description: "アイキャッチ画像として表示するドライブファイルの ID。",
		},
		font: {
			type: "string",
			enum: ["serif", "sans-serif"],
			default: "sans-serif",
			description: "本文のフォント。serif または sans-serif。",
		},
		alignCenter: {
			type: "boolean",
			default: false,
			description: "本文を中央揃えにするか。",
		},
		isPublic: {
			type: "boolean",
			default: true,
			description: "true なら未認証でも閲覧可能。",
		},
	},
	required: ["title", "name", "content", "variables", "script"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let eyeCatchingImage = null;
	if (ps.eyeCatchingImageId != null) {
		eyeCatchingImage = await DriveFiles.findOneBy({
			id: ps.eyeCatchingImageId,
			userId: user.id,
		});

		if (eyeCatchingImage == null) {
			throw new ApiError(meta.errors.noSuchFile);
		}
	}

	await Pages.findBy({
		userId: user.id,
		name: ps.name,
	}).then((result) => {
		if (result.length > 0) {
			throw new ApiError(meta.errors.nameAlreadyExists);
		}
	});

	const page = await Pages.insert(
		new Page({
			id: genId(),
			createdAt: new Date(),
			updatedAt: new Date(),
			title: ps.title,
			name: ps.name,
			summary: ps.summary,
			content: ps.content,
			variables: ps.variables,
			script: ps.script,
			eyeCatchingImageId: eyeCatchingImage ? eyeCatchingImage.id : null,
			userId: user.id,
			visibility: "public",
			alignCenter: ps.alignCenter,
			font: ps.font,
			isPublic: ps.isPublic,
		}),
	).then((x) => Pages.findOneByOrFail(x.identifiers[0]));

	return await Pages.pack(page);
});
