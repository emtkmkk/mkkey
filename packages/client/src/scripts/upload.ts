import { reactive, ref } from "vue";
import { v4 as uuid } from "uuid";
import * as Misskey from "calckey-js";
import * as os from "@/os";
import { readAndCompressImage } from "@misskey-dev/browser-image-resizer";
import { defaultStore } from "@/store";
import { apiUrl } from "@/config";
import { applyMkkeyClientHeadersToXhr } from "@/scripts/mkkey-api-client-headers";
import { $i } from "@/account";
import { alert } from "@/os";
import { i18n } from "@/i18n";
import { stream } from "@/stream";

/**
 * アップロードの進行段階。
 *
 * - waiting: 読み込み・確認ダイアログなど、送信前の準備中
 * - compressing: 画像の圧縮・リサイズ中
 * - sending: リクエストボディを送信中（進捗率が出るのはここだけ）
 * - processing: 送信完了。サーバ側の処理（ハッシュ計算・サムネイル生成・保存）待ち
 */
export type UploadPhase = "waiting" | "compressing" | "sending" | "processing";

/**
 * processing 中にサーバが行っている処理。main ストリームの driveFileProgress で受け取る。
 * 詳細は backend の misc/drive-file-progress を参照。
 */
export type UploadServerStage =
	| "downloading"
	| "analyzing"
	| "detecting"
	| "generating"
	| "storing"
	| "saving";

export type Uploading = {
	id: string;
	name: string;
	progressMax: number | undefined;
	progressValue: number | undefined;
	/** サムネイル用の URL。手元にファイルが無い（URL からの取り込み等）場合は null。 */
	img: string | null;
	/** 現在の処理段階。 */
	phase: UploadPhase;
	/** processing に入った時刻（経過時間の表示用）。 */
	processingSince: number | null;
	/** サーバ側の処理段階。未受信なら null。 */
	stage: UploadServerStage | null;
	/** 段階内の進捗（0-100）。算出できない段階では null。 */
	stageProgress: number | null;
};

/**
 * サーバ側の処理段階をストリームで購読し、ctx に反映する。
 *
 * @remarks
 * ボディの送信が終わってからレスポンスが返るまでの間、クライアントからは進捗を
 * 取得できない。その区間で「今サーバが何をしているか」を見せるために使う。
 *
 * @param marker - drive/files/create に渡した識別子
 * @param ctx - 反映先
 * @returns 購読を解除する関数
 * @internal
 */
function watchServerProgress(marker: string, ctx: Uploading): () => void {
	// NOTE: main チャンネルは要認証。未ログイン時は何もしない。
	if ($i == null) return () => {};

	const connection = stream.useChannel("main");

	connection.on("driveFileProgress", (payload) => {
		if (payload.marker !== marker) return;
		// NOTE: サーバが動き始めている以上、送信は完了している。
		// upload.onload を取りこぼした場合もここで processing に倒す。
		ctx.phase = "processing";
		if (ctx.processingSince == null) ctx.processingSince = Date.now();
		ctx.stage = payload.stage;
		ctx.stageProgress = payload.progress ?? null;
	});

	return () => connection.dispose();
}

export const uploads = ref<Uploading[]>([]);

/** Cloudflare の 100 MB 制限より手前で分割アップロードへ切り替える。 */
const CHUNKED_UPLOAD_THRESHOLD = 90 * 1024 * 1024;

/** 分割アップロード開始 API の応答。 */
type ChunkedUploadSession = {
	uploadId: string;
	chunkSize: number;
	totalParts: number;
	expiresAt: string;
};

/** `os.api` の通知抑止引数を分割アップロードから使うための型。 */
type SilentApiCall = (
	endpoint: string,
	data: Record<string, unknown>,
	token?: string | null,
	suppressToast?: boolean,
) => Promise<unknown>;

/** 複数 API を使う処理でエラー通知を 1 回にまとめる。 */
const callApiWithoutToast = os.api as unknown as SilentApiCall;

/** 分割アップロードのパート送信失敗。 */
class ChunkedUploadPartError extends Error {
	/** HTTP ステータス。通信自体に失敗した場合は 0。 */
	public readonly status: number;

	/**
	 * パート送信失敗を生成する。
	 *
	 * @param status - HTTP ステータス
	 * @internal
	 */
	public constructor(status: number) {
		super(`Chunked upload part failed with status ${status}`);
		this.name = "ChunkedUploadPartError";
		this.status = status;
	}
}

/**
 * 分割経路の失敗理由を既存アップロードと同じ利用者向け文言へ変換する。
 *
 * @param error - API またはパート送信のエラー
 * @returns ダイアログに表示する文言
 * @internal
 */
