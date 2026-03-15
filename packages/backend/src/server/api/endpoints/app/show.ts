/**
 * @packageDocumentation
 *
 * アプリの詳細を 1 件取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `app/show`（GET `/api/app/show` で呼び出し）
 * - 認証不要。appId で指定したアプリを返す。存在しない場合は noSuchApp エラー。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { Apps } from "@/models/index.js";

export const meta = {
	tags: ["app"],

	description:
		"指定した ID のアプリ（OAuth クライアント）の詳細を取得する。名前・説明・権限・コールバック URL などを返す。",

	errors: {
		noSuchApp: {
			message: "そのappは存在しません。",
			code: "NO_SUCH_APP",
			id: "dce83913-2dc6-4093-8a7b-71dbb11718a3",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "App",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		appId: { type: "string", format: "misskey:id" },
	},
	required: ["appId"],
} as const;

export default define(meta, paramDef, async (ps, user, token) => {
	const isSecure = user != null && token == null;

	// アプリを検索する
	const ap = await Apps.findOneBy({ id: ps.appId });

	if (ap == null) {
		throw new ApiError(meta.errors.noSuchApp);
	}

	return await Apps.pack(ap, user, {
		detail: true,
		includeSecret: isSecure && ap.userId === user!.id,
	});
});
