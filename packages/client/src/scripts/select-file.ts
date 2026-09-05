import { ref } from "vue";
import { DriveFile } from "calckey-js/built/entities";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { uploadFile, uploadFromUrl } from "@/scripts/upload";
import type { UploadFileOptions } from "@/scripts/upload";


/** ファイル選択がユーザ操作でキャンセルされたことを表すエラー。 */
export class FileSelectCanceledError extends Error {
	constructor(message = "File selection was canceled") {
		super(message);
		this.name = "FileSelectCanceledError";
	}
}

/**
 * キャンセルの発生箇所。
 *
 * - menu: 選択メニューを何も選ばずに閉じた
 * - picker: OS のファイル選択ダイアログを閉じた
 * - drive: ドライブ選択ダイアログを閉じた
 * - url: URL 入力ダイアログを閉じた
 */
type SelectCancelReason = "menu" | "picker" | "drive" | "url";

/** 選択処理の結果。キャンセルも「正常に終わった状態」として表現する。 */
type SelectOutcome =
	| { canceled: false; files: DriveFile | DriveFile[] }
	| { canceled: true; reason: SelectCancelReason };

/**
 * ファイル選択メニューを開き、選択・アップロードの結果を返す。
 *
 * @remarks
 * キャンセルされた場合も必ず settle する（reject ではなく canceled: true で解決する）。
 * 「選択処理が終わったかどうか」を追跡する呼び出し元が、未解決の Promise を
 * 抱え込まないようにするため。実際の失敗のみ reject する。
 *
 * @internal
 */
function select(
	src: any,
	label: string | null,
	multiple: boolean,
	requiredFilename?: boolean,
	keepFilename?: boolean,
	to?: string,
	options?: UploadFileOptions,
): Promise<SelectOutcome> {
	return new Promise((res, rej) => {
		const keepOriginal = ref(
			to === "emoji" ? true : defaultStore.state.keepOriginalUploading,
		);
		const keepFileName = ref(keepFilename ?? defaultStore.state.keepFileName);
		let doAction = false;
		let settled = false;

		/** 選択完了。多重解決は無視する。@internal */
		const done = (files: DriveFile | DriveFile[]) => {
			if (settled) return;
			settled = true;
			res({ canceled: false, files });
		};

		/** キャンセル終了。多重解決は無視する。@internal */
		const cancel = (reason: SelectCancelReason) => {
			if (settled) return;
			settled = true;
			res({ canceled: true, reason });
		};

		/** 失敗終了。多重解決は無視する。@internal */
		const fail = (err: unknown) => {
			if (settled) return;
			settled = true;
			rej(err);
		};

		const folderId =
			defaultStore.state.uploadFolderAvatar && to === "avatar"
				? defaultStore.state.uploadFolderAvatar
				: defaultStore.state.uploadFolderBanner && to === "banner"
				? defaultStore.state.uploadFolderBanner
				: defaultStore.state.uploadFolderEmoji && to === "emoji"
				? defaultStore.state.uploadFolderEmoji
				: defaultStore.state.uploadFolderWallpaper && to === "wallpaper"
				? defaultStore.state.uploadFolderWallpaper
				: defaultStore.state.uploadFolder;

		const chooseFileFromPc = () => {
			doAction = true;
			const input = document.createElement("input");
			input.type = "file";
			input.multiple = multiple;

			// https://qiita.com/fukasawah/items/b9dc732d95d99551013d
			// iOS Safari で正常に動かす為のおまじない
			const releaseInputRef = () => {
				(window as any).__misskey_input_ref__ = null;
			};

			input.onchange = () => {
				const selectedFiles = Array.from(input.files ?? []);
				releaseInputRef();

				// NOTE: cancel イベント非対応のブラウザでは、キャンセルが
				// 「ファイル 0 件の change」として届くことがある。
				if (selectedFiles.length === 0) {
					cancel("picker");
					return;
				}

				const promises = selectedFiles.map((file) =>
					uploadFile(
						file,
						folderId,
						undefined,
						keepOriginal.value,
						keepFileName.value,
						requiredFilename,
						options,
					),
				);

				Promise.all(promises)
					.then((driveFiles) => {
						done(multiple ? driveFiles : driveFiles[0]);
					})
					.catch((err) => {
						// エラー発生時にリジェクトする
						fail(err);
					});
			};

			// NOTE: OS のファイル選択ダイアログをキャンセルした場合、change は発火しない。
			// ここで拾わないと Promise が永久に未解決のまま残り、
			// 投稿フォームのアップロード待機が終わらなくなる。
			input.addEventListener("cancel", () => {
				releaseInputRef();
				cancel("picker");
			});

			(window as any).__misskey_input_ref__ = input;

			input.click();
		};

		const chooseFileFromDrive = () => {
			doAction = true;
			os.selectDriveFile(multiple, () => cancel("drive"))
				.then((files) => {
					done(files as DriveFile | DriveFile[]);
				})
				.catch((err) => {
					fail(err); // エラー発生時にリジェクト
				});
		};

		const chooseFileFromUrl = () => {
			doAction = true;
			os.inputText({
				title: i18n.ts.uploadFromUrl,
				type: "url",
				placeholder: i18n.ts.uploadFromUrlDescription,
			}).then(({ canceled, result: url }) => {
				if (canceled) {
					cancel("url");
					return;
				}

				// NOTE: 取得と登録の進捗はアップロードインジケータに出る。
				// 完了・失敗・タイムアウトの後始末は uploadFromUrl 側が行う。
				uploadFromUrl(url, { folderId })
					.then((file) => {
						done(multiple ? [file] : file);
					})
					.catch((err) => {
						fail(err); // エラー発生時にリジェクト
					});
			}).catch((err) => {
				fail(err); // エラー発生時にリジェクト
			});
		};

		os.popupMenu(
			[
				label
					? {
							text: label,
							type: "label",
					  }
					: undefined,
				{
					text: i18n.ts.upload,
					icon: "ph-upload-simple ph-bold ph-lg",
					action: chooseFileFromPc,
				},
				...(!requiredFilename
					? [
							{
								text: i18n.ts.fromDrive,
								icon: "ph-cloud ph-bold ph-lg",
								action: chooseFileFromDrive,
							},
					  ]
					: []),
				...(!requiredFilename
					? [
							{
								text: i18n.ts.fromUrl,
								icon: "ph-link-simple ph-bold ph-lg",
								action: chooseFileFromUrl,
							},
					  ]
					: []),
				{
					type: "switch",
					text: i18n.ts.keepOriginalUploading,
					ref: keepOriginal,
				},
				...(!requiredFilename
					? [
							{
								type: "switch",
								text: i18n.ts.keepFileName,
								ref: keepFileName,
							},
					  ]
					: []),
			],
			src,
		).then(() => {
			setTimeout(() => {
				if (!doAction) cancel("menu");
			}, 500);
		}).catch((err) => {
			fail(err); // エラー発生時にリジェクト
		});
	});
}

