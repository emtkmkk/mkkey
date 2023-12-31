import { reactive, ref } from "vue";
import * as Misskey from "calckey-js";
import * as os from "@/os";
import { readAndCompressImage } from "browser-image-resizer";
import { defaultStore } from "@/store";
import { apiUrl } from "@/config";
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

export function uploadFile(
	file: File,
	folder?: any,
	name?: string,
	keepOriginal: boolean = defaultStore.state.keepOriginalUploading,
	keepFileName: boolean = defaultStore.state.keepFileName,
	requiredFilename: boolean = false,
): Promise<Misskey.entities.DriveFile> {
	if (folder && typeof folder === "object") folder = folder.id;

	return new Promise((resolve, reject) => {
		const id = Math.random().toString();

		const reader = new FileReader();
		reader.onload = async (ev) => {

			const { canceled } = file.type === "video/quicktime" ? await os.yesno({
				type: "question",
				text: "このファイルはmov形式の為、iOS端末以外で正しく再生されない可能性があります。\nアプリ「VideoConvert」を使用するか、LINEでアップロード後に再度保存するなどでmp4形式に変換する事をオススメします。\nアップロードを続けますか？",
			}) : { canceled: false };

			if (canceled) {
				reject();
				return;
			}
			
			const ext = /\.\w+$/.exec(file.name) ?? undefined;
			
			let inputName = undefined;
			
			if (requiredFilename || defaultStore.state.alwaysInputFilename) {
				const { canceled, result: input } = await os.inputText({
					title: i18n.ts.filenameInput,
					text: ext ?? ".???",
					placeholder: (name || (file.name ? file.name.replace(/\.\w+$/,"") : "")) + (ext ?? ".???"),
					default: name || (file.name ? file.name.replace(/\.\w+$/,"") : ""),
				});
				if (!input || canceled) {
					reject();
					return;
				}
				inputName = input;
				inputName = inputName.toLowerCase().replace(/\.\w+$/,"").replaceAll(/[\\\/:\*\?\"<>\|]+/g,"").trim();
				if (!inputName) {
					reject();
					return;
				}
				inputName = inputName + ext;
			}
			
			const ctx = reactive<Uploading>({
				id: id,
				name: inputName || name || (keepFileName ? file.name : undefined) || `${$i.username}-${id.replaceAll(".","")}${ext?.[0] ?? ""}`,
				progressMax: undefined,
				progressValue: undefined,
				img: window.URL.createObjectURL(file),
			});

			uploads.value.push(ctx);

			let resizedImage: any;
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
							? `${ctx.name.replace(/\.\w+$/,"")}.${mimeTypeMap[compressTypeMap[file.type].mimeType]
							}`
							: ctx.name;
				} catch (err) {
					console.error("Failed to resize image", err);
				}
			}

			const formData = new FormData();
			formData.append("force", "true");
			formData.append("file", resizedImage || file);
			formData.append("name", ctx.name);
			if (folder) formData.append("folderId", folder);

			const xhr = new XMLHttpRequest();
			xhr.open("POST", `${apiUrl}/drive/files/create`, true);
			xhr.setRequestHeader("Authorization", `Bearer ${$i.token}`);
			xhr.onload = (ev) => {
				if (
					xhr.status !== 200 ||
					ev.target == null ||
					ev.target.response == null
				) {
					// TODO: 消すのではなくて(ネットワーク的なエラーなら)再送できるようにしたい
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
							title: "Failed to upload",
							text: `${JSON.stringify(ev.target?.response)}, ${JSON.stringify(
								xhr.response,
							)}`,
						});
					}

					reject();
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

			xhr.send(formData);
		};
		reader.readAsArrayBuffer(file);
	});
}
