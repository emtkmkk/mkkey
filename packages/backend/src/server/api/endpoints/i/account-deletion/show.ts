/**
 * @packageDocumentation
 *
 * 自分のアカウント削除の予約の状態を返す API エンドポイント。
 *
 * @remarks
 * - **API パス**: `i/account-deletion/show`
 * - 予約中でも呼べる（server/api/call.ts の許可リスト）。予約中の専用画面と、削除の申請画面が使う。
 * - 日時はすべて ISO 文字列。画面は日本時間で表示する。
 *
 * @see {@link services/account-deletion-schedule} 予約の状態
 * @internal
 */
import define from "../../../define.js";
import { getAccountDeletionState } from "@/services/account-deletion-schedule.js";

export const meta = {
	requireCredential: true,

	secure: true,

	description:
		"自分のアカウント削除の予約の状態を返す。予約していれば削除の予定日時、取り消したばかりなら再び予約できる日時、今予約したら削除される日時を含む。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			scheduledAt: { type: "string", optional: false, nullable: true, format: "date-time" },
			requestedAt: { type: "string", optional: false, nullable: true, format: "date-time" },
			reRequestableAt: { type: "string", optional: false, nullable: true, format: "date-time" },
			scheduledAtIfRequestedNow: {
				type: "string",
				optional: false,
				nullable: false,
				format: "date-time",
			},
			reRequestableAtIfCanceledNow: {
				type: "string",
				optional: false,
				nullable: true,
				format: "date-time",
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const state = await getAccountDeletionState(user.id);
	return {
		scheduledAt: state.scheduledAt?.toISOString() ?? null,
		requestedAt: state.requestedAt?.toISOString() ?? null,
		reRequestableAt: state.reRequestableAt?.toISOString() ?? null,
		scheduledAtIfRequestedNow: state.scheduledAtIfRequestedNow.toISOString(),
		reRequestableAtIfCanceledNow:
			state.reRequestableAtIfCanceledNow?.toISOString() ?? null,
	};
});
