/**
 * @packageDocumentation
 *
 * `/i` の `needsModerationWarningPopup` が true のとき、7 秒待機後に OK のみで閉じる警告ダイアログを表示する。
 *
 * @remarks
 * OK 確定時のみ `i/ack-moderation-warning` を呼ぶ。背景・Esc では閉じない（MkDialog の強制確認モード）。
 *
 * @internal
 */
import * as os from "@/os";
import { i18n } from "@/i18n";
import MkDialog from "@/components/MkDialog.vue";
import type * as misskey from "calckey-js";

export function showModerationWarningDialogIfNeeded(
	account: misskey.entities.MeDetailed,
	token: string,
): Promise<void> {
	if (!account.needsModerationWarningPopup) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		os.popup(
			MkDialog,
			{
				type: "warning",
				title: i18n.ts.moderationWarningDialogTitle,
				text: i18n.ts.moderationWarningDialogText,
				showCancelButton: false,
				wait: 7,
			},
			{
				done: (ev: { canceled: boolean }) => {
					if (!ev.canceled) {
						void os
							.api("i/ack-moderation-warning", {}, token)
							.catch(() => {});
					}
					resolve();
				},
			},
			"closed",
		);
	});
}
