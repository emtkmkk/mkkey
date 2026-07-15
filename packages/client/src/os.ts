// TODO: なんでもかんでもos.tsに突っ込むのやめたいのでよしなに分割する

import { Component, markRaw, Ref, ref, defineAsyncComponent } from "vue";
import { EventEmitter } from "eventemitter3";
import insertTextAtCursor from "insert-text-at-cursor";
import * as Misskey from "calckey-js";
import { apiUrl, url } from "@/config";
import MkPostFormDialog from "@/components/MkPostFormDialog.vue";
import MkWaitingDialog from "@/components/MkWaitingDialog.vue";
import MkToast from "@/components/MkToast.vue";
import MkDialog from "@/components/MkDialog.vue";
import { MenuItem } from "@/types/menu";
import { $i } from "@/account";
import { mergeMkkeyApiClientHeaders } from "@/scripts/mkkey-api-client-headers";
import { get, set } from "@/scripts/idb-proxy";
import { v4 as uuid } from "uuid";
import { defaultStore } from "./store";

export const pendingApiRequestsCount = ref(0);

/**
 * `notes/create` の payload に冪等キーを必ず設定する。
 *
 * @remarks
 * NOTE: 既存の呼び出し側が明示的に `idempotencyKey` を設定している場合は、その値を尊重する。
 * NOTE: `intentKey` を指定した場合は、同一意図の再送で同じキーを使い続けるためにその値を優先する。
 * @param data - `notes/create` に渡すリクエスト payload
 * @param intentKey - ユーザーの 1 回の投稿意思に紐づく固定キー
 * @returns 冪等キーが設定された payload
 * @public
 */
export function ensureNotesCreateIdempotencyKey(
	data: Record<string, any>,
	intentKey?: string,
): Record<string, any> {
	if (typeof data.idempotencyKey === "string" && data.idempotencyKey.trim().length > 0) {
		return data;
	}

	if (typeof intentKey === "string" && intentKey.trim().length > 0) {
		return {
			...data,
			idempotencyKey: intentKey,
		};
	}

	return {
		...data,
		idempotencyKey: uuid(),
	};
}

function buildNotesCreateQueueSignature(data: Record<string, any>): string {
	const payload = { ...data };
	delete payload.idempotencyKey;
	return JSON.stringify(payload);
}

const apiClient = new Misskey.api.APIClient({
	origin: url,
});

export const api = ((
	endpoint: string,
	data: Record<string, any> = {},
	token?: string | null | undefined,
	suppressToast = false,
) => {
	if (endpoint === "notes/create") {
		data = ensureNotesCreateIdempotencyKey(data);
	}

	if ($i?.isMiniSilenced && endpoint === "notes/create") {
		data.web = true;
	}

	pendingApiRequestsCount.value++;

	const onFinally = () => {
		pendingApiRequestsCount.value--;
	};

	const authorizationToken = token ?? $i?.token ?? undefined;
	const authorization = authorizationToken
		? `Bearer ${authorizationToken}`
		: undefined;
	const idempotencyKey =
		endpoint === "notes/create" && typeof data.idempotencyKey === "string"
			? data.idempotencyKey
			: undefined;
	const baseHeaders: Record<string, string> = {};
	if (authorization) {
		baseHeaders.authorization = authorization;
	}
	if (idempotencyKey) {
		baseHeaders["Idempotency-Key"] = idempotencyKey;
	}
	const headers = mergeMkkeyApiClientHeaders(baseHeaders);

	const promise = new Promise((resolve, reject) => {
		fetch(endpoint.indexOf("://") > -1 ? endpoint : `${apiUrl}/${endpoint}`, {
			method: "POST",
			body: JSON.stringify(data),
			credentials: "omit",
			cache: "no-cache",
			headers,
		})
			.then(async (res) => {
				const body = res.status === 204 ? null : await res.json();

				if (res.status === 200) {
					resolve(body);
				} else if (res.status === 204) {
					resolve();
				} else {
					if (!suppressToast) {
						errortoast(res, body, endpoint, data);
					}
					reject(body.error);
				}
			})
			.catch(reject);
	});

	promise.then(onFinally, onFinally);

	return promise;
}) as typeof apiClient.request;

