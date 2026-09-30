/**
 * @packageDocumentation
 *
 * 絵文字の追加申請 API（`emoji-add-request/*`）で共通に使うエラーの定義。
 *
 * @remarks
 * 同じエラーを複数の API で返すので、id がずれないようにここにまとめる。
 * 各 API の `meta.errors` に必要なものだけを取り出して入れる。
 *
 * @internal
 */
import { ApiError } from "../error.js";
import type { EmojiAddRequestFieldProblem } from "@/services/emoji-add-request.js";

export const emojiAddRequestErrors = {
	noSuchRequest: {
		message: "その申請は存在しません。",
		code: "NO_SUCH_REQUEST",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e01",
	},
	invalidStatus: {
		message: "今の状態では、その操作はできません。",
		code: "INVALID_STATUS",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e02",
	},
	noSuchFile: {
		message: "画像が見つかりません。",
		code: "NO_SUCH_FILE",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e03",
	},
	notImage: {
		message: "画像ファイルを選んでください。",
		code: "NOT_IMAGE",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e04",
	},
	copyFailed: {
		message: "画像の保存に失敗しました。時間をおいてもう一度試してください。",
		code: "COPY_FAILED",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e05",
	},
	invalidName: {
		message: "絵文字名には小文字の a-z・0-9・_ だけが使えます。",
		code: "INVALID_NAME",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e06",
	},
	motifRequired: {
		message: "この絵文字があなた自身がモチーフかどうかを選んでください。",
		code: "MOTIF_REQUIRED",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e07",
	},
	usageInfoRequired: {
		message: "「条件付きでコピー可」のときは、使用情報を入力してください。",
		code: "USAGE_INFO_REQUIRED",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e08",
	},
	duplicateEmojiName: {
		message: "同じ名前の絵文字が既にあります。名前を変えてから承認してください。",
		code: "DUPLICATE_EMOJI_NAME",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e09",
	},
	noChanges: {
		message: "直した項目がありません。",
		code: "NO_CHANGES",
		id: "4f3b1c2e-8d8a-4a5c-9f2e-6a1d0c7b5e0a",
	},
} as const;

/**
 * 入力の検査で見つかった問題を、API のエラーにして投げる。
 *
 * @param problem - {@link findEmojiAddRequestProblem} の結果
 * @throws {@link ApiError} problem が null でないとき
 * @internal
 */
export function throwIfEmojiAddRequestProblem(
	problem: EmojiAddRequestFieldProblem | null,
): void {
	if (problem == null) return;
	throw new ApiError(emojiAddRequestErrors[problem]);
}
