import { ref } from "vue";
import { DriveFile } from "calckey-js/built/entities";
import * as os from "@/os";
import { stream } from "@/stream";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { uploadFile } from "@/scripts/upload";

function select(
	src: any,
	label: string | null,
	multiple: boolean,
	requiredFilename?: boolean,
	keepFilename?: boolean,
): Promise<DriveFile | DriveFile[]> {
	return new Promise((res, rej) => {
		const keepOriginal = ref(defaultStore.state.keepOriginalUploading);
		const keepFileName = ref(keepFilename ?? defaultStore.state.keepFileName);
		let doAction = false;

		const chooseFileFromPc = () => {
			doAction = true;
			const input = document.createElement("input");
			input.type = "file";
			input.multiple = multiple;
			input.onchange = () => {
				const promises = Array.from(input.files).map((file) =>
					uploadFile(
						file,
						defaultStore.state.uploadFolder,
						undefined,
						keepOriginal.value,
						keepFileName.value,
						requiredFilename,
					),
				);

				Promise.all(promises)
					.then((driveFiles) => {
						res(multiple ? driveFiles : driveFiles[0]);
					})
					.catch((err) => {
						// アップロードのエラーは uploadFile 内でハンドリングされているためアラートダイアログを出したりはしてはいけない
					});

				// 一応廃棄
				(window as any).__misskey_input_ref__ = null;
			};

			// https://qiita.com/fukasawah/items/b9dc732d95d99551013d
			// iOS Safari で正常に動かす為のおまじない
			(window as any).__misskey_input_ref__ = input;

			input.click();
		};

		const chooseFileFromDrive = () => {
			doAction = true;
			os.selectDriveFile(multiple).then((files) => {
				res(files);
			});
		};

		const chooseFileFromUrl = () => {
			doAction = true;
			os.inputText({
				title: i18n.ts.uploadFromUrl,
				type: "url",
				placeholder: i18n.ts.uploadFromUrlDescription,
			}).then(({ canceled, result: url }) => {
				if (canceled) return;

				const marker = Math.random().toString(); // TODO: UUIDとか使う

				const connection = stream.useChannel("main");
				connection.on("urlUploadFinished", (urlResponse) => {
					if (urlResponse.marker === marker) {
						res(multiple ? [urlResponse.file] : urlResponse.file);
						connection.dispose();
					}
				});

				os.api("drive/files/upload-from-url", {
					url: url,
					folderId: defaultStore.state.uploadFolder,
					marker,
				});

				os.alert({
					title: i18n.ts.uploadFromUrlRequested,
					text: i18n.ts.uploadFromUrlMayTakeTime,
				});
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
				...(!requiredFilename ? [{
					text: i18n.ts.fromDrive,
					icon: "ph-cloud ph-bold ph-lg",
					action: chooseFileFromDrive,
				}] : []),
				{
					text: i18n.ts.fromUrl,
					icon: "ph-link-simple ph-bold ph-lg",
					action: chooseFileFromUrl,
				},
				{
					type: "switch",
					text: i18n.ts.keepOriginalUploading,
					ref: keepOriginal,
				},
				{
					type: "switch",
					text: i18n.ts.keepFileName,
					ref: keepFileName,
				},
			],
			src,
		).then(() => {
			setTimeout(() => {
				if (!doAction) rej();
				}, 500
			);
		});
	});
}

export function selectFile(
	src: any,
	label: string | null = null,
	requiredFilename?: boolean,
	keepFilename?: boolean,
): Promise<DriveFile> {
	return select(src, label, false, requiredFilename, keepFilename) as Promise<DriveFile>;
}

export function selectFiles(
	src: any,
	label: string | null = null,
	requiredFilename?: boolean,
	keepFilename?: boolean,
): Promise<DriveFile[]> {
	return select(src, label, true, requiredFilename, keepFilename) as Promise<DriveFile[]>;
}
