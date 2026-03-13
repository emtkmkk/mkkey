/**
 * @packageDocumentation
 *
 * アプリ（OAuth クライアント）を作成する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `app/create`（POST `/api/app/create` で呼び出し）
 * - 認証不要。name と callbackUrl 等を指定して新規アプリを登録し、App オブジェクトを返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { Apps } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { unique } from "@/prelude/array.js";
import { secureRndstr } from "@/misc/secure-rndstr.js";

export const meta = {
	tags: ["app"],

	requireCredential: false,

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
		name: { type: "string" },
		description: { type: "string" },
		permission: {
			type: "array",
			uniqueItems: true,
			items: {
				type: "string",
			},
		},
		callbackUrl: { type: "string", nullable: true },
	},
	required: ["name", "description", "permission"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	if (user?.movedToUri != null)
		return await Apps.pack("", null, {
			detail: true,
			includeSecret: true,
		});
	// シークレットを生成する
	const secret = secureRndstr(32, true);

	// for backward compatibility
	const permission = unique(
		ps.permission.map((v) => v.replace(/^(.+)(\/|-)(read|write)$/, "$3:$1")),
	);

	// アカウントを作成する
	const app = await Apps.insert({
		id: genId(),
		createdAt: new Date(),
		userId: user ? user.id : null,
		name: ps.name,
		description: ps.description,
		permission,
		callbackUrl: ps.callbackUrl,
		secret: secret,
	}).then((x) => Apps.findOneByOrFail(x.identifiers[0]));

	return await Apps.pack(app, null, {
		detail: true,
		includeSecret: true,
	});
});