export const apiGet = ((
	endpoint: string,
	data: Record<string, any> = {},
	token?: string | null | undefined,
	suppressToast = false,
) => {
	pendingApiRequestsCount.value++;

	const onFinally = () => {
		pendingApiRequestsCount.value--;
	};

	const query = new URLSearchParams(data);

	const authorizationToken = token ?? $i?.token ?? undefined;
	const authorization = authorizationToken
		? `Bearer ${authorizationToken}`
		: undefined;

	const promise = new Promise((resolve, reject) => {
		// Send request
		fetch(`${apiUrl}/${endpoint}?${query}`, {
			method: "GET",
			credentials: "omit",
			cache: "default",
			headers: mergeMkkeyApiClientHeaders(
				authorization ? { authorization } : {},
			),
		})
			.then(async (res) => {
				const body = res.status === 204 ? null : await res.json();

				if (res.status === 200) {
					resolve(body);
				} else if (res.status === 204) {
					resolve();
				} else {
					if (!suppressToast) {
						errortoast(res, body, endpoint, data);
					}
					reject(body.error);
				}
			})
			.catch(reject);
	});

	promise.then(onFinally, onFinally);

	return promise;
}) as typeof apiClient.request;

export const apiWithDialog = ((
	endpoint: string,
	data: Record<string, any> = {},
	token?: string | null | undefined,
) => {
	const promise = api(endpoint, data, token, true);
	promiseDialog(promise, null, (err) => {
		alert({
			type: "error",
			text: `${err.message}\n${(err as any).id}`,
		});
	});

	return promise;
}) as typeof api;



export type apiData = {
	id?: string;
	date?: Date;
	endpoint: string;
	data?: Record<string, any>;
	token?: string | null | undefined;
	suppressToast?: boolean;
	comment?: string;
	draftData?: any;
}

export const queueDatas = ref<apiData[]>([]);

export const addQueue = (data: apiData) => {
	const id = uuid();
	const date = new Date();
	const addData = { id, date, ...data };
	queueDatas.value.push(addData);
	defaultStore.set("queueDatas", queueDatas.value);
	return addData;
};

export const removeQueue = (id: string) => {
  queueDatas.value = queueDatas.value.filter((x) => x.id !== id);
  defaultStore.set("queueDatas", queueDatas.value);
}

export const queueApi = (
	endpoint: string,
	data: Record<string, any> = {},
	token?: string | null | undefined,
	suppressToast = false,
	comment?: string | undefined,
	draftData?: any,
): Promise<any> => {
  if (endpoint === "notes/create") {
		data = ensureNotesCreateIdempotencyKey(data);
	}

  if (endpoint === "notes/create") {
		try {
			const currentSignature = buildNotesCreateQueueSignature(data);
			const isDuplicate = queueDatas.value.some(item =>
				item.endpoint === "notes/create" &&
				buildNotesCreateQueueSignature(item.data ?? {}) === currentSignature
			);
			if (isDuplicate) {
				toast("重複した投稿が検出されました。リクエストはキャンセルされました。");
				return Promise.reject(new Error("重複した投稿が検出されました。")); // 重複時にPromiseを拒否
			}
		} catch (e) {
			console.log(e);
		}
  }

  const addData = addQueue({ endpoint, data, token, suppressToast, comment, draftData });

  const onFinally = () => {
    removeQueue(addData.id);
  };

  return api(endpoint, data, token, suppressToast).finally(onFinally);
};

export function promiseDialog<T extends Promise<any>>(
	promise: T,
	onSuccess?: ((res: any) => void) | null,
	onFailure?: ((err: Error) => void) | null,
	text?: string,
): T {
	const showing = ref(true);
	const success = ref(false);

	promise
		.then((res) => {
			if (onSuccess) {
				showing.value = false;
				onSuccess(res);
			} else {
				success.value = true;
				window.setTimeout(() => {
					showing.value = false;
				}, 1000);
			}
		})
		.catch((err) => {
			showing.value = false;
			if (onFailure) {
				onFailure(err);
			} else {
				alert({
					type: "error",
					text: err,
				});
			}
		});

	// NOTE: dynamic importすると挙動がおかしくなる(showingの変更が伝播しない)
	popup(
		MkWaitingDialog,
		{
			success: success,
			showing: showing,
			text: text,
		},
		{},
		"closed",
	);

	return promise;
}

