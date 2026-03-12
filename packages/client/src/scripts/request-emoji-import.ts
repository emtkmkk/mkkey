/**
 * @packageDocumentation
 *
 * リモート絵文字のインポート申請フローを共通化したモジュール。
 * same-name-emojis → 複数ホストなら MkEmojiImportSourcePicker → remaining-count → 確認 → create。
 *
 * @remarks
 * reaction-menu・MkCustomEmojiDetailed・deck-remote-emojis の3箇所から利用する。
 */

import { defineAsyncComponent } from "vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

/**
 * リモート絵文字のインポート申請の通常フローを実行する。
 *
 * @param emojiName - 申請対象の絵文字名（: は含めない）
 * @param emojiHost - 申請対象のホスト（クリックした絵文字のホスト。複数ある場合はピッカーで選択）
 * @returns 申請完了時は resolve、キャンセルまたはエラー時は reject せずに return
 *
 * @public
 */
export async function requestEmojiImportFlow(
	emojiName: string,
	emojiHost: string,
): Promise<void> {
	try {
		const sameNameRes = await os.api(
			"emoji-import-request/same-name-emojis",
			{ emojiName },
		);
		let emojis = sameNameRes.emojis ?? [];
		if (emojis.length === 0) {
			os.toast(
				i18n.ts.emojiImportDenied ?? "その絵文字は申請できません。",
			);
			return;
		}
		emojis = [...emojis].sort((a, b) => {
			if (a.host === emojiHost) return -1;
			if (b.host === emojiHost) return 1;
			return 0;
		});
		let targetHost = emojiHost;
		if (emojis.length > 1) {
			const sel = await new Promise<
				| { canceled: true; result: undefined }
				| { canceled: false; result: string }
			>((resolve) => {
				let resolved = false;
				let disposeFn: (() => void) | null = null;
				os.popup(
					defineAsyncComponent(
						() =>
							import("@/components/MkEmojiImportSourcePicker.vue"),
					),
					{
						emojiName,
						emojis,
						currentHost: emojiHost,
					},
					{
						done: (host: string) => {
							if (!resolved) {
								resolved = true;
								disposeFn?.();
								resolve({ canceled: false, result: host });
							}
						},
						closed: () => {
							if (!resolved) {
								resolved = true;
								resolve({ canceled: true, result: undefined });
							}
							disposeFn?.();
						},
					},
				).then((r) => {
					disposeFn = r.dispose;
				});
			});
			if (sel.canceled || sel.result == null) return;
			targetHost = sel.result;
		} else {
			targetHost = emojis[0].host;
		}
		const { remaining } = await os.api(
			"emoji-import-request/remaining-count",
			{},
		);
		const confirmText = (
			i18n.ts.emojiImportRequestConfirm ??
			'":name:" をインポート申請します。よろしいですか？（今日残り:n:回）'
		)
			.replace(":name:", `${emojiName}@${targetHost}`)
			.replace(":n:", String(remaining));
		const { canceled } = await os.confirm({
			type: "question",
			title: i18n.ts.requestEmojiImport ?? "インポート申請",
			text: confirmText,
			okText: i18n.ts.yes ?? "はい",
			cancelText: i18n.ts.no ?? "いいえ",
		});
		if (canceled) return;
		await os.api("emoji-import-request/create", {
			emojiName,
			emojiHost: targetHost,
		});
		os.success();
	} catch (err: unknown) {
		const msg =
			(err as { message?: string })?.message ||
			(err as { code?: string })?.code ||
			(i18n.ts.error ?? "エラーが発生しました");
		os.toast(msg);
	}
}
