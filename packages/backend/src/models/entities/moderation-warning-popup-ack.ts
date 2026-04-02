/**
 * @packageDocumentation
 *
 * モデレーション警告ポップアップの「最後に確認した時刻」を保持するスパース行（1ユーザ最大1行）。
 *
 * @remarks
 * - `user.moderationWarningPopupAt` 列から分離した。行が無いユーザは未ACK相当として扱う。
 * - 認証キャッシュでは `hydrateModerationWarningPopupAtForAuthUser`（`moderation-warning-ack.ts`）で `ILocalUser.moderationWarningPopupAt` に写像する。
 *
 * @internal
 */
import { Entity, PrimaryColumn, Column } from "typeorm";
import { id } from "../id.js";

/**
 * 警告ポップアップの最終確認（ACK）記録
 *
 * @remarks
 * PK が `userId` のみのため、UPSERT で更新する。
 *
 * @internal
 */
@Entity("moderation_warning_popup_ack")
export class ModerationWarningPopupAck {
	@PrimaryColumn(id())
	public userId: string;

	@Column("timestamp with time zone", {
		comment: "警告ポップアップを最後に確認したUTC基準の記録",
	})
	public acknowledgedAt: Date;
}