let popupIdCount = 0;
export const popups = ref([]) as Ref<
	{
		id: any;
		component: any;
		props: Record<string, any>;
	}[]
>;

const zIndexes = {
	low: 1000000,
	middle: 2000000,
	high: 3000000,
};
export function claimZIndex(
	priority: "low" | "middle" | "high" = "low",
): number {
	zIndexes[priority] += 100;
	return zIndexes[priority];
}

export async function popup(
	component: Component,
	props: Record<string, any>,
	events = {},
	disposeEvent?: string,
) {
	markRaw(component);

	const id = ++popupIdCount;
	const dispose = () => {
		// このsetTimeoutが無いと挙動がおかしくなる(autocompleteが閉じなくなる)。Vueのバグ？
		window.setTimeout(() => {
			popups.value = popups.value.filter((popup) => popup.id !== id);
		}, 0);
	};
	const state = {
		component,
		props,
		events: disposeEvent
			? {
					...events,
					[disposeEvent]: dispose,
			  }
			: events,
		id,
	};

	popups.value.push(state);

	return {
		dispose,
	};
}

export function pageWindow(path: string) {
	popup(
		defineAsyncComponent(() => import("@/components/MkPageWindow.vue")),
		{
			initialPath: path,
		},
		{},
		"closed",
	);
}

export function modalPageWindow(path: string) {
	popup(
		defineAsyncComponent(() => import("@/components/MkModalPageWindow.vue")),
		{
			initialPath: path,
		},
		{},
		"closed",
	);
}

export function toast(message: string) {
	if (!message) return;
	popup(
		MkToast,
		{
			message,
		},
		{},
		"closed",
	);
}

export function alert(props: {
	type?: "error" | "info" | "success" | "warning" | "waiting" | "question";
	title?: string | null;
	text?: string | null;
}): Promise<void> {
	return new Promise((resolve, reject) => {
		popup(
			MkDialog,
			props,
			{
				done: (result) => {
					resolve();
				},
			},
			"closed",
		);
	});
}

export function confirm(props: {
	type: "error" | "info" | "success" | "warning" | "waiting" | "question";
	title?: string | null;
	text?: string | null;
	okText?: string;
	cancelText?: string;
	showThirdButton?: boolean;
	thirdText?: string
	wait?: number;
}): Promise<{ canceled: true } | { canceled: false, result: any }> {
	return new Promise((resolve, reject) => {
		popup(
			MkDialog,
			{
				...props,
				showCancelButton: true,
			},
			{
				done: (result) => {
					resolve(result ? result : { canceled: true });
				},
			},
			"closed",
		);
	});
}

export function yesno(props: {
	type: "error" | "info" | "success" | "warning" | "waiting" | "question";
	title?: string | null;
	text?: string | null;
}): Promise<{ canceled: boolean }> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				...props,
				showCancelButton: true,
				isYesNo: true,
			},
			{
				done: (result) => {
					resolve(result ? result : { canceled: true });
				},
			},
			"closed",
		);
	});
}

export function inputText(props: {
	type?: "text" | "email" | "password" | "url";
	title?: string | null;
	text?: string | null;
	placeholder?: string | null;
	default?: string | null;
}): Promise<
	| { canceled: true; result: undefined }
	| {
			canceled: false;
			result: string;
	  }
> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				title: props.title,
				text: props.text,
				input: {
					type: props.type,
					placeholder: props.placeholder,
					default: props.default,
				},
			},
			{
				done: (result) => {
					resolve(result ? result : { canceled: true });
				},
			},
			"closed",
		);
	});
}

export function inputParagraph(props: {
	title?: string | null;
	text?: string | null;
	placeholder?: string | null;
	default?: string | null;
}): Promise<
	| { canceled: true; result: undefined }
	| {
			canceled: false;
			result: string;
	  }
> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				title: props.title,
				text: props.text,
				input: {
					type: "paragraph",
					placeholder: props.placeholder,
					default: props.default,
				},
			},
			{
				done: (result) => {
					resolve(result ? result : { canceled: true });
				},
			},
			"closed",
		);
	});
}

export function inputNumber(props: {
	title?: string | null;
	text?: string | null;
	placeholder?: string | null;
	default?: number | null;
}): Promise<
	| { canceled: true; result: undefined }
	| {
			canceled: false;
			result: number;
	  }
> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				title: props.title,
				text: props.text,
				input: {
					type: "number",
					placeholder: props.placeholder,
					default: props.default,
				},
			},
			{
				done: (result) => {
					resolve(result ? result : { canceled: true });
				},
			},
			"closed",
		);
	});
}

export function inputDate(props: {
	title?: string | null;
	text?: string | null;
	placeholder?: string | null;
	default?: Date | null;
}): Promise<
	| { canceled: true; result: undefined }
	| {
			canceled: false;
			result: Date;
	  }
> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				title: props.title,
				text: props.text,
				input: {
					type: "date",
					placeholder: props.placeholder,
					default: props.default?.toISOString().substr(0, 16),
				},
			},
			{
				done: (result) => {
					resolve(
						result
							? { result: new Date(result.result), canceled: result.canceled }
							: { canceled: true },
					);
				},
			},
			"closed",
		);
	});
}

export function inputDateTime(props: {
	title?: string | null;
	text?: string | null;
	placeholder?: string | null;
	default?: Date | null;
}): Promise<
	| { canceled: true; result: undefined }
	| {
			canceled: false;
			result: Date;
	  }
> {
	const _default = props.default;
	if (_default) {
		_default.setMinutes(_default.getMinutes() - _default.getTimezoneOffset());
	}
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				title: props.title,
				text: props.text,
				input: {
					type: "datetime-local",
					placeholder: props.placeholder,
					default: _default?.toISOString()?.substr(0, 16),
				},
			},
			{
				done: (result) => {
					resolve(
						result
							? { result: new Date(result.result), canceled: result.canceled }
							: { canceled: true },
					);
				},
			},
			"closed",
		);
	});
}

export function select<C = any>(
	props: {
		title?: string | null;
		text?: string | null;
		default?: string | null;
	} & (
		| {
				items: {
					value: C;
					text: string;
				}[];
		  }
		| {
				groupedItems: {
					label: string;
					items: {
						value: C;
						text: string;
					}[];
				}[];
		  }
	),
): Promise<
	| { canceled: true; result: undefined }
	| {
			canceled: false;
			result: C;
	  }
> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkDialog.vue")),
			{
				title: props.title,
				text: props.text,
				select: {
					items: props.items,
					groupedItems: props.groupedItems,
					default: props.default,
				},
			},
			{
				done: (result) => {
					resolve(result ? result : { canceled: true });
				},
			},
			"closed",
		);
	});
}

export function success() {
	return new Promise((resolve, reject) => {
		const showing = ref(true);
		window.setTimeout(() => {
			showing.value = false;
		}, 1000);
		popup(
			defineAsyncComponent(() => import("@/components/MkWaitingDialog.vue")),
			{
				success: true,
				showing: showing,
			},
			{
				done: () => resolve(),
			},
			"closed",
		);
	});
}

/**
 * 待機中スピナーダイアログを表示する。
 *
 * @remarks
 * NOTE: 戻り値には `close()` を生やしており、成功時のページ遷移/リロード以外の経路
 * （エラー時など）でも呼び出し側から明示的にダイアログを閉じられるようにしている。
 * `close()` を呼ばない場合、このダイアログはユーザー操作では閉じられない。
 *
 * @returns `done` イベントで解決する Promise に `close()` を生やしたもの
 * @public
 */
export function waiting(): Promise<void> & { close: () => void } {
	const showing = ref(true);
	const promise = new Promise<void>((resolve) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkWaitingDialog.vue")),
			{
				success: false,
				showing: showing,
			},
			{
				done: () => resolve(),
			},
			"closed",
		);
	});
	return Object.assign(promise, {
		close: () => {
			showing.value = false;
		},
	});
}

export function form(title, form) {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkFormDialog.vue")),
			{ title, form },
			{
				done: (result) => {
					resolve(result);
				},
			},
			"closed",
		);
	});
}