function chunkedUploadErrorMessage(error: unknown): string {
	const apiError = error as {
		id?: string;
		info?: { reason?: string };
	};
	if (apiError.id === "bec5bd69-fba3-43c9-b4fb-2894b66ad5d2") {
		return i18n.ts.cannotUploadBecauseInappropriate;
	}
	if (apiError.id === "d08dbc37-a6a9-463a-8c47-96c32ab5f064") {
		return i18n.ts.cannotUploadBecauseNoFreeSpace;
	}
	if (
		apiError.info?.reason === "INVALID_FILE_SIZE" ||
		(error instanceof ChunkedUploadPartError && error.status === 413)
	) {
		return i18n.ts.cannotUploadBecauseExceedsFileSizeLimit;
	}
	return i18n.ts.chunkedUploadFailed;
}

/**
 * 1 パートを送信し、ファイル全体に対する進捗を反映する。
 *
 * @remarks
 * NOTE: 現行アップロードと挙動を揃えるため、自動再送は行わない。
 *
 * @param session - 分割アップロードセッション
 * @param file - 送信対象ファイル
 * @param fileName - パートの multipart ファイル名に使う名前
 * @param partNumber - 1 始まりのパート番号
 * @param ctx - 進捗の反映先
 * @returns パート受領時に解決する Promise
 * @internal
 */
