import { reactive, ref } from "vue";
import * as Misskey from "calckey-js";
import * as os from "@/os";
import { readAndCompressImage } from "@misskey-dev/browser-image-resizer";
import { defaultStore } from "@/store";
import { apiUrl } from "@/config";
import { applyMkkeyClientHeadersToXhr } from "@/scripts/mkkey-api-client-headers";
import { $i } from "@/account";
import { alert } from "@/os";
import { i18n } from "@/i18n";

type Uploading = {
	id: string;
	name: string;
	progressMax: number | undefined;
	progressValue: number | undefined;
	img: string;
};

export const uploads = ref<Uploading[]>([]);

const compressTypeMap = {
	"image/jpeg": { quality: 0.85, mimeType: "image/jpeg" },
	"image/webp": { quality: 0.85, mimeType: "image/png" },
	"image/svg+xml": { quality: 1, mimeType: "image/png" },
} as const;

const mimeTypeMap = {
	"image/webp": "webp",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/avif": "avif",
} as const;

export type UploadFileOptions = {
        force?: boolean;
};

export function uploadFile(
        file: File,
        folder?: any,
        name?: string,
        keepOriginal: boolean = defaultStore.state.keepOriginalUploading,
        keepFileName: boolean = defaultStore.state.keepFileName,
        requiredFilename: boolean = false,
        options?: UploadFileOptions,
): Promise<Misskey.entities.DriveFile> {
	if (folder && typeof folder === "object") folder = folder.id;

	return new Promise((resolve, reject) => {
		const id = Math.random().toString();

		const reader = new FileReader();
		reader.onload = async (ev) => {
			try {
				if (!defaultStore.state.confirmImgCompress && file.type in compressTypeMap) {
					const { canceled } = await os.yesno({
						type: "question",
						text: i18n.ts.compressImageConfirm,
					});
					defaultStore.set("keepOriginalUploading", canceled);
					keepOriginal = canceled;
					defaultStore.set("confirmImgCompress", true);
				}
				const { canceled } =
					file.type === "video/quicktime"
						? await os.yesno({
								type: "question",
								text: i18n.ts.movFormatWarning,
						  })
						: { canceled: false };

				if (canceled) {
					reject(new Error("Upload canceled by user"));
					return;
				}

				const ext = /\.\w+$/.exec(file.name) ?? "";

				let inputName: string | undefined;

				if (requiredFilename || defaultStore.state.alwaysInputFilename) {
					const { canceled, result: input } = await os.inputText({
						title: i18n.ts.filenameInput,
						text: ext?.[0] || ".???",
						placeholder:
							(name || file.name.replace(/\.\w+$/, "")) + ext,
						default: name || file.name.replace(/\.\w+$/, ""),
					});
					if (!input || canceled) {
						reject(new Error("Filename input canceled or invalid"));
						return;
					}
					inputName = input
						.toLowerCase()
						.replace(/\.\w+$/, "")
						.replaceAll(/[\\\/:\*\?\"<>\|]+/g, "")
						.trim();
					if (!inputName) {
						reject(new Error("Invalid filename"));
						return;
					}
					inputName = inputName + ext;
				}

				const ctx = reactive<Uploading>({
					id: id,
					name:
						inputName ||
						name ||
						(keepFileName ? file.name : `${$i?.username}-${id.replaceAll(".", "")}${ext}`),
					progressMax: undefined,
					progressValue: undefined,
					img: window.URL.createObjectURL(file),
				});

				uploads.value.push(ctx);

				let resizedImage: File | undefined;
				if (!keepOriginal && file.type in compressTypeMap) {
					const imgConfig = compressTypeMap[file.type];

					const config = {
						maxWidth: 2048,
						maxHeight: 2048,
						debug: true,
						...imgConfig,
					};

					try {
						resizedImage = await readAndCompressImage(file, config);
						ctx.name =
							file.type !== imgConfig.mimeType
								? `${ctx.name.replace(/\.\w+$/, "")}.${
										mimeTypeMap[compressTypeMap[file.type].mimeType]
								  }`
								: ctx.name;
					} catch (err) {
						console.error("Failed to resize image", err);
					}
				}

                                const formData = new FormData();
                                if (options?.force) {
                                        formData.append("force", "true");
                                }
				formData.append("file", resizedImage || file);
				formData.append("name", ctx.name);
				if (folder) formData.append("folderId", folder);

				const xhr = new XMLHttpRequest();
				xhr.open("POST", `${apiUrl}/drive/files/create`, true);
				xhr.setRequestHeader("Authorization", `Bearer ${$i.token}`);
				applyMkkeyClientHeadersToXhr(xhr);
				xhr.onload = (ev) => {
					if (
						xhr.status !== 200 ||
						ev.target == null ||
						ev.target.response == null
					) {
						uploads.value = uploads.value.filter((x) => x.id !== id);

						if (xhr.status === 413) {
							alert({
								type: "error",
								title: i18n.ts.failedToUpload,
								text: i18n.ts.cannotUploadBecauseExceedsFileSizeLimit,
							});
						} else if (ev.target?.response) {
							const res = JSON.parse(ev.target.response);
							if (res.error?.id === "bec5bd69-fba3-43c9-b4fb-2894b66ad5d2") {
								alert({
									type: "error",
									title: i18n.ts.failedToUpload,
									text: i18n.ts.cannotUploadBecauseInappropriate,
								});
							} else if (
								res.error?.id === "d08dbc37-a6a9-463a-8c47-96c32ab5f064"
							) {
								alert({
									type: "error",
									title: i18n.ts.failedToUpload,
									text: i18n.ts.cannotUploadBecauseNoFreeSpace,
								});
							} else {
								alert({
									type: "error",
									title: i18n.ts.failedToUpload,
									text: `${res.error?.message}\n${res.error?.code}\n${res.error?.id}`,
								});
							}
						} else {
							alert({
								type: "error",
								title: i18n.ts.failedToUploadTitle,
								text: `${JSON.stringify(ev.target?.response)}, ${JSON.stringify(
									xhr.response,
								)}`,
							});
						}

						reject(new Error("Failed to upload"));
						return;
					}

					const driveFile = JSON.parse(ev.target.response);

					resolve(driveFile);

					uploads.value = uploads.value.filter((x) => x.id !== id);
				};

				xhr.upload.onprogress = (ev) => {
					if (ev.lengthComputable) {
						ctx.progressMax = ev.total;
						ctx.progressValue = ev.loaded;
					}
				};

				xhr.onerror = () => {
						uploads.value = uploads.value.filter((x) => x.id !== id);
					alert({
						type: "error",
						title: i18n.ts.failedToUpload,
						text: i18n.ts.networkErrorRetry,
					});
					reject(new Error("Network error"));
				};

				xhr.send(formData);
			} catch (error) {
				reject(error);
			}
		};
		reader.onerror = () => reject(new Error("File reading failed"));
		reader.readAsArrayBuffer(file);
	});
}

export type UploadBlobOptions = {
	folderId?: string | null;
	isSensitive?: boolean;
	comment?: string | null;
	force?: boolean;
};

/**
 * 加工済みの Blob をそのまま Drive にアップロードする。
 *
 * uploadFile と異なり、圧縮確認やファイル名入力などのダイアログを挟まない。
 * クロップ結果のように「すでに内容もファイル名も確定しているデータ」を送る用途で使う。
 * 進行状況は uploads に登録するため、共通のアップロードインジケータに表示され、
 * 投稿フォームのアップロード待機判定（進行中タスクの有無）とも整合する。
 *
 * @param blob - アップロードする内容
 * @param name - Drive 上のファイル名
 * @param options - 保存先フォルダやセンシティブフラグなど
 * @returns 作成された DriveFile
 */
export function uploadBlob(
	blob: Blob,
	name: string,
	options: UploadBlobOptions = {},
): Promise<Misskey.entities.DriveFile> {
	return new Promise((resolve, reject) => {
		const id = Math.random().toString();

		const ctx = reactive<Uploading>({
			id,
			name,
			progressMax: undefined,
			progressValue: undefined,
			img: window.URL.createObjectURL(blob),
		});

		uploads.value.push(ctx);

		const finish = () => {
			uploads.value = uploads.value.filter((x) => x.id !== id);
			window.URL.revokeObjectURL(ctx.img);
		};

		const formData = new FormData();
		formData.append("file", blob, name);
		formData.append("name", name);
		if (options.force) formData.append("force", "true");
		if (options.folderId) formData.append("folderId", options.folderId);
		if (options.isSensitive != null) {
			formData.append("isSensitive", options.isSensitive ? "true" : "false");
		}
		if (options.comment) formData.append("comment", options.comment);

		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${apiUrl}/drive/files/create`, true);
		xhr.setRequestHeader("Authorization", `Bearer ${$i.token}`);
		applyMkkeyClientHeadersToXhr(xhr);
		xhr.onload = (ev) => {
			finish();
			if (
				xhr.status !== 200 ||
				ev.target == null ||
				ev.target.response == null
			) {
				reject(new Error("Failed to upload"));
				return;
			}
			try {
				resolve(JSON.parse(ev.target.response));
			} catch (err) {
				reject(err);
			}
		};
		xhr.upload.onprogress = (ev) => {
			if (ev.lengthComputable) {
				ctx.progressMax = ev.total;
				ctx.progressValue = ev.loaded;
			}
		};
		xhr.onerror = () => {
			finish();
			reject(new Error("Network error"));
		};
		xhr.send(formData);
	});
}