/**
 * 従来の呼び出し元向けに、キャンセル時の挙動を変えずに結果を取り出す。
 *
 * @remarks
 * 既存の呼び出し元は「メニューを閉じた場合のみ reject、それ以外のキャンセルでは
 * settle しない」前提で書かれている（`.catch` を持たないものが多い）。
 * ここを変えると未処理の rejection が各所で発生するため、従来どおりに揃える。
 * キャンセルを扱いたい新しい呼び出し元は selectFilesOrNull を使うこと。
 *
 * @internal
 */
function toLegacyResult<T>(outcome: Promise<SelectOutcome>): Promise<T> {
	return outcome.then((result) => {
		if (!result.canceled) return result.files as T;
		if (result.reason === "menu") throw new FileSelectCanceledError();
		// 従来どおり settle しない
		return new Promise<T>(() => {});
	});
}

export function selectFile(
	src: any,
	label: string | null = null,
	requiredFilename?: boolean,
	keepFilename?: boolean,
	to?: string,
	options?: UploadFileOptions,
): Promise<DriveFile> {
	return toLegacyResult<DriveFile>(
		select(src, label, false, requiredFilename, keepFilename, to, options),
	);
}

export function selectFiles(
	src: any,
	label: string | null = null,
	requiredFilename?: boolean,
	keepFilename?: boolean,
	to?: string,
	options?: UploadFileOptions,
): Promise<DriveFile[]> {
	return toLegacyResult<DriveFile[]>(
		select(src, label, true, requiredFilename, keepFilename, to, options),
	);
}

/**
 * selectFiles と同じだが、キャンセル時に null で解決する。
 *
 * @remarks
 * 選択処理の Promise を「アップロード待機」として追跡する呼び出し元（投稿フォーム）は、
 * キャンセルされたことを知る必要がある。selectFiles の従来挙動（settle しない）では
 * 待機が永久に終わらないため、こちらを使う。
 *
 * @returns 選択された DriveFile の配列。キャンセルされた場合は null
 */
export function selectFilesOrNull(
	src: any,
	label: string | null = null,
	requiredFilename?: boolean,
	keepFilename?: boolean,
	to?: string,
	options?: UploadFileOptions,
): Promise<DriveFile[] | null> {
	return select(
		src,
		label,
		true,
		requiredFilename,
		keepFilename,
		to,
		options,
	).then((result) => (result.canceled ? null : (result.files as DriveFile[])));
}