function sendChunkedUploadPart(
	session: ChunkedUploadSession,
	file: Blob,
	fileName: string,
	partNumber: number,
	ctx: Uploading,
): Promise<void> {
	const offset = (partNumber - 1) * session.chunkSize;
	const end = Math.min(offset + session.chunkSize, file.size);
	const formData = new FormData();
	formData.append("uploadId", session.uploadId);
	formData.append("partNumber", String(partNumber));
	formData.append(
		"file",
		file.slice(offset, end),
		`${fileName}.part${partNumber}`,
	);

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${apiUrl}/drive/files/upload/part`, true);
		if ($i?.token) xhr.setRequestHeader("Authorization", `Bearer ${$i.token}`);
		applyMkkeyClientHeadersToXhr(xhr);
		xhr.onload = () => {
			if (xhr.status !== 200) {
				reject(new ChunkedUploadPartError(xhr.status));
				return;
			}
			ctx.progressValue = end;
			resolve();
		};
		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable) return;
			ctx.progressMax = file.size;
			ctx.progressValue = Math.min(offset + event.loaded, file.size);
		};
		xhr.onerror = () => reject(new ChunkedUploadPartError(0));
		xhr.onabort = () => reject(new ChunkedUploadPartError(0));
		xhr.send(formData);
	});
}

/**
 * 大きなファイルを直列に分割送信して DriveFile として確定する。
 *
 * @remarks
 * 途中で失敗した場合はセッションを破棄し、その場で終了する。自動再送と
 * ページ再読み込み後の再開は行わない。中止 API 自体に失敗した一時データは
 * サーバーの期限切れ削除へ任せる。
 *
 * @param file - 送信対象ファイル
 * @param folderId - 保存先フォルダ ID
 * @param name - Drive 上のファイル名
 * @param marker - サーバー側処理進捗との対応用 ID
 * @param force - 同一ハッシュの既存ファイルを再利用しないか
 * @param ctx - 進捗の反映先
 * @returns 作成された DriveFile
 * @internal
 */
async function uploadFileInChunks(
	file: Blob,
	folderId: string | null,
	name: string,
	marker: string,
	force: boolean,
	ctx: Uploading,
): Promise<Misskey.entities.DriveFile> {
	let uploadId: string | null = null;
	try {
		const session = (await callApiWithoutToast(
			"drive/files/upload/init",
			{
				name,
				size: file.size,
				folderId,
				force,
				marker,
			},
			undefined,
			true,
		)) as ChunkedUploadSession;
		uploadId = session.uploadId;
		ctx.phase = "sending";
		ctx.progressMax = file.size;
		ctx.progressValue = 0;

		for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
			await sendChunkedUploadPart(session, file, name, partNumber, ctx);
		}

		ctx.phase = "processing";
		ctx.processingSince = Date.now();
		return (await callApiWithoutToast(
			"drive/files/upload/complete",
			{ uploadId: session.uploadId },
			undefined,
			true,
		)) as Misskey.entities.DriveFile;
	} catch (error) {
		if (uploadId != null) {
			await callApiWithoutToast(
				"drive/files/upload/abort",
				{ uploadId },
				undefined,
				true,
			).catch(() => {});
		}
		alert({
			type: "error",
			title: i18n.ts.failedToUpload,
			text: chunkedUploadErrorMessage(error),
		});
		throw error;
	}
}

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

	const id = Math.random().toString();
	const ext = /\.\w+$/.exec(file.name) ?? "";

	// NOTE: 圧縮確認やファイル名入力を挟んでいる間も「アップロード進行中」として
	// 扱えるよう、XHR の開始時ではなくここで登録する。投稿フォームはこの件数を見て
	// 「待機中の Promise だけが残っている異常状態」を判定するため、通常の前処理中に
	// 空になっていると投稿が中止されてしまう。
	const ctx = reactive<Uploading>({
		id,
		name:
			name ||
			(keepFileName
				? file.name
				: `${$i?.username}-${id.replaceAll(".", "")}${ext}`),
		progressMax: undefined,
		progressValue: undefined,
		img: window.URL.createObjectURL(file),
		phase: "waiting",
		processingSince: null,
		stage: null,
		stageProgress: null,
	});

	uploads.value.push(ctx);

	// サーバ側の処理段階を受け取るための識別子。送信完了後の表示に使う。
	const marker = uuid();
	let disposeProgressWatch: (() => void) | null = null;

	return new Promise<Misskey.entities.DriveFile>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = async () => {
			try {
				if (
					!defaultStore.state.confirmImgCompress &&
					file.type in compressTypeMap
				) {
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
					ctx.name = inputName;
				}

				let resizedImage: Blob | undefined;
				if (!keepOriginal && file.type in compressTypeMap) {
					const imgConfig = compressTypeMap[file.type];

					const config = {
						maxWidth: 2048,
						maxHeight: 2048,
						debug: true,
						...imgConfig,
					};

					try {
						ctx.phase = "compressing";
						resizedImage = await readAndCompressImage(file, config);
						ctx.name =
							file.type !== imgConfig.mimeType
								? `${ctx.name.replace(/\.\w+$/, "")}.${
										mimeTypeMap[compressTypeMap[file.type].mimeType]
								  }`
								: ctx.name;
					} catch (err) {
						console.error("Failed to resize image", err);
					} finally {
						ctx.phase = "waiting";
					}
				}

				const uploadTarget = resizedImage || file;
				if (uploadTarget.size >= CHUNKED_UPLOAD_THRESHOLD) {
					disposeProgressWatch = watchServerProgress(marker, ctx);
					resolve(
						await uploadFileInChunks(
							uploadTarget,
							folder ?? null,
							ctx.name,
							marker,
							options?.force ?? false,
							ctx,
						),
					);
					return;
				}

				const formData = new FormData();
				if (options?.force) {
					formData.append("force", "true");
				}
				formData.append("marker", marker);
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
				};

				xhr.upload.onprogress = (ev) => {
					if (ev.lengthComputable) {
						ctx.progressMax = ev.total;
						ctx.progressValue = ev.loaded;
					}
				};

				// NOTE: ボディの送信完了。ここから先はサーバ側の処理待ちで、
				// クライアントからは進捗を取得できない（進捗率が止まって見える区間）。
				xhr.upload.onload = () => {
					ctx.phase = "processing";
					ctx.processingSince = Date.now();
				};

				xhr.onerror = () => {
					alert({
						type: "error",
						title: i18n.ts.failedToUpload,
						text: i18n.ts.networkErrorRetry,
					});
					reject(new Error("Network error"));
				};

				ctx.phase = "sending";
				disposeProgressWatch = watchServerProgress(marker, ctx);
				xhr.send(formData);
			} catch (error) {
				reject(error);
			}
		};
		reader.onerror = () => reject(new Error("File reading failed"));
		// NOTE: ファイル全体をメモリへ読む必要はない。FileReader による読取可否の
		// 既存チェックだけを残し、巨大動画でも先頭 1 byte のみに抑える。
		reader.readAsArrayBuffer(file.slice(0, 1));
	}).finally(() => {
		// NOTE: 中断・失敗を含めどの経路で終わっても、進行中一覧とストリーム購読を残さない。
		// ここが残ると投稿フォームが「アップロード進行中」と誤認し続ける。
		disposeProgressWatch?.();
		disposeProgressWatch = null;
		uploads.value = uploads.value.filter((x) => x.id !== id);
		if (ctx.img) window.URL.revokeObjectURL(ctx.img);
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
			phase: "sending",
			processingSince: null,
			stage: null,
			stageProgress: null,
		});

		uploads.value.push(ctx);

		// サーバ側の処理段階を受け取るための識別子。送信完了後の表示に使う。
		const marker = uuid();
		const disposeProgressWatch = watchServerProgress(marker, ctx);

		const finish = () => {
			disposeProgressWatch();
			uploads.value = uploads.value.filter((x) => x.id !== id);
			if (ctx.img) window.URL.revokeObjectURL(ctx.img);
		};

		const formData = new FormData();
		formData.append("file", blob, name);
		formData.append("name", name);
		formData.append("marker", marker);
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
		xhr.upload.onload = () => {
			// NOTE: 以降はサーバ側の処理待ち。uploadFile と同じ扱いにする。
			ctx.phase = "processing";
			ctx.processingSince = Date.now();
		};
		xhr.onerror = () => {
			finish();
			reject(new Error("Network error"));
		};
		xhr.send(formData);
	});
}

export type UploadFromUrlOptions = {
	folderId?: string | null;
	isSensitive?: boolean;
	comment?: string | null;
	force?: boolean;
	/** 進捗が途絶えてから失敗とみなすまでの時間（ミリ秒）。 */
	idleTimeoutMs?: number;
};

/** 進捗が途絶えてから諦めるまでの既定時間。 */
const URL_UPLOAD_IDLE_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * URL を渡してサーバ側にダウンロードさせ、ドライブに登録する。
 *
 * @remarks
 * この API は受け付けた時点で返り、実際の取得と登録は裏で走る。完了は main ストリームの
 * urlUploadFinished で、その間の処理段階は driveFileProgress で受け取る。
 * 進行中は他のアップロードと同じインジケータに出るので、
 * 投稿フォームのアップロード待機判定（進行中タスクの有無）とも整合する。
 *
 * 待ち時間の上限は「最後に進捗が届いてからの経過時間」で見る。
 * 大きなファイルでも進んでいる限り待ち、本当に音沙汰が無くなったときだけ諦める。
 *
 * @param url - 取得元の URL
 * @param options - 保存先フォルダやセンシティブフラグなど
 * @returns 作成された DriveFile
 */
export function uploadFromUrl(
	url: string,
	options: UploadFromUrlOptions = {},
): Promise<Misskey.entities.DriveFile> {
	const id = Math.random().toString();
	const marker = uuid();

	/** URL の末尾をファイル名として表示に使う。取れなければ URL をそのまま出す。 */
	const displayName = (() => {
		try {
			return decodeURIComponent(
				new URL(url).pathname.split("/").pop() || "",
			) || url;
		} catch {
			return url;
		}
	})();

	const ctx = reactive<Uploading>({
		id,
		name: displayName,
		progressMax: undefined,
		progressValue: undefined,
		// 手元のファイルを送るわけではないのでサムネイルは出せない
		img: null,
		// クライアントからは送信するものが無く、最初からサーバ側の処理待ち
		phase: "processing",
		processingSince: Date.now(),
		stage: null,
		stageProgress: null,
	});

	uploads.value.push(ctx);

	return new Promise<Misskey.entities.DriveFile>((resolve, reject) => {
		const connection = stream.useChannel("main");
		let idleTimer: number | null = null;
		let settled = false;

		const finish = () => {
			if (idleTimer != null) window.clearTimeout(idleTimer);
			idleTimer = null;
			connection.dispose();
			uploads.value = uploads.value.filter((x) => x.id !== id);
		};

		const succeed = (file: Misskey.entities.DriveFile) => {
			if (settled) return;
			settled = true;
			finish();
			resolve(file);
		};

		const fail = (err: unknown) => {
			if (settled) return;
			settled = true;
			finish();
			reject(err instanceof Error ? err : new Error(String(err)));
		};

		/** 進捗が届くたびに、諦めるまでの時計を延長する。 */
		const extendIdleTimeout = () => {
			if (settled) return;
			if (idleTimer != null) window.clearTimeout(idleTimer);
			idleTimer = window.setTimeout(() => {
				fail(new Error("URL からのアップロードがタイムアウトしました。"));
			}, options.idleTimeoutMs ?? URL_UPLOAD_IDLE_TIMEOUT_MS);
		};

		connection.on("driveFileProgress", (payload) => {
			if (payload.marker !== marker) return;
			ctx.stage = payload.stage;
			ctx.stageProgress = payload.progress ?? null;
			extendIdleTimeout();
		});

		connection.on("urlUploadFinished", (payload) => {
			if (payload.marker !== marker) return;
			// NOTE: サーバ側で取得・登録に失敗した場合は file が null で届く。
			if (!payload.file) {
				fail(new Error("URL からのアップロードに失敗しました。"));
				return;
			}
			succeed(payload.file);
		});

		extendIdleTimeout();

		os.api("drive/files/upload-from-url", {
			url,
			marker,
			folderId: options.folderId ?? undefined,
			isSensitive: options.isSensitive ?? false,
			comment: options.comment ?? undefined,
			force: options.force ?? false,
		}).catch(fail);
	});
}