export async function selectUser(options?: {
	localOnly?: boolean;
	includeSelf?: boolean;
}) {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkUserSelectDialog.vue")),
			{
				localOnly: options?.localOnly ?? false,
				includeSelf: options?.includeSelf ?? false,
			},
			{
				ok: (user) => {
					resolve(user);
				},
			},
			"closed",
		);
	});
}

export async function selectInstance(): Promise<Misskey.entities.Instance> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(
				() => import("@/components/MkInstanceSelectDialog.vue"),
			),
			{},
			{
				ok: (instance) => {
					resolve(instance);
				},
			},
			"closed",
		);
	});
}

export async function selectDriveFile(multiple: boolean) {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(
				() => import("@/components/MkDriveSelectDialog.vue"),
			),
			{
				type: "file",
				multiple,
			},
			{
				done: (files) => {
					if (files) {
						resolve(multiple ? files : files[0]);
					}
				},
			},
			"closed",
		);
	});
}

export async function selectDriveFolder(multiple: boolean) {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(
				() => import("@/components/MkDriveSelectDialog.vue"),
			),
			{
				type: "folder",
				multiple,
			},
			{
				done: (folders) => {
					if (folders) {
						resolve(multiple ? folders : folders[0]);
					}
				},
			},
			"closed",
		);
	});
}

export async function pickEmoji(src: HTMLElement | null, opts) {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(
				() => import("@/components/MkEmojiPickerDialog.vue"),
			),
			{
				src,
				...opts,
			},
			{
				done: (emoji) => {
					resolve(emoji);
				},
			},
			"closed",
		);
	});
}

/**
 * 画像をクロップするダイアログを開き、OK でクロップ済み DriveFile を返す。
 * @param image - クロップ対象の Drive ファイル
 * @param options.aspectRatio - 0 で自由比、正の数で固定比
 * @param options.uploadFolder - クロップ画像の保存先フォルダ ID（省略時は MkCropperDialog の既定）
 */
export async function cropImage(
	image: Misskey.entities.DriveFile,
	options: {
		aspectRatio: number;
		to?: string;
		uploadFolder?: string | null;
	},
): Promise<Misskey.entities.DriveFile> {
	return new Promise((resolve, reject) => {
		popup(
			defineAsyncComponent(() => import("@/components/MkCropperDialog.vue")),
			{
				file: image,
				aspectRatio: options.aspectRatio,
				to: options.to,
				uploadFolder: options.uploadFolder ?? undefined,
			},
			{
				ok: (x) => {
					resolve(x);
				},
			},
			"closed",
		);
	});
}

type AwaitType<T> = T extends Promise<infer U>
	? U
	: T extends (...args: any[]) => Promise<infer V>
	? V
	: T;
let openingEmojiPicker: AwaitType<ReturnType<typeof popup>> | null = null;
let activeTextarea: HTMLTextAreaElement | HTMLInputElement | null = null;
export async function openEmojiPicker(
	src?: HTMLElement,
	opts,
	initialTextarea: typeof activeTextarea,
) {
	if (openingEmojiPicker) return;

	activeTextarea = initialTextarea;

	const textareas = document.querySelectorAll("textarea, input");
	for (const textarea of Array.from(textareas)) {
		textarea.addEventListener("focus", () => {
			activeTextarea = textarea;
		});
	}

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of Array.from(record.addedNodes).filter(
				(node) => node instanceof HTMLElement,
			) as HTMLElement[]) {
				const textareas = node.querySelectorAll("textarea, input");
				for (const textarea of Array.from(textareas).filter(
					(textarea) => textarea.dataset.preventEmojiInsert == null,
				)) {
					if (document.activeElement === textarea) activeTextarea = textarea;
					textarea.addEventListener("focus", () => {
						activeTextarea = textarea;
					});
				}
			}
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: false,
		characterData: false,
	});

	openingEmojiPicker = await popup(
		defineAsyncComponent(() => import("@/components/MkEmojiPickerDialog.vue")),
		{
			src,
			...opts,
		},
		{
			chosen: (emoji) => {
				insertTextAtCursor(activeTextarea, emoji);
			},
			done: (emoji) => {
				insertTextAtCursor(activeTextarea, emoji);
			},
			closed: () => {
				openingEmojiPicker!.dispose();
				openingEmojiPicker = null;
				observer.disconnect();
			},
		},
	);
}

