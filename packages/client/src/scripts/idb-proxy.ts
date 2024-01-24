// FirefoxのプライベートモードなどではindexedDBが使用不可能なので、
// indexedDBが使えない環境ではlocalStorageを使う
import { get as iget, set as iset, del as idel } from "idb-keyval";

const fallbackName = (key: string) => `idbfallback::${key}`;

let idbAvailable = typeof window !== "undefined" ? !!(window.indexedDB && window.indexedDB.open) : true;

let initialization: Promise<void> = initialize();

async function initialize() {
	if (idbAvailable) {
		try {
			await iset("idb-test", "test");
		} catch (err) {
			console.error("idb error", err);
			console.error("indexedDB is unavailable. It will use localStorage.");
			idbAvailable = false;
		}
	} else {
		console.error("indexedDB is unavailable. It will use localStorage.");
	}
}

export async function get(key: string) {
	await initialization;
	if (idbAvailable) return iget(key);
	return JSON.parse(window.localStorage.getItem(fallbackName(key)));
}

export async function set(key: string, val: any) {
	await initialization;
	if (idbAvailable) return iset(key, val);
	// valが1.5MBを超える場合、フォールバックしない
	if (JSON.stringify(val).length > 3 * 512 * 1024) return;
	return window.localStorage.setItem(fallbackName(key), JSON.stringify(val));
}

export async function del(key: string) {
	await initialization;
	if (idbAvailable) return idel(key);
	return window.localStorage.removeItem(fallbackName(key));
}
