/**
 * @packageDocumentation
 *
 * 案内メールの配信停止（ログイン不要）。
 *
 * @remarks
 * - メール本文の配信停止リンク（SPA 経由の JSON POST）と、RFC 8058 の
 *   ワンクリック配信停止（メールプロバイダからの form-urlencoded POST）の両方を受ける。
 * - トークンは `user_profile.emailUnsubscribeToken`（ユーザー単位で固定・恒久有効）。
 * - `kind` で停止対象を切り替える:
 *   - `summary`: 未読通知サマリーメールのみ（`receiveUnreadSummaryEmail` を false に）
 *   - それ以外（未指定含む）: お知らせメール全般（`receiveAnnouncementEmail` を false に）
 * - 再開はログイン後の設定画面から。
 *
 * @internal
 */
import type Koa from "koa";
import { UserProfiles } from "@/models/index.js";

/** body 優先・query フォールバックで文字列パラメータを取り出す */
function readParam(ctx: Koa.Context, name: string): string | null {
	const bodyValue = (ctx.request.body as Record<string, unknown> | undefined)?.[
		name
	];
	if (typeof bodyValue === "string" && bodyValue !== "") return bodyValue;

	const queryValue = ctx.query[name];
	if (typeof queryValue === "string" && queryValue !== "") return queryValue;

	return null;
}

export default async (ctx: Koa.Context) => {
	const token = readParam(ctx, "token");
	const kind = readParam(ctx, "kind");

	if (token == null) {
		ctx.throw(400, "token required");
		return;
	}

	const profile = await UserProfiles.findOneBy({
		emailUnsubscribeToken: token,
	});

	if (profile == null) {
		ctx.throw(404);
		return;
	}

	await UserProfiles.update(
		{ userId: profile.userId },
		kind === "summary"
			? { receiveUnreadSummaryEmail: false }
			: { receiveAnnouncementEmail: false },
	);

	ctx.status = 204;
};