export function popupMenu(
	items: MenuItem[] | Ref<MenuItem[]>,
	src?: HTMLElement,
	options?: {
		align?: string;
		width?: number;
		viaKeyboard?: boolean;
	},
) {
	return new Promise((resolve, reject) => {
		let dispose;
		popup(
			defineAsyncComponent(() => import("@/components/MkPopupMenu.vue")),
			{
				items,
				src,
				width: options?.width,
				align: options?.align,
				viaKeyboard: options?.viaKeyboard,
			},
			{
				closed: () => {
					resolve();
					dispose();
				},
			},
		).then((res) => {
			dispose = res.dispose;
		});
	});
}

export function contextMenu(
	items: MenuItem[] | Ref<MenuItem[]>,
	ev: MouseEvent,
) {
	ev.preventDefault();
	return new Promise((resolve, reject) => {
		let dispose;
		popup(
			defineAsyncComponent(() => import("@/components/MkContextMenu.vue")),
			{
				items,
				ev,
			},
			{
				closed: () => {
					resolve();
					dispose();
				},
			},
		).then((res) => {
			dispose = res.dispose;
		});
	});
}

export function post(props: Record<string, any> = {}) {
	return new Promise((resolve, reject) => {
		// NOTE: MkPostFormDialogをdynamic importするとiOSでテキストエリアに自動フォーカスできない
		// NOTE: ただ、dynamic importしない場合、MkPostFormDialogインスタンスが使いまわされ、
		//       Vueが渡されたコンポーネントに内部的に__propsというプロパティを生やす影響で、
		//       複数のpost formを開いたときに場合によってはエラーになる
		//       もちろん複数のpost formを開けること自体Misskeyサイドのバグなのだが
		let dispose;
		popup(MkPostFormDialog, props, {
			closed: () => {
				resolve();
				dispose();
			},
		})
			.then((res) => {
				dispose = res.dispose;
			})
			.catch(async (error) => {
				const postFormError = error instanceof Error ? error : new Error(String(error));
				await appendErrorLog(
					`PostFormDisplayError: ${JSON.stringify({
						message: postFormError.message,
						stack: postFormError.stack,
						props,
					})}`,
				);
				reject(error);
			});
	});
}

export const deckGlobalEvents = new EventEmitter();

async function appendErrorLog(message: string) {
	const currentDate = new Date();
	const formattedDate = `${currentDate.toLocaleDateString()} ${currentDate.toLocaleTimeString()}`;
	let currentLogs = (await get("errorLog")) || [];
	currentLogs.push(`${formattedDate} - ${message}`);

	if (currentLogs.length > 50) {
		currentLogs = currentLogs.slice(-50);
	}

	await set("errorLog", currentLogs);
}

async function errortoast(res, body, endpoint, parameter) {
	const message =
		body.error.code === "INTERNAL_ERROR"
		? body.error.info?.code === "QueryFailedError" && body.error.info?.message.includes("timeout")
			? "DBから応答が返ってきませんでした。サーバー負荷が高い状態の可能性があります。"
			: body.error.info?.message || body.error.message
		: body.error.message;

	if ($i) {
		toast(`${[res.status, message].join(" ")}`);
	}

	// エラーログのテキストを生成
	const logtext = `ApiError: ${
		res.status
	} - ${JSON.stringify({
		...body,
		endpoint: endpoint ? endpoint : undefined,
		parameter: Object.keys(parameter).length ? parameter : undefined,
	})}`;

	await appendErrorLog(logtext);
}

/*
export function checkExistence(fileData: ArrayBuffer): Promise<any> {
	return new Promise((resolve, reject) => {
		const data = new FormData();
		data.append('md5', getMD5(fileData));

		os.api('drive/files/find-by-hash', {
			md5: getMD5(fileData)
		}).then(resp => {
			resolve(resp.length > 0 ? resp[0] : null);
		});
	});
}*/
