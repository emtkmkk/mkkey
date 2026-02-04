/*
 * Language manager for SW
 */
declare var self: ServiceWorkerGlobalScope;

import { get, set } from "idb-keyval";
import { I18n } from "@/scripts/i18n";
import { FETCH_TIMEOUT_MS } from "@/const";

class SwLang {
	public cacheName = `mk-cache-${_VERSION_}`;

	public lang: Promise<string> = get("lang").then(async (prelang) => {
		if (!prelang) return "en-US";
		return prelang;
	});

	public setLang(newLang: string) {
		this.lang = Promise.resolve(newLang);
		set("lang", newLang);
		return this.fetchLocale();
	}

	public i18n: Promise<I18n<any>> | null = null;

	public fetchLocale() {
		return (this.i18n = this._fetch());
	}

	private async _fetch() {
		// Service Workerは何度も起動しそのたびにlocaleを読み込むので、CacheStorageを使う
		const localeUrl = `/assets/locales/${await this.lang}.${_VERSION_}.json`;
		let localeRes = await caches.match(localeUrl);

		// _DEV_がtrueの場合は常に最新化
		if (!localeRes || _DEV_) {
			const controller = new AbortController();
			const timeout = self.setTimeout(() => {
				controller.abort("locale-fetch-timeout");
			}, FETCH_TIMEOUT_MS);

			try {
				localeRes = await fetch(localeUrl, { signal: controller.signal });
				const clone = localeRes?.clone();
				if (!clone?.clone().ok) Error("locale fetching error");

				caches.open(this.cacheName).then((cache) => cache.put(localeUrl, clone));
			} finally {
				self.clearTimeout(timeout);
			}
		}

		return new I18n(await localeRes.json());
	}
}

export const swLang = new SwLang();
