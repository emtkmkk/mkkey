/**
 * BOOT LOADER
 * サーバーからレスポンスされるHTMLに埋め込まれるスクリプトで、以下の役割を持ちます。
 * - 言語（lang）を検出して localStorage に保存する（翻訳の取得はクライアント init で行う）。
 * - バージョンに基づいて適切なメインスクリプトを読み込む。
 * - キャッシュされたコンパイル済みテーマを適用する。
 * - クライアントの設定値に基づいて対応するHTMLクラス等を設定する。
 * テーマをこの段階で設定するのは、メインスクリプトが読み込まれる間もテーマを適用したいためです。
 * 注: webpackは介さないため、このファイルではrequireやimportは使えません。
 */

"use strict";

// ブロックの中に入れないと、定義した変数がブラウザのグローバルスコープに登録されてしまい邪魔なので
(async () => {
	window.onerror = (e) => {
		console.error(e);
		renderError("SOMETHING_HAPPENED", e);
	};
	window.onunhandledrejection = (e) => {
		console.error(e);
		renderError("SOMETHING_HAPPENED_IN_PROMISE", e);
	};

	//#region Sleep Mode
	if (
		localStorage.getItem("sleepTime") &&
		new Date(localStorage.getItem("sleepTime")) > new Date()
	) {
		const count = parseInt(localStorage.getItem("openCount") ?? "0") + 1;
		localStorage.setItem("openCount", count);
		document.addEventListener('DOMContentLoaded', () => {
		renderSleep(
			"SLEEPING",
			`残り ${Math.ceil(
				(new Date(localStorage.getItem("sleepTime")) - new Date()) /
					(60 * 1000),
			)} 分`,
			count,
		);
		return;
		})}
	//#endregion

	//#region Detect language（翻訳の取得はクライアント init の ensureLocaleAndApply で行う）
	const supportedLangs = LANGS;
	let lang = localStorage.getItem("lang");
	if (lang == null || !supportedLangs.includes(lang)) {
		if (supportedLangs.includes(navigator.language)) {
			lang = navigator.language;
		} else {
			lang = supportedLangs.find((x) => x.split("-")[0] === navigator.language);

			// Fallback
			if (lang == null) lang = "ja-JP";
		}
	}
	localStorage.setItem("lang", lang);
	//#endregion

	//#region Script
	// NOTE: base.pug から注入される VERSION を基準に比較し、未定義参照を避ける。
	const currentVersion =
		typeof VERSION === "string" && VERSION.length > 0
			? VERSION
			: localStorage.getItem("v") || "";
	const importTarget = `/assets/${CLIENT_ENTRY}`;
	const forcedRefreshMarkerKey = "__mk_boot_forced_refresh__";
	const bootRetryQueryKey = "bootRetry";
	const currentUrl = new URL(location.href);
	const bootRetryToken = currentUrl.searchParams.get(bootRetryQueryKey);
	let lastEntryProbe = null;

	function importAppScript() {
		import(importTarget).then(() => {
			cleanupBootRetryQuery();
		}).catch(async (e) => {
			let didRecover = await checkUpdate(e);
			if (!didRecover) {
				didRecover = await primeImportTargetAndRetry(e);
			}
			if (didRecover) return;
			console.error(e);
			renderError("APP_IMPORT", {
				cause: e,
				...buildAppImportContext(),
			});
		});
	}

	// head 内の link(stylesheet) がブラウザに処理されてからクライアントを読み込む。
	// 即時 import すると Vite の CSS プリロードと競合し "Unable to preload CSS" が出ることがあるため、
	// DOMContentLoaded を待つか、既に完了している場合は 1 tick 遅延してから読み込む。
	function scheduleImportAppScript() {
		if (document.readyState === "loading") {
			window.addEventListener("DOMContentLoaded", () => importAppScript());
		} else {
			Promise.resolve().then(() => importAppScript());
		}
	}
	scheduleImportAppScript();
	//#endregion

	//#region Theme
	const theme = localStorage.getItem("theme");
	if (theme) {
		for (const [k, v] of Object.entries(JSON.parse(theme))) {
			document.documentElement.style.setProperty(`--${k}`, v.toString());

			// HTMLの theme-color 適用
			if (k === "htmlThemeColor") {
				for (const tag of document.head.children) {
					if (
						tag.tagName === "META" &&
						tag.getAttribute("name") === "theme-color"
					) {
						tag.setAttribute("content", v);
						break;
					}
				}
			}
		}
	}
	const colorSchema = localStorage.getItem("colorSchema");
	if (colorSchema) {
		document.documentElement.style.setProperty("color-scheme", colorSchema);
	}
	//#endregion

	const fontSize = localStorage.getItem("fontSize");
	if (fontSize) {
		document.documentElement.classList.add(`f-${fontSize}`);
	}

	const avatarSize = localStorage.getItem("avatarSize");
	if (avatarSize) {
		document.documentElement.classList.add(`av-${avatarSize}`);
	}

	const useSystemFont = localStorage.getItem("useSystemFont");
	if (useSystemFont) {
		document.documentElement.classList.add("useSystemFont");
	}

	const wallpaper = localStorage.getItem("wallpaper");
	let wallpapers = localStorage.getItem("wallpapers");
	if (wallpaper && !wallpapers) {
		wallpapers = JSON.stringify([wallpaper]);
		localStorage.setItem("wallpapers", wallpapers);
		localStorage.removeItem("wallpaper");
	}
	if (wallpapers) {
		const parseWps = JSON.parse(wallpapers);
		document.documentElement.style.backgroundImage = `url(${
			parseWps[Math.floor(Math.random() * parseWps.length)]
		})`;
	}

	const customCss = localStorage.getItem("customCss");
	const cssSnippetsRaw = localStorage.getItem("miux:cssSnippets");
	let cssSnippetsInjected = false;

	if (cssSnippetsRaw) {
		try {
			const snippets = JSON.parse(cssSnippetsRaw);
			if (Array.isArray(snippets)) {
				for (const snippet of snippets) {
					if (snippet?.active && snippet?.css?.length > 0) {
						const style = document.createElement("style");
						style.setAttribute("data-mk-css-snippet", snippet.id);
						style.textContent = snippet.css;
						document.head.appendChild(style);
						cssSnippetsInjected = true;
					}
				}
			}
		} catch {
			// パース失敗時はレガシー fallback へ
		}
	}

	if (!cssSnippetsInjected && customCss && customCss.length > 0) {
		const style = document.createElement("style");
		style.setAttribute("data-mk-css-snippet-legacy", "");
		style.textContent = customCss;
		document.head.appendChild(style);
	}

	async function addStyle(styleText) {
		let css = document.createElement("style");
		css.appendChild(document.createTextNode(styleText));
		document.head.appendChild(css);
	}

	/** HTML をエスケープして詳細表示時の XSS を防ぐ */
	function escapeHtml(str) {
		if (str == null) return "";
		const s = String(str);
		return s
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	/**
	 * ErrorEvent / PromiseRejectionEvent / Error から表示用の詳細オブジェクトを組み立てる。
	 * JSON.stringify では Error の message/stack が取れないため、ここで明示的に抽出する。
	 */
	function getErrorDetailObject(code, details) {
		const out = { errorCode: code };
		if (details == null) {
			out.note = "詳細なし";
			return out;
		}
		if (details instanceof Error) {
			out.message = details.message;
			out.name = details.name;
			if (details.stack) out.stack = details.stack;
			return out;
		}
		// ErrorEvent (window.onerror)
		if (typeof details.message === "string" && "filename" in details) {
			out.message = details.message;
			out.filename = details.filename;
			out.lineno = details.lineno;
			out.colno = details.colno;
			if (details.error instanceof Error) {
				out.causeMessage = details.error.message;
				out.causeName = details.error.name;
				if (details.error.stack) out.causeStack = details.error.stack;
			}
			return out;
		}
		// PromiseRejectionEvent (window.onunhandledrejection)
		if ("reason" in details) {
			const r = details.reason;
			if (r instanceof Error) {
				out.message = r.message;
				out.name = r.name;
				if (r.stack) out.stack = r.stack;
			} else {
				out.reason = typeof r === "object" ? r : String(r);
			}
			return out;
		}
		out.raw = details;
		return out;
	}

	function renderError(code, details) {
		let errorsElement = document.getElementById("errors");

		if (!errorsElement) {
			document.body.innerHTML = `
			<svg class="icon-warning" xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-alert-triangle" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
				<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
				<path d="M12 9v2m0 4v.01"></path>
				<path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"></path>
			</svg>
			<h1>接続出来ませんでした。</h1>
			<button class="button-big" onclick="location.reload(true);">
				<span class="button-label-big">リロード</span>
			</button>
			<p class="dont-worry">（おそらく）サーバーの再起動中です。</p>
			<p>念の為ブラウザが最新か、広告ブロッカーがオフになっているかをご確認ください。</p>
			<p>5分経過しても問題が解決しない場合は、管理者にお問い合わせください。<br><br>連絡先Discord : emtk<br><br>以下、補助ツール : </p>
			<a href="/cli">
				<button class="button-small">
					<span class="button-label-small">簡易クライアントを起動</span>
				</button>
			</a>
			<br>
			<a href="/light">
				<button class="button-small">
					<span class="button-label-small">軽量クライアントに接続</span>
				</button>
			</a>
			<br>
			<a href="/flush">
				<button class="button-small">
					<span class="button-label-small">⚠環境設定とキャッシュをクリア</span>
				</button>
			</a>
			<br>
			<a href="/bios">
				<button class="button-small">
					<span class="button-label-small">修復ツールを起動</span>
				</button>
			</a>
			<br>
			<div id="errors"></div>
			`;
			errorsElement = document.getElementById("errors");
		}
		const detailObj = getErrorDetailObject(code, details);
		const detailJson = JSON.stringify(detailObj, null, 2);
		const detailsElement = document.createElement("details");
		detailsElement.innerHTML =
			"<br>\n<summary><code>ERROR CODE: " +
			escapeHtml(code) +
			"</code></summary>\n<pre class=\"error-detail\">" +
			escapeHtml(detailJson) +
			"</pre>";
		errorsElement.appendChild(detailsElement);
		addStyle(`
		* {
			font-family: BIZ UDGothic, Roboto, HelveticaNeue, Arial, sans-serif;
		}

		#cluckey_app,
		#calckey_app,
		#splash {
			display: none !important;
		}

		body,
		html {
			background-color: #191724;
			color: #e0def4;
			justify-content: center;
			margin: auto;
			padding: 10px;
			text-align: center;
		}

		button {
			border-radius: 999px;
			padding: 0px 12px 0px 12px;
			border: none;
			cursor: pointer;
			margin-bottom: 12px;
		}

		.button-big {
			background: linear-gradient(90deg, rgb(196, 167, 231), rgb(235, 188, 186));
			line-height: 50px;
		}

		.button-big:hover {
			background: rgb(49, 116, 143);
		}

		.button-small {
			background: #444;
			line-height: 40px;
		}

		.button-small:hover {
			background: #555;
		}

		.button-label-big {
			color: #191724;
			font-weight: bold;
			font-size: 20px;
			padding: 12px;
		}

		.button-label-small {
			color: rgb(156, 207, 216);
			font-size: 16px;
			padding: 12px;
		}

		a {
			color: rgb(156, 207, 216);
			text-decoration: none;
		}

		p,
		li {
			font-size: 16px;
		}

		.dont-worry,
		#msg {
			font-size: 18px;
		}

		.icon-warning {
			color: #f6c177;
			height: 4rem;
			padding-top: 2rem;
		}

		h1 {
			font-size: 32px;
		}

		code {
			font-family: Fira, FiraCode, monospace;
		}

		pre.error-detail {
			white-space: pre-wrap;
			word-break: break-word;
			text-align: left;
			max-width: 100%;
			margin: 0.5rem 0 0;
		}

		details {
			background: #1f1d2e;
			margin-bottom: 2rem;
			padding: 0.5rem 1rem;
			width: 40rem;
			border-radius: 10px;
			justify-content: center;
			margin: auto;
		}

		summary {
			cursor: pointer;
		}

		summary > * {
			display: inline;
		}

		@media screen and (max-width: 500px) {
			details {
				width: 50%;
			}
		}`);
	}

	function renderSleep(code, details, count) {
		let errorsElement = document.getElementById("errors");

		if (!errorsElement) {
			document.body.innerHTML = `
			<h1>おやすみなさい。</h1>
			<br>
			<button class="button-big" onclick="location.reload(true);">
				<span class="button-label-big">リロード</span>
			</button>
			${
				count >= 4
					? `
			<br>
			<button class="button-small" onclick="localStorage.removeItem('sleepTime');localStorage.setItem('sleepCancel','y');location.reload(true);">
				<span class="button-label-small">睡眠モードを解除</span>
			</button>
			`
					: ""
			}
			<br>
			<br>
			<div id="errors"></div>
			`;
			errorsElement = document.getElementById("errors");
		}
		const detailsElement = document.createElement("details");
		detailsElement.innerHTML = `
		<br>
		<summary>
			<code>${code}</code>
		</summary>
		<code>${details}</code>`;
		errorsElement.appendChild(detailsElement);
		addStyle(`
		* {
			font-family: BIZ UDGothic, Roboto, HelveticaNeue, Arial, sans-serif;
		}

		#cluckey_app,
		#calckey_app,
		#splash {
			display: none !important;
		}

		body,
		html {
			background-color: #191724;
			color: #e0def4;
			justify-content: center;
			margin: auto;
			padding: 10px;
			text-align: center;
		}

		button {
			border-radius: 999px;
			padding: 0px 12px 0px 12px;
			border: none;
			cursor: pointer;
			margin-bottom: 12px;
		}

		.button-big {
			background: linear-gradient(90deg, rgb(196, 167, 231), rgb(235, 188, 186));
			line-height: 50px;
		}

		.button-big:hover {
			background: rgb(49, 116, 143);
		}

		.button-small {
			background: #444;
			line-height: 40px;
		}

		.button-small:hover {
			background: #555;
		}

		.button-label-big {
			color: #191724;
			font-weight: bold;
			font-size: 20px;
			padding: 12px;
		}

		.button-label-small {
			color: rgb(156, 207, 216);
			font-size: 16px;
			padding: 12px;
		}

		a {
			color: rgb(156, 207, 216);
			text-decoration: none;
		}

		p,
		li {
			font-size: 16px;
		}

		.dont-worry,
		#msg {
			font-size: 18px;
		}

		.icon-warning {
			color: #f6c177;
			height: 4rem;
			padding-top: 2rem;
		}

		h1 {
			font-size: 32px;
		}

		code {
			font-family: Fira, FiraCode, monospace;
		}

		details {
			background: #1f1d2e;
			margin-bottom: 2rem;
			padding: 0.5rem 1rem;
			width: 40rem;
			border-radius: 10px;
			justify-content: center;
			margin: auto;
		}

		summary {
			cursor: pointer;
		}

		summary > * {
			display: inline;
		}

		@media screen and (max-width: 500px) {
			details {
				width: 50%;
			}
		`);
	}

	//#region 更新確認と再読み込み
	/**
	 * import 失敗時にサーバー版メタ情報を照合し、必要なら再読み込みする。
	 *
	 * @remarks
	 * - iOS WebKit を含む一部環境では、起動直後に古いキャッシュと新しいエントリが不整合になり得る。
	 * - ここでは例外を再 throw せず、エラー画面の重複表示を抑える。
	 *
	 * @param importError - アセット import 失敗時の元例外
	 * @returns 再読み込みを実施した場合は true
	 */
	async function checkUpdate(importError) {
		try {
			// import 失敗時点でアセット実体が無い（404/410）なら、version が同一でも更新不整合とみなして再読込する。
			const assetExists = await doesClientEntryExist();
			if (!assetExists) {
				return forceRefreshOnce("entry-missing", false);
			}

			const res = await fetch("/api/meta", {
				method: "POST",
				cache: "no-cache",
			});
			if (!res.ok) {
				throw new Error(`Meta request failed: ${res.status}`);
			}

			const meta = await res.json();
			const latestVersion = meta && typeof meta.version === "string" ? meta.version : null;
			if (!latestVersion) {
				console.warn("UPDATE_CHECK: invalid meta response", meta);
				return false;
			}

			if (!currentVersion || latestVersion !== currentVersion) {
				localStorage.setItem("v", latestVersion);
				refresh();
				return true;
			}
		} catch (e) {
			console.error(e);
			renderError("UPDATE_CHECK", {
				cause: e,
				importError,
				...buildAppImportContext(),
			});
		}
		return false;
	}

	/**
	 * 現在の CLIENT_ENTRY が配信可能かを確認する。
	 *
	 * @remarks
	 * iOS WebKit では古い HTML が残って import 先だけ 404 になる事象があるため、
	 * version 差分とは別にアセット実在を確認する。
	 */
	async function doesClientEntryExist() {
		try {
			const checkRes = await fetch(importTarget, {
				method: "GET",
				cache: "no-cache",
			});
			lastEntryProbe = toEntryProbeInfo(checkRes, "exist-check");
			return checkRes.ok;
		} catch (e) {
			// NOTE: ネットワーク瞬断時はここで false にすると無限 reload しやすいので、存在不明扱いで true を返す。
			console.warn("APP_IMPORT: failed to probe client entry", e);
			lastEntryProbe = {
				stage: "exist-check",
				ok: null,
				status: null,
				contentType: null,
				cacheControl: null,
				error: String(e),
			};
			return true;
		}
	}

	/**
	 * Safari 系の import 失敗を想定し、対象アセットを no-store で取得してから 1 回だけ cache-bust 再読込する。
	 *
	 * @remarks
	 * - アセット実体が存在しても import が失敗するケースを救済する。
	 * - 既に retry クエリ付きで起動中の場合は再試行を打ち切る。
	 */
	async function primeImportTargetAndRetry(importError) {
		if (bootRetryToken) return false;
		try {
			const res = await fetch(importTarget, {
				method: "GET",
				cache: "no-store",
			});
			lastEntryProbe = toEntryProbeInfo(res, "prime-fetch");
			if (!res.ok) return false;
			return forceRefreshOnce("import-prime-retry", true);
		} catch (e) {
			lastEntryProbe = {
				stage: "prime-fetch",
				ok: null,
				status: null,
				contentType: null,
				cacheControl: null,
				error: String(e),
			};
			console.warn("APP_IMPORT: failed to prime import target", {
				importError,
				primeError: e,
			});
			return false;
		}
	}

	function toEntryProbeInfo(response, stage) {
		return {
			stage,
			ok: response.ok,
			status: response.status,
			contentType: response.headers.get("content-type"),
			cacheControl: response.headers.get("cache-control"),
		};
	}

	function getPerformanceEntrySummary() {
		try {
			return performance
				.getEntriesByName(importTarget)
				.map((entry) => ({
					entryType: entry.entryType,
					name: entry.name,
					startTime: Math.round(entry.startTime),
					duration: Math.round(entry.duration),
					initiatorType: entry.initiatorType || null,
				}));
		} catch (e) {
			return [{ entryType: "unavailable", reason: String(e) }];
		}
	}

	function buildAppImportContext() {
		return {
			importTarget,
			currentVersion,
			bootRetryToken,
			isBootRetry: Boolean(bootRetryToken),
			visibilityState: document.visibilityState,
			userAgent: navigator.userAgent,
			performanceEntries: getPerformanceEntrySummary(),
			entryProbe: lastEntryProbe,
		};
	}

	function cleanupBootRetryQuery() {
		if (!bootRetryToken) return;
		const cleanedUrl = new URL(location.href);
		cleanedUrl.searchParams.delete(bootRetryQueryKey);
		history.replaceState(history.state, "", cleanedUrl.toString());
	}

	/**
	 * 同一セッション内で 1 回だけ強制再読込する。
	 *
	 * @remarks
	 * APP_IMPORT 発生時の保険として使い、無限ループを防ぐ。
	 */
	function forceRefreshOnce(reason, withCacheBust) {
		try {
			const marker = sessionStorage.getItem(forcedRefreshMarkerKey);
			if (marker === importTarget) return false;
			sessionStorage.setItem(forcedRefreshMarkerKey, importTarget);
			console.warn("APP_IMPORT: force refresh once", {
				reason,
				withCacheBust,
				...buildAppImportContext(),
			});
			refresh(withCacheBust);
			return true;
		} catch (e) {
			console.warn("APP_IMPORT: force refresh marker unavailable", e);
			refresh(withCacheBust);
			return true;
		}
	}

	/**
	 * Service Worker とページを再初期化して最新アセットへ揃える。
	 *
	 * @remarks
	 * キャッシュ不整合が疑われる起動失敗時に、SW登録解除と reload を連続実行する。
	 */
	function refresh(withCacheBust) {
		// Clear cache (service worker)
		try {
			navigator.serviceWorker.controller.postMessage("clear");
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				registrations.forEach((registration) => registration.unregister());
			});
		} catch (e) {
			console.error(e);
		}

		if (withCacheBust) {
			const refreshedUrl = new URL(location.href);
			refreshedUrl.searchParams.set(bootRetryQueryKey, String(Date.now()));
			location.replace(refreshedUrl.toString());
			return;
		}
		location.reload();
	}
	//#endregion
})();
