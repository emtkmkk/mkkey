/**
 * Light Client - 通信制限向け簡易クライアント
 * Vanilla JS で実装。ユーザー操作時のみ通信。
 */
(function () {
	"use strict";

	const STORAGE_PREFIX = "light:";
	const DRAFT_PREFIX = STORAGE_PREFIX + "draft:";
	const VISIBILITY_PREFIX = STORAGE_PREFIX + "visibility:";
	const SETTINGS_PREFIX = STORAGE_PREFIX + "settings:";
	const REACTIONS_KEY = STORAGE_PREFIX + "reactions";
	const HIDDEN_ICON_KEY = STORAGE_PREFIX + "hiddenIconUserIds";
	/** @type {Record<string,string>} 絵文字名→URL（api("meta") から取得） */
	let emojiUrlCache = {};
	/** @type {Set<string>} 一度画像表示した絵文字キー（次回も画像で表示） */
	let emojiDisplayedAsImageCache = new Set();
	/** ストリーミング通知を表示する時間（ミリ秒）。経過後にポップアップから削除する */
	const STREAMING_NOTIFICATION_DISPLAY_MS = 8000;

	let token = null;
	let currentAccount = null;
	let accounts = [];
	let currentTl = (() => { try { const v = localStorage.getItem("light:lastTl"); return (v && ["home","local","global","social","recommended","antenna","list","channel","notifications"].includes(v)) ? v : "home"; } catch { return "home"; } })();
	let notes = [];
	let notifications = [];
	let streamingNotifications = [];
	let isLoading = false;
	let streamWs = null;
	/** 現在のTL用ストリーム接続ID。受信ノートがこのチャンネル由来かチェックする際に使用 */
	let streamTlChannelId = null;
	let streamReconnectTimer = null;
	let lastError = null;

	// API呼び出し
	async function api(endpoint, data = {}) {
		if (token) data.i = token;
		const res = await fetch(`/api/${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
			credentials: "same-origin",
		});
		const body = res.status === 204 ? null : await res.json();
		if (res.status === 401) {
			handle401();
			throw new Error("Unauthorized");
		}
		if (!res.ok) throw (body && body.error) || new Error(`API Error: ${res.status}`);
		return body;
	}

	function handle401() {
		token = null;
		hidePostForm();
		renderHeader();
		showLoginForm();
	}

	function getApiUrl(path) {
		return `${window.location.origin}${path}`;
	}

	// アカウント管理（通常クライアントと同じ仕組み）
	async function loadAccounts() {
		try {
			const stored = localStorage.getItem("account");
			if (stored) {
				currentAccount = JSON.parse(stored);
				token = currentAccount.token;
			}
			const idb = await getAccountsFromStorage();
			if (idb && idb.length > 0) {
				accounts = idb;
				if (!currentAccount && accounts[0]) {
					currentAccount = { id: accounts[0].id, token: accounts[0].token, username: accounts[0].username, host: accounts[0].host };
					token = accounts[0].token;
					localStorage.setItem("account", JSON.stringify(currentAccount));
				} else if (currentAccount) {
					const match = idb.find((a) => a.id === currentAccount.id);
					if (match && (match.username || match.host)) {
						currentAccount = { ...currentAccount, username: match.username, host: match.host };
					}
				}
			}
		} catch (e) {
			console.warn("loadAccounts:", e);
		}
	}

	async function getAccountsFromStorage() {
		const fb = localStorage.getItem("idbfallback::accounts");
		if (fb) return JSON.parse(fb);
		try {
			const db = await new Promise((res, rej) => {
				const r = indexedDB.open("keyval-store", 1);
				r.onerror = rej;
				r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("keyval")) r.result.createObjectStore("keyval"); };
				r.onsuccess = () => res(r.result);
			});
			const raw = await new Promise((res, rej) => {
				const tx = db.transaction("keyval", "readonly");
				const req = tx.objectStore("keyval").get("accounts");
				req.onsuccess = () => res(req.result);
				req.onerror = rej;
			});
			db.close();
			return Array.isArray(raw) ? raw : (raw && raw.value) || [];
		} catch (e) {
			return [];
		}
	}

	async function saveAccounts(accs) {
		localStorage.setItem("idbfallback::accounts", JSON.stringify(accs));
		try {
			const db = await new Promise((res, rej) => {
				const r = indexedDB.open("keyval-store", 1);
				r.onerror = rej;
				r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("keyval")) r.result.createObjectStore("keyval"); };
				r.onsuccess = () => res(r.result);
			});
			await new Promise((res, rej) => {
				const tx = db.transaction("keyval", "readwrite");
				const store = tx.objectStore("keyval");
				store.put(accs, "accounts");
				tx.oncomplete = () => res();
				tx.onerror = rej;
			});
			db.close();
		} catch (e) {
			// ignore
		}
	}

	// 設定読み書き
	function getSetting(key, def) {
		try {
			const v = localStorage.getItem(SETTINGS_PREFIX + key);
			return v !== null ? JSON.parse(v) : def;
		} catch {
			return def;
		}
	}

	function setSetting(key, value) {
		localStorage.setItem(SETTINGS_PREFIX + key, JSON.stringify(value));
	}

	// ドラフト
	function getDraftKey() {
		const tid = currentTl === "antenna" ? `antenna:${getSetting("antennaId", "")}` :
			currentTl === "list" ? `list:${getSetting("listId", "")}` :
			currentTl === "channel" ? `channel:${getSetting("channelId", "")}` : currentTl;
		return DRAFT_PREFIX + (currentAccount?.id || "anon") + ":" + tid;
	}

	function loadDraft() {
		const key = getDraftKey();
		try {
			const s = localStorage.getItem(key);
			return s ? JSON.parse(s) : null;
		} catch {
			return null;
		}
	}

	function saveDraft(data) {
		const key = getDraftKey();
		localStorage.setItem(key, JSON.stringify(data));
	}

	function clearDraft() {
		localStorage.removeItem(getDraftKey());
	}

	// 公開範囲記録（TL毎）
	function getVisibilityKey() {
		return VISIBILITY_PREFIX + (currentAccount?.id || "anon") + ":" + currentTl;
	}

	function loadLastVisibility() {
		if (!getSetting("rememberVisibility", true)) return null;
		try {
			const s = localStorage.getItem(getVisibilityKey());
			return s ? JSON.parse(s) : null;
		} catch {
			return null;
		}
	}

	function saveLastVisibility(visibility, localOnly) {
		if (!getSetting("rememberVisibility", true)) return;
		if (!currentAccount) return;
		localStorage.setItem(getVisibilityKey(), JSON.stringify({ visibility, localOnly }));
	}

	function getNoteById(noteId) {
		const fromNotes = notes.find((n) => n.id === noteId);
		if (fromNotes) return fromNotes;
		for (const n of notifications) {
			if (n.note && n.note.id === noteId) return n.note;
		}
		return null;
	}

	// ワードミュート
	function getWordMuteKeywords() {
		const t = getSetting("wordMute", "") || "";
		return t.split("\n").map((s) => s.trim()).filter(Boolean);
	}

	function isWordMuted(text) {
		if (!text) return false;
		const kw = getWordMuteKeywords();
		const lower = text.toLowerCase();
		for (const k of kw) {
			if (lower.includes(k.toLowerCase())) return true;
		}
		return false;
	}

	// ログイン
	async function doLogin(username, password, tokenParam) {
		const body = await api("signin", { username, password, ...(tokenParam ? { token: tokenParam } : {}) });
		if (body?.challenge && body?.challengeId && body?.securityKeys) {
			window._light2fa = { challenge: body.challenge, challengeId: body.challengeId, securityKeys: body.securityKeys };
			return "2fa";
		}
		const t = body?.i || body?.token;
		if (body && t) {
			token = t;
			const me = await api("i", {});
			currentAccount = { id: me.id, token, username: me.username, host: me.host };
			localStorage.setItem("account", JSON.stringify(currentAccount));
			const accs = await getAccountsFromStorage();
			if (!accs.some((a) => a.id === me.id)) {
				await saveAccounts([...accs, { id: me.id, token, username: me.username, host: me.host }]);
			}
			renderHeader();
			hideLoginForm();
			showPostForm();
			loadCurrentTl();
			return true;
		}
		return false;
	}

	async function doLoginWithTotp(username, password, tokenCode) {
		const body = await api("signin", { username, password, token: tokenCode });
		const t = body?.i || body?.token;
		if (!body || !t) throw new Error("ログインに失敗しました");
		token = t;
		const me = await api("i", {});
		currentAccount = { id: me.id, token, username: me.username, host: me.host };
		localStorage.setItem("account", JSON.stringify(currentAccount));
		const accs = await getAccountsFromStorage();
		if (!accs.some((a) => a.id === me.id)) {
			await saveAccounts([...accs, { id: me.id, token, username: me.username, host: me.host }]);
		}
		renderHeader();
		hideLoginForm();
		showPostForm();
		loadCurrentTl();
	}

	async function doLoginWithPasskey(username, password) {
		const twofa = window._light2fa;
		if (!twofa && (!username || !password)) {
			const res = await api("signin", { username, password });
			if (res?.challenge && res?.challengeId && res?.securityKeys) {
				window._light2fa = { challenge: res.challenge, challengeId: res.challengeId, securityKeys: res.securityKeys };
			} else throw new Error("2FAの準備に失敗しました");
		}
		const data = window._light2fa;
		if (!data?.challenge || !data?.challengeId) throw new Error("2FAの準備に失敗しました");
		if (!window.PublicKeyCredential || !navigator.credentials) throw new Error("お使いのブラウザはPasskeyに対応していません");
		const allowCreds = (data.securityKeys || []).map((k) => ({
			id: byteify(k.id, "hex"),
			type: "public-key",
			transports: ["usb", "nfc", "ble", "internal"],
		}));
		const credential = await navigator.credentials.get({
			publicKey: {
				challenge: byteify(data.challenge, "base64"),
				allowCredentials: allowCreds.length ? allowCreds : undefined,
				timeout: 60000,
				userVerification: "preferred",
			},
		});
		if (!credential) throw new Error("キャンセルされました");
		const c = credential;
		const r = c.response;
		const body = await api("signin", {
			username,
			password,
			credentialId: c.id,
			signature: hexify(r.signature),
			authenticatorData: hexify(r.authenticatorData),
			clientDataJSON: hexify(r.clientDataJSON),
			challengeId: data.challengeId,
		});
		const t = body?.i || body?.token;
		if (!body || !t) throw new Error("ログインに失敗しました");
		window._light2fa = null;
		token = t;
		const me = await api("i", {});
		currentAccount = { id: me.id, token, username: me.username, host: me.host };
		localStorage.setItem("account", JSON.stringify(currentAccount));
		const accs = await getAccountsFromStorage();
		if (!accs.some((a) => a.id === me.id)) {
			await saveAccounts([...accs, { id: me.id, token, username: me.username, host: me.host }]);
		}
		renderHeader();
		hideLoginForm();
		showPostForm();
		loadCurrentTl();
	}

	function doLogout() {
		token = null;
		currentAccount = null;
		localStorage.removeItem("account");
		if (streamWs) { streamWs.close(); streamWs = null; }
		if (streamReconnectTimer) { clearTimeout(streamReconnectTimer); streamReconnectTimer = null; }
		hidePostForm();
		renderHeader();
		notes = [];
		renderNotes();
		showLoginForm();
	}

	// UI表示切り替え
	function showPostForm() {
		const f = document.getElementById("post-form");
		if (f) f.style.display = "block";
	}

	function hidePostForm() {
		const f = document.getElementById("post-form");
		if (f) f.style.display = "none";
	}

	function byteify(str, enc) {
		if (enc === "hex") {
			const arr = [];
			for (let i = 0; i < str.length; i += 2) arr.push(parseInt(str.slice(i, i + 2), 16));
			return new Uint8Array(arr);
		}
		if (enc === "base64") {
			const s = str.replace(/-/g, "+").replace(/_/g, "/");
			const bin = atob(s);
			return Uint8Array.from(bin, (c) => c.charCodeAt(0));
		}
		return new Uint8Array(0);
	}

	function hexify(buf) {
		return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	function showLoginForm() {
		const overlay = document.getElementById("modal-overlay");
		const body = document.getElementById("modal-body");
		if (!overlay || !body) return;
		body.innerHTML = `
			<h3>ログイン</h3>
			<form class="login-form" id="login-form">
				<div id="login-step1">
					<input type="text" id="login-username" placeholder="ユーザー名" required>
					<input type="password" id="login-password" placeholder="パスワード" required>
					<input type="text" id="login-token-step1" placeholder="2FAコード（TOTPの場合）" maxlength="6" autocomplete="one-time-code">
					<button type="submit">ログイン</button>
				</div>
				<div id="login-step2" style="display:none">
					<p>2段階認証</p>
					<div id="login-2fa-passkey" style="margin-bottom:0.5rem">
						<button type="button" id="login-passkey-btn">セキュリティキーでログイン</button>
					</div>
					<div style="margin:0.5rem 0">または</div>
					<input type="text" id="login-token" placeholder="6桁のコード" maxlength="6" pattern="[0-9]{6}">
					<button type="submit" id="login-totp-submit">ログイン</button>
				</div>
			</form>
		`;
		overlay.style.display = "flex";
		let pendingCred = null;
		document.getElementById("login-form")?.addEventListener("submit", async (e) => {
			e.preventDefault();
			const step2 = document.getElementById("login-step2");
			if (step2?.style.display !== "none") {
				const tok = document.getElementById("login-token")?.value?.trim();
				if (!tok || tok.length !== 6) { showError("6桁のコードを入力してください"); return; }
				try {
					await doLoginWithTotp(pendingCred?.username, pendingCred?.password, tok);
					overlay.style.display = "none";
				} catch (err) {
					showError(err?.message || "ログインに失敗しました");
				}
				return;
			}
			const u = document.getElementById("login-username")?.value?.trim();
			const p = document.getElementById("login-password")?.value;
			const tok1 = document.getElementById("login-token-step1")?.value?.trim();
			if (!u || !p) return;
			try {
				const res = await doLogin(u, p, tok1 || undefined);
				if (res === "2fa") {
					pendingCred = { username: u, password: p };
					document.getElementById("login-step1").style.display = "none";
					step2.style.display = "block";
					const passkeyDiv = document.getElementById("login-2fa-passkey");
					if (passkeyDiv && (!window._light2fa?.securityKeys?.length)) passkeyDiv.style.display = "none";
					document.getElementById("login-token")?.focus();
				} else {
					overlay.style.display = "none";
				}
			} catch (err) {
				showError(err?.message || "ログインに失敗しました");
			}
		});
		document.getElementById("login-passkey-btn")?.addEventListener("click", async () => {
			const u = document.getElementById("login-username")?.value?.trim();
			const p = document.getElementById("login-password")?.value;
			if (!pendingCred && (!u || !p)) return;
			const cred = pendingCred || { username: u, password: p };
			try {
				await doLoginWithPasskey(cred.username, cred.password);
				overlay.style.display = "none";
			} catch (err) {
				showError(err?.message || "セキュリティキーでログインに失敗しました");
			}
		});
	}

	function hideLoginForm() {
		const overlay = document.getElementById("modal-overlay");
		if (overlay) overlay.style.display = "none";
	}

	// ヘッダー（acct 表示 + ストリーミング・リロード・メニューボタン）
	function renderHeader() {
		updateTlTabVisibility();
		const loginBtn = document.getElementById("login-btn");
		const menuBtn = document.getElementById("header-menu-btn");
		const streamingBtn = document.getElementById("header-streaming-btn");
		const reloadBtn = document.getElementById("header-reload-btn");
		const accountName = document.getElementById("account-name");
		if (token && currentAccount) {
			if (loginBtn) loginBtn.style.display = "none";
			const guestReloadBtn = document.getElementById("header-guest-reload-btn");
			if (guestReloadBtn) guestReloadBtn.style.display = "none";
			if (menuBtn) menuBtn.style.display = "inline-block";
			if (streamingBtn) {
				streamingBtn.style.display = "inline-block";
				streamingBtn.textContent = "⚡";
				streamingBtn.title = getSetting("streaming", false) ? "ストリーミング ON（タップでOFF）" : "ストリーミング OFF（タップでON）";
				streamingBtn.classList.toggle("header-btn-active", getSetting("streaming", false));
			}
			if (reloadBtn) reloadBtn.style.display = "inline-block";
			if (accountName) accountName.textContent = (currentAccount.username || currentAccount.host) ? getAcct(currentAccount) : `@${(currentAccount.id || "").slice(0, 8)}...`;
			updateHeaderMenuAccountSwitch();
		} else {
			if (loginBtn) loginBtn.style.display = "inline-block";
			if (menuBtn) menuBtn.style.display = "none";
			if (streamingBtn) streamingBtn.style.display = "none";
			if (reloadBtn) reloadBtn.style.display = "none";
			const guestReloadBtn = document.getElementById("header-guest-reload-btn");
			if (guestReloadBtn) guestReloadBtn.style.display = "inline-block";
			if (accountName) accountName.textContent = "";
		}
	}

	function updateHeaderMenuAccountSwitch() {
		const switchItem = document.querySelector('.header-menu-item[data-action="switch-account"]');
		if (!switchItem) return;
		switchItem.style.display = (accounts || []).length > 1 ? "block" : "none";
	}

	async function showAccountSwitch() {
		const accs = await getAccountsFromStorage();
		if (!accs || accs.length < 2) return;
		const overlay = document.getElementById("modal-overlay");
		const body = document.getElementById("modal-body");
		if (!overlay || !body) return;
		hideModal();
		const getAccountLabel = (a) => (a.username != null ? getAcct(a) : (a.id || "アカウント"));
		body.innerHTML = `<h3>アカウント切り替え</h3><div class="account-list">${
			accs.map((a) => `<div class="account-item" data-account-id="${escapeHtml(a.id)}" data-account-token="${escapeHtml(a.token)}" data-account-username="${escapeHtml(a.username || "")}" data-account-host="${escapeHtml(a.host || "")}">${escapeHtml(getAccountLabel(a))}</div>`).join("")
		}</div>`;
		overlay.style.display = "block";
		body.querySelectorAll(".account-item").forEach((el) => {
			el.addEventListener("click", async () => {
				const id = el.dataset.accountId;
				const t = el.dataset.accountToken;
				if (!id || !t) return;
				currentAccount = { id, token: t, username: el.dataset.accountUsername || undefined, host: el.dataset.accountHost || undefined };
				token = t;
				localStorage.setItem("account", JSON.stringify(currentAccount));
				hideModal();
				renderHeader();
				notes = [];
				loadCurrentTl();
			});
		});
	}

	// エラー表示
	function showError(msg) {
		lastError = msg;
		const banner = document.getElementById("error-banner");
		const el = document.getElementById("error-message");
		if (banner && el) {
			el.textContent = msg;
			banner.style.display = "flex";
		}
	}

	function hideError() {
		lastError = null;
		const banner = document.getElementById("error-banner");
		if (banner) banner.style.display = "none";
	}

	// TL取得
	function getTimelineEndpoint() {
		const map = {
			home: "notes/timeline",
			local: "notes/local-timeline",
			global: "notes/global-timeline",
			social: "notes/hybrid-timeline",
			recommended: "notes/recommended-timeline",
			antenna: "antennas/notes",
			list: "notes/user-list-timeline",
			channel: "channels/timeline",
		};
		return map[currentTl] || "notes/timeline";
	}

	async function loadAntennas() {
		try {
			const data = await api("antennas/list", {});
			return data || [];
		} catch {
			return [];
		}
	}

	async function loadLists() {
		try {
			const data = await api("users/lists/list", {});
			return Array.isArray(data) ? data : [];
		} catch {
			return [];
		}
	}

	async function loadChannels() {
		try {
			const data = await api("channels/followed", { limit: 100 });
			return data || [];
		} catch {
			return [];
		}
	}

	function updateTlSelectorVisibility() {
		const sel = document.getElementById("tl-selector");
		const label = document.getElementById("tl-selector-label");
		const select = document.getElementById("tl-selector-select");
		if (!sel || !label || !select) return;
		const needsSelector = ["antenna", "list", "channel"].includes(currentTl) && !!token;
		sel.style.display = needsSelector ? "block" : "none";
		if (!needsSelector) return;
		if (currentTl === "antenna") label.textContent = "アンテナ: ";
		else if (currentTl === "list") label.textContent = "リスト: ";
		else if (currentTl === "channel") label.textContent = "チャンネル: ";
	}

	/** 未ログイン時はローカル・グローバルのみタブ表示。ログイン時は全タブ表示 */
	function updateTlTabVisibility() {
		const guestTls = ["local", "global"];
		document.querySelectorAll(".tab-btn[data-tl]").forEach((btn) => {
			const tl = btn.dataset.tl;
			if (!token && !guestTls.includes(tl)) {
				btn.style.display = "none";
			} else {
				btn.style.display = "";
			}
		});
	}

	async function populateTlSelector() {
		const select = document.getElementById("tl-selector-select");
		if (!select) return;
		select.innerHTML = '<option value="">選択...</option>';
		let items = [];
		let settingKey = "";
		if (currentTl === "antenna") {
			items = await loadAntennas();
			settingKey = "antennaId";
		} else if (currentTl === "list") {
			items = await loadLists();
			settingKey = "listId";
		} else if (currentTl === "channel") {
			items = await loadChannels();
			settingKey = "channelId";
		}
		const currentId = getSetting(settingKey, "");
		items.forEach((item) => {
			const opt = document.createElement("option");
			opt.value = item.id;
			opt.textContent = (item.name || item.title || item.id || "").toString();
			if (item.id === currentId) opt.selected = true;
			select.appendChild(opt);
		});
		select.onchange = () => {
			setSetting(settingKey, select.value || "");
			loadCurrentTl();
		};
	}

	async function loadTimeline(untilId) {
		if (!token && !["local", "global"].includes(currentTl)) return;
		if (currentTl === "antenna" && !getSetting("antennaId", "")) return;
		if (currentTl === "list" && !getSetting("listId", "")) return;
		if (currentTl === "channel" && !getSetting("channelId", "")) return;
		if (isLoading) return;
		isLoading = true;
		hideError();
		try {
			if (["local", "global"].includes(currentTl)) await fetchEmojiUrlCache();
			const ep = getTimelineEndpoint();
			const params = { limit: 20 };
			if (untilId) params.untilId = untilId;
			if (currentTl === "antenna") params.antennaId = getSetting("antennaId", "");
			if (currentTl === "list") params.listId = getSetting("listId", "");
			if (currentTl === "channel") params.channelId = getSetting("channelId", "");
			const data = await api(ep, params);
			if (untilId) {
				notes = [...notes, ...(data || [])];
			} else {
				notes = data || [];
			}
			renderNotes();
			const loadMore = document.getElementById("load-more");
			if (loadMore) {
				loadMore.style.display = (data || []).length >= 20 ? "block" : "none";
				loadMore.onclick = () => {
					const last = notes[notes.length - 1];
					if (last) loadTimeline(last.id);
				};
			}
		} catch (err) {
			showError(err?.message || "TLの取得に失敗しました");
		} finally {
			isLoading = false;
		}
	}

	async function loadNotifications(untilId) {
		if (!token) return;
		if (isLoading) return;
		isLoading = true;
		hideError();
		try {
			const params = { limit: 20 };
			if (untilId) params.untilId = untilId;
			const data = await api("i/notifications", params);
			if (untilId) {
				notifications = [...notifications, ...(data || [])];
			} else {
				notifications = data || [];
			}
			renderNotifications();
			const loadMore = document.getElementById("load-more");
			if (loadMore) {
				loadMore.style.display = (data || []).length >= 20 ? "block" : "none";
				loadMore.onclick = () => {
					const last = notifications[notifications.length - 1];
					if (last) loadNotifications(last.id);
				};
			}
		} catch (err) {
			showError(err?.message || "通知の取得に失敗しました");
		} finally {
			isLoading = false;
		}
	}

	function getNoteSummary(note) {
		if (!note) return "";
		if (note.deletedAt) return "(削除済み)";
		let s = note.cw ? note.cw + (note.text ? " (CW本文あり)" : "") : (note.text || "");
		if (s.length > 80) s = s.slice(0, 80) + "...";
		if ((note.files || []).length) s += ` (ファイル${note.files.length}件)`;
		if (note.renoteId && !note.text && (!note.files || !note.files.length) && !note.poll) s += " (RT)";
		else if (note.renoteId) s += " (QT)";
		return s.trim();
	}

	/** リアクション絵文字1つのHTML（ノートのリアクション表示と同様の placeholder/img） */
	function renderReactionEmojiHtml(r) {
		if (!r || typeof r !== "string") return "";
		const m = /^:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9.-]+))?:$/.exec(r);
		if (!m) return escapeHtml(r);
		const key = m[2] ? `${m[1]}@${m[2]}` : m[1];
		const url = getEmojiUrl(r);
		if (!url) return escapeHtml(r);
		if (emojiDisplayedAsImageCache.has(r) || emojiDisplayedAsImageCache.has(key)) {
			return `<img class="note-emoji-img" src="${escapeHtml(url)}" alt="${escapeHtml(r)}" style="height:1.25em;width:auto;vertical-align:middle;cursor:pointer" data-emoji-url="${escapeHtml(url)}" data-emoji-text="${escapeHtml(r)}">`;
		}
		return `<span class="note-emoji-placeholder" data-emoji-url="${escapeHtml(url)}" title="${escapeHtml(r)}">${escapeHtml(r)}</span>`;
	}

	function renderNotifications() {
		const container = document.getElementById("notes");
		if (!container) return;
		const showIcons = getSetting("showIcons", true);
		const typeLabels = {
			reply: "返信",
			mention: "メンション",
			quote: "引用",
			reaction: "リアクション",
			renote: "リノート",
			follow: "フォロー",
			followRequestAccepted: "フォロー承認",
			receiveFollowRequest: "フォローリクエスト",
			groupInvited: "グループ招待",
			unreadAntenna: "アンテナ",
		};
		container.innerHTML = notifications.map((n) => {
			const label = typeLabels[n.type] || n.type;
			const who = n.user ? getUserLabel(n.user) : "";
			const createdAt = n.createdAt ? (() => {
				const d = new Date(n.createdAt);
				return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
			})() : "";
			if (n.note && ["reply", "quote", "mention", "reaction", "renote", "unreadAntenna"].includes(n.type)) {
				const summary = getNoteSummary(n.note);
				const reactionPart = n.type === "reaction" && n.reaction ? " " + renderReactionEmojiHtml(n.reaction) : "";
				const whoPart = n.user
					? `<span class="note-user" data-user-id="${escapeHtml(n.user.id)}">${escapeHtml(who)}</span>`
					: "";
				const actionRow = `${escapeHtml(label)}${reactionPart}`;
				const summaryShort = summary ? (summary.length > 50 ? summary.slice(0, 50) + "…" : summary) : "";
				const summaryText = summaryShort ? escapeHtml(summaryShort) : "";
				const bodyParts = [actionRow, summaryText, whoPart ? `（${whoPart}）` : ""].filter(Boolean);
				const headerLine = bodyParts.join(" ");
				const timeRow = createdAt ? `<div class="notification-time" style="font-size:0.75rem;color:var(--lc-muted);margin-top:0.25rem">${escapeHtml(createdAt)}</div>` : "";
				const detailBtn = `<button class="note-detail" data-note-id="${n.note.id}">詳細</button>`;
				return `<div class="note notification-item" data-notification-id="${n.id}" style="margin-bottom:1rem">
					<div class="note-header" style="align-items:flex-start">
						${showIcons && n.user?.avatarUrl ? `<img class="note-avatar" src="${escapeHtml(n.user.avatarUrl)}" alt="">` : ""}
						<div class="notification-body" style="flex:1;min-width:0">
							<div class="note-meta notification-main-row">${headerLine}</div>
							${timeRow}
							<div class="note-actions" style="margin-top:0.25rem">${detailBtn}</div>
						</div>
					</div>
				</div>`;
			}
			const actionFirst = escapeHtml(label);
			const whoPart = n.user
				? `（<span class="note-user" data-user-id="${escapeHtml(n.user.id)}">${escapeHtml(who)}</span>）`
				: "";
			const headerLine = [actionFirst, whoPart].filter(Boolean).join(" ");
			const timeRow = createdAt ? `<div class="notification-time" style="font-size:0.75rem;color:var(--lc-muted);margin-top:0.25rem">${escapeHtml(createdAt)}</div>` : "";
			return `<div class="note notification-item" data-notification-id="${n.id}">
				<div class="note-header">
					${showIcons && n.user?.avatarUrl ? `<img class="note-avatar" src="${escapeHtml(n.user.avatarUrl)}" alt="">` : ""}
					<div class="notification-body" style="flex:1;min-width:0">
						<div class="note-meta notification-main-row">${headerLine}</div>
						${timeRow}
					</div>
				</div>
			</div>`;
		}).join("");
		bindNoteEvents(container);
	}

	function updateNotificationTabVisibility() {
		// 通知タブは常にTLリストに表示（ホームの左）。表示/非表示は行わない。
	}

	function renderStreamingNotifications() {
		const el = document.getElementById("streaming-notifications");
		if (!el) return;
		if (!getSetting("notifications", false) || streamingNotifications.length === 0) {
			el.innerHTML = "";
			el.style.display = "none";
			return;
		}
		const typeLabels = {
			reply: "返信", quote: "引用", mention: "メンション", reaction: "リアクション",
			renote: "リノート", follow: "フォロー", followRequestAccepted: "フォロー承認",
			receiveFollowRequest: "フォローリクエスト", groupInvited: "グループ招待", unreadAntenna: "アンテナ",
		};
		el.innerHTML = streamingNotifications.slice(0, 10).map((n) => {
			const label = typeLabels[n.type] || n.type || "";
			const who = n.user ? getUserLabel(n.user) : "";
			const noteId = n.note?.id || "";
			const summary = n.note ? getNoteSummary(n.note) : "";
			const reactionHtml = n.type === "reaction" && n.reaction ? " " + renderReactionEmojiHtml(n.reaction) : "";
			const summaryShort = summary ? (summary.length > 40 ? summary.slice(0, 40) + "…" : summary) : "";
			const bodyParts = [escapeHtml(label), reactionHtml, summaryShort ? escapeHtml(summaryShort) : "", who ? `（${escapeHtml(who)}）` : ""].filter(Boolean);
			const mainLine = bodyParts.join(" ");
			const createdAt = n.createdAt ? (() => {
				const d = new Date(n.createdAt);
				return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
			})() : "";
			const timeHtml = createdAt ? `<div class="streaming-notif-time">${escapeHtml(createdAt)}</div>` : "";
			return `<div class="streaming-notif-item" data-note-id="${noteId}" data-user-id="${n.user?.id || ""}"><div class="streaming-notif-main">${mainLine}</div>${timeHtml}</div>`;
		}).join("");
		el.style.display = "block";
		bindNoteEvents(el);
		el.querySelectorAll(".streaming-notif-item").forEach((item) => {
			item.addEventListener("click", () => {
				if (item.dataset.noteId) openNoteDetail(item.dataset.noteId);
				else if (item.dataset.userId) openProfile(item.dataset.userId);
			});
		});
	}

	function loadCurrentTl() {
		if (currentTl === "notifications") {
			loadNotifications();
		} else {
			loadTimeline();
		}
		updateStreamConnection();
	}

	function getStreamChannel() {
		const map = {
			home: "homeTimeline",
			local: "localTimeline",
			global: "globalTimeline",
			social: "hybridTimeline",
			recommended: "recommendedTimeline",
			antenna: "antenna",
			list: "userList",
			channel: "channel",
		};
		return map[currentTl] || null;
	}

	function getStreamParams() {
		if (currentTl === "antenna") return { antennaId: getSetting("antennaId", "") };
		if (currentTl === "list") return { listId: getSetting("listId", "") };
		if (currentTl === "channel") return { channelId: getSetting("channelId", "") };
		return {};
	}

	function updateStreamConnection() {
		if (streamWs) {
			streamWs.close();
			streamWs = null;
			streamTlChannelId = null;
		}
		if (streamReconnectTimer) {
			clearTimeout(streamReconnectTimer);
			streamReconnectTimer = null;
		}
		const enabled = getSetting("streaming", false);
		const notificationsStreaming = getSetting("notifications", false);
		if ((!enabled && !notificationsStreaming) || !token) return;
		const ch = currentTl === "notifications" ? null : getStreamChannel();
		if (!ch && !notificationsStreaming) return;
		const params = ch ? getStreamParams() : {};
		if (ch && (ch === "antenna" || ch === "userList" || ch === "channel") && !Object.values(params)[0]) return;
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${proto}//${window.location.host}/streaming?i=${encodeURIComponent(token)}`;
		try {
			const ws = new WebSocket(wsUrl);
			streamWs = ws;
			ws.onopen = () => {
				if (ch) {
					const tlId = "light-" + Date.now();
					streamTlChannelId = tlId;
					ws.send(JSON.stringify({
						type: "connect",
						body: { channel: ch, id: tlId, params: params },
					}));
				}
				if (notificationsStreaming) {
					ws.send(JSON.stringify({
						type: "connect",
						body: { channel: "main", id: "light-main-" + Date.now(), params: {} },
					}));
				}
			};
			ws.onmessage = (ev) => {
				try {
					const msg = JSON.parse(ev.data);
					const chBody = msg.type === "channel" ? msg.body : null;
					const note = (msg.type === "note" ? msg.body?.body : chBody?.type === "note" ? chBody?.body : null);
					// チャンネル由来のノートは、現在アクティブなTLのチャンネルからのみ追加する
					const fromActiveTl = chBody?.type === "note" ? chBody?.id === streamTlChannelId : false;
					if (note && fromActiveTl && !notes.some((n) => n.id === note.id) && currentTl !== "notifications") {
						const container = document.getElementById("notes");
						if (container && !isWordMuted((note.renote || note).text || (note.renote || note).cw || "")) {
							notes = [note, ...notes];
							const showIcons = getSetting("showIcons", true);
							const frag = document.createRange().createContextualFragment(renderNote(note, showIcons));
							container.insertBefore(frag.firstChild, container.firstChild);
							bindNoteEvents(container);
						}
					}
					const noteUpdated = msg.type === "noteUpdated" ? msg.body : chBody?.type === "noteUpdated" ? chBody?.body : null;
					if (noteUpdated && noteUpdated.type === "deleted" && currentTl !== "notifications") {
						const id = noteUpdated.id;
						const body = noteUpdated.body || {};
						const idx = notes.findIndex((n) => n.id === id);
						if (idx >= 0) {
							const container = document.getElementById("notes");
							if (body.physical) {
								notes.splice(idx, 1);
								container?.querySelector(`.note[data-note-id="${id}"]`)?.remove();
							} else {
								notes[idx] = { ...notes[idx], deletedAt: body.deletedAt || new Date(), text: notes[idx].renoteId ? "QT" : "", cw: "", files: [] };
								if (container) {
									const el = container.querySelector(`.note[data-note-id="${id}"]`);
									if (el) {
										const showIcons = getSetting("showIcons", true);
										el.outerHTML = renderNote(notes[idx], showIcons);
										bindNoteEvents(container);
									}
								}
							}
						}
					}
					const fromChannel = chBody?.type === "notification" || chBody?.type === "unreadNotification";
					const notif = fromChannel ? chBody?.body : (msg.type === "notification" || msg.type === "unreadNotification" ? (msg.body?.body || msg.body) : null);
					if (notif) {
						notifications = [notif, ...notifications];
						if (getSetting("notifications", false)) {
							const id = notif.id != null ? notif.id : "n-" + Date.now() + "-" + Math.random();
							if (notif.id == null) notif._streamingId = id;
							streamingNotifications = [notif, ...streamingNotifications].slice(0, 20);
							renderStreamingNotifications();
							setTimeout(() => {
								streamingNotifications = streamingNotifications.filter((n) => (n.id != null ? n.id : n._streamingId) !== id);
								renderStreamingNotifications();
							}, STREAMING_NOTIFICATION_DISPLAY_MS);
						}
					}
				} catch (_) {}
			};
			ws.onclose = () => {
				streamWs = null;
				if ((getSetting("streaming", false) || getSetting("notifications", false)) && token) {
					streamReconnectTimer = setTimeout(updateStreamConnection, 5000);
				}
			};
			ws.onerror = () => { ws.close(); };
		} catch (_) {}
	}

	// ノート描画
	function escapeHtml(s) {
		if (!s) return "";
		const div = document.createElement("div");
		div.textContent = s;
		return div.innerHTML;
	}

	function getUserLabel(user) {
		const name = (user.name || "").trim() || `@${user.username}`;
		return `${name}@${user.username}${user.host ? `@${user.host}` : ""}`;
	}

	function getAcct(user) {
		return `@${user.username}${user.host ? `@${user.host}` : ""}`;
	}

	function getHiddenIconUserIds() {
		try {
			const v = localStorage.getItem(HIDDEN_ICON_KEY);
			return v ? JSON.parse(v) : [];
		} catch { return []; }
	}

	function setHiddenIconUserIds(ids) {
		localStorage.setItem(HIDDEN_ICON_KEY, JSON.stringify(ids));
	}

	function getAvatarUrl(user, showIcons) {
		if (!showIcons || !user) return null;
		const ids = getHiddenIconUserIds();
		if (ids.includes(user.id)) {
			const acct = getAcct(user).replace(/^@/, "");
			return `${window.location.origin}/avatar-alt/@${encodeURIComponent(acct)}`;
		}
		return user.avatarUrl || null;
	}

	/** テキスト内の:emoji:をクリック可能なplaceholder/imgに変換したHTMLを返す */
	function buildTextWithEmojiHtml(text, emojiMap) {
		if (!text || typeof text !== "string") return "";
		const re = /:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9.-]+))?:/g;
		const parts = [];
		let lastIdx = 0;
		let m;
		while ((m = re.exec(text))) {
			parts.push({ t: "text", s: text.slice(lastIdx, m.index) });
			parts.push({ t: "emoji", name: m[1], host: m[2] || "" });
			lastIdx = m.index + m[0].length;
		}
		parts.push({ t: "text", s: text.slice(lastIdx) });
		let safeText = "";
		parts.forEach((p) => {
			if (p.t === "text") safeText += escapeHtml(p.s);
			else {
				const key = p.host ? `${p.name}@${p.host}` : p.name;
				const emojiKey = `:${key}:`;
				const url = emojiMap[key] || emojiMap[p.name] || getEmojiUrl(emojiKey);
				if (url) {
					if (emojiDisplayedAsImageCache.has(emojiKey) || emojiDisplayedAsImageCache.has(key)) {
						safeText += `<img class="note-emoji-img" src="${escapeHtml(url)}" alt=":${escapeHtml(key)}:" style="height:1.25em;width:auto;vertical-align:middle;cursor:pointer" data-emoji-url="${escapeHtml(url)}" data-emoji-text=":${escapeHtml(key)}:">`;
					} else {
						safeText += `<span class="note-emoji-placeholder" data-emoji-url="${escapeHtml(url)}" title=":${escapeHtml(key)}:">:${escapeHtml(key)}:</span>`;
					}
				} else {
					safeText += escapeHtml(emojiKey);
				}
			}
		});
		return safeText;
	}

	function buildNoteContent(app, noteId, emojiMap) {
		const textContent = app.text || "";
		const re = /:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9.-]+))?:/g;
		const parts = [];
		let lastIdx = 0;
		let m;
		while ((m = re.exec(textContent))) {
			parts.push({ t: "text", s: textContent.slice(lastIdx, m.index) });
			parts.push({ t: "emoji", name: m[1], host: m[2] || "" });
			lastIdx = m.index + m[0].length;
		}
		parts.push({ t: "text", s: textContent.slice(lastIdx) });
		let safeText = "";
		parts.forEach((p) => {
			if (p.t === "text") safeText += escapeHtml(p.s);
			else {
				const key = p.host ? `${p.name}@${p.host}` : p.name;
				const emojiKey = `:${key}:`;
				const url = emojiMap[key] || emojiMap[p.name] || getEmojiUrl(emojiKey);
				if (url) {
					if (emojiDisplayedAsImageCache.has(emojiKey) || emojiDisplayedAsImageCache.has(key)) {
						safeText += `<img class="note-emoji-img" src="${escapeHtml(url)}" alt=":${escapeHtml(key)}:" style="height:1.25em;width:auto;vertical-align:middle;cursor:pointer" data-emoji-url="${escapeHtml(url)}" data-emoji-text=":${escapeHtml(key)}:">`;
					} else {
						safeText += `<span class="note-emoji-placeholder" data-emoji-url="${escapeHtml(url)}" title=":${escapeHtml(key)}:">:${escapeHtml(key)}:</span>`;
					}
				} else {
					safeText += escapeHtml(`:${key}:`);
				}
			}
		});
		const textHtml = `<div class="note-text" data-note-id="${noteId}">${safeText}</div>`;
		const files = (app.files || []).map((f) => {
			const label = f.type?.startsWith("image") ? "画像" : f.type?.startsWith("video") ? "動画" : "ファイル";
			return `<button class="note-file-btn" data-url="${escapeHtml(f.thumbnailUrl || f.url)}" data-type="${f.type || ""}">[${label}]</button>`;
		}).join("");
		const filesHtml = files ? `<div class="note-files">${files}</div>` : "";
		return { textHtml, filesHtml };
	}

	function renderTargetBlock(target, noteId) {
		const emojiMap = {};
		(target.emojis || []).forEach((e) => {
			emojiMap[e.name] = e.url;
			if (e.name && e.name.includes("@")) emojiMap[e.name] = e.url;
		});
		const { textHtml, filesHtml } = buildNoteContent(target, noteId, emojiMap);
		let html = "";
		if (target.deletedAt) {
			html += `<div class="note-deleted" style="opacity:0.5">(削除済み)${target.text ? ` <${escapeHtml(target.text)}>` : ""}</div>`;
		} else if (target.cw) {
			html += `<div class="note-cw" data-note-id="${noteId}" data-cw-expanded="false">${escapeHtml(target.cw)}（タップで展開）</div>`;
			html += `<div class="note-cw-body" data-note-id="${noteId}" style="display:none">${textHtml}${filesHtml}</div>`;
		} else {
			html += textHtml + filesHtml;
		}
		return html;
	}

	function renderNotes() {
		const container = document.getElementById("notes");
		if (!container) return;
		const showIcons = getSetting("showIcons", true);
		const keywords = getWordMuteKeywords();
		container.innerHTML = notes
			.filter((n) => {
				const text = (n.renote || n).text || (n.renote || n).cw || "";
				return !isWordMuted(text);
			})
			.map((note) => renderNote(note, showIcons))
			.join("");
		bindNoteEvents(container);
	}

	function renderNote(note, showIcons) {
		const isReply = note.replyId && note.reply;
		const isRenote = note.renoteId && note.renote;
		const isQuote = isRenote && (note.text || (note.files && note.files.length > 0));

		const headerUser = note.user;
		const target = isReply ? note.reply : isRenote ? note.renote : null;
		const mainContent = isReply || isQuote ? note : (note.renote || note);
		const targetCwId = target ? `${note.id}-target` : null;

		const avatar = getAvatarUrl(headerUser, showIcons)
			? `<img class="note-avatar" src="${escapeHtml(getAvatarUrl(headerUser, showIcons))}" alt="" width="40" height="40">`
			: "";

		// CLI 同様の Unicode 絵文字（localOnly 時は ♥ を前置）
		const visEmoji = (v, localOnly) => {
			const prefix = localOnly ? "♥" : "";
			return prefix + (v === "home" ? "🏠" : v === "followers" ? "🔒" : v === "specified" ? "✉" : v === "public" ? "🌐" : v === "private" ? "🔐" : "");
		};
		const visLabel = note.visibility ? visEmoji(note.visibility, !!note.localOnly) : "";
		const userName = (headerUser?.name || "").trim() || (headerUser?.username ? `@${headerUser.username}` : "");
		const userAcct = headerUser ? getAcct(headerUser) : "";
		let html = `<div class="note" data-note-id="${note.id}"><div class="note-header">${avatar}<div class="note-user-info note-user" data-user-id="${headerUser?.id}"><span class="note-user-name">${escapeHtml(userName)}</span><span class="note-user-acct">${escapeHtml(userAcct)}</span></div><span class="note-meta">${visLabel ? `<span class="note-visibility">${escapeHtml(visLabel)}</span> ` : ""}</span></div>`;

		// 自分のブロック（引用・返信の場合のみ）: CW → コメント → ファイル
		if ((isQuote || isReply) && (mainContent.text || mainContent.cw || (mainContent.files && mainContent.files.length > 0))) {
			const emojiMap = {};
			(mainContent.emojis || []).forEach((e) => {
				emojiMap[e.name] = e.url;
				if (e.name && e.name.includes("@")) emojiMap[e.name] = e.url;
			});
			const { textHtml, filesHtml } = buildNoteContent(mainContent, note.id, emojiMap);
			if (mainContent.deletedAt) {
				html += `<div class="note-deleted" style="opacity:0.5">(削除済み)${mainContent.text ? ` <${escapeHtml(mainContent.text)}>` : ""}</div>`;
			} else if (mainContent.cw) {
				html += `<div class="note-cw" data-note-id="${note.id}" data-cw-expanded="false">${escapeHtml(mainContent.cw)}（タップで展開）</div>`;
				html += `<div class="note-cw-body" data-note-id="${note.id}" style="display:none">${textHtml}${filesHtml}</div>`;
			} else {
				html += textHtml + filesHtml;
			}
		}

		// RT行/返信先行 → ターゲットブロック
		if (target) {
			const targetUser = target.user;
			const targetAvatar = getAvatarUrl(targetUser, showIcons)
				? `<img class="note-avatar note-target-avatar" src="${escapeHtml(getAvatarUrl(targetUser, showIcons))}" alt="" width="32" height="32">`
				: "";
			const label = isReply ? `返信先 ${escapeHtml(getAcct(targetUser))}` : `RT ${escapeHtml(getAcct(targetUser))}`;
			html += `<div class="note-rt-row">${targetAvatar}<span class="note-rt-label">${label}</span></div>`;
			html += renderTargetBlock(target, targetCwId);
		}

		// 通常ノート（RTでも引用でも返信でもない）
		if (!target) {
			const app = note;
			if (app.deletedAt) {
				html += `<div class="note-deleted" style="opacity:0.5">(削除済み)${app.text ? ` <${escapeHtml(app.text)}>` : ""}</div>`;
			} else if (app.cw) {
				const emojiMap = {};
				(app.emojis || []).forEach((e) => {
					emojiMap[e.name] = e.url;
					if (e.name && e.name.includes("@")) emojiMap[e.name] = e.url;
				});
				const { textHtml, filesHtml } = buildNoteContent(app, note.id, emojiMap);
				html += `<div class="note-cw" data-note-id="${note.id}" data-cw-expanded="false">${escapeHtml(app.cw)}（タップで展開）</div>`;
				html += `<div class="note-cw-body" data-note-id="${note.id}" style="display:none">${textHtml}${filesHtml}</div>`;
			} else {
				const emojiMap = {};
				(app.emojis || []).forEach((e) => {
					emojiMap[e.name] = e.url;
					if (e.name && e.name.includes("@")) emojiMap[e.name] = e.url;
				});
				const { textHtml, filesHtml } = buildNoteContent(app, note.id, emojiMap);
				html += textHtml + filesHtml;
			}
		}

		const reactionsHtml = (() => {
			const entries = Object.entries(note.reactions || {});
			if (entries.length === 0) return "";
			const emojiMap = {};
			((note.renote || note).emojis || []).forEach((e) => {
				emojiMap[e.name] = e.url;
				if (e.name && e.name.includes("@")) emojiMap[e.name] = e.url;
			});
			const parts = entries.map(([r, c]) => {
				const m = /^:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9.-]+))?:$/.exec(r);
				if (m) {
					const key = m[2] ? `${m[1]}@${m[2]}` : m[1];
					// NOTE: ローカル絵文字はnote.emojisに含まれないため、getEmojiUrlでemojiUrlCacheから補完する
					const url = emojiMap[key] || emojiMap[m[1]] || getEmojiUrl(r);
					if (url) {
						if (emojiDisplayedAsImageCache.has(r) || emojiDisplayedAsImageCache.has(key)) {
							return `<img class="note-emoji-img" src="${escapeHtml(url)}" alt="${escapeHtml(r)}" style="height:1.25em;width:auto;vertical-align:middle;cursor:pointer" data-emoji-url="${escapeHtml(url)}" data-emoji-text="${escapeHtml(r)}">×${c}`;
						}
						return `<span class="note-emoji-placeholder" data-emoji-url="${escapeHtml(url)}" title="${escapeHtml(r)}">${escapeHtml(r)}</span>×${c}`;
					}
				}
				return `${escapeHtml(r)}×${c}`;
			});
			return `<div class="note-reactions">${parts.join(" ")}</div>`;
		})();
		if (reactionsHtml) html += reactionsHtml;
		const createdAt = note.createdAt ? (() => {
			const d = new Date(note.createdAt);
			const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
			const h = String(d.getHours()).padStart(2, "0"), min = String(d.getMinutes()).padStart(2, "0"), sec = String(d.getSeconds()).padStart(2, "0");
			return `${y}/${m}/${day} ${h}:${min}:${sec}`;
		})() : "";
		if (createdAt) html += `<div class="note-created-at">${escapeHtml(createdAt)}</div>`;

		const actionNoteId = (isRenote && !isQuote) ? note.renote.id : note.id;
		const loggedIn = !!token;
		let actionsHtml = `<div class="note-actions">`;
		if (loggedIn) {
			actionsHtml += `<button class="note-reply" data-note-id="${actionNoteId}">返信</button>
			<button class="note-reaction" data-note-id="${actionNoteId}">リアクション</button>
			<button class="note-rt" data-note-id="${actionNoteId}">RT/引用</button>
			${note.userId === currentAccount?.id ? `<button class="note-delete" data-note-id="${note.id}">削除</button>` : ""}`;
		}
		actionsHtml += `<button class="note-detail" data-note-id="${actionNoteId}">詳細</button>`;
		if (isReply && note.reply) {
			actionsHtml += ` <button class="note-detail-target" data-note-id="${note.reply.id}">詳細(返信先)</button>`;
		} else if (isQuote && note.renote) {
			actionsHtml += ` <button class="note-detail-target" data-note-id="${note.renote.id}">詳細(引用先)</button>`;
		}
		actionsHtml += `</div></div>`;
		html += actionsHtml;
		return html;
	}

	function bindNoteEvents(container) {
		if (!container) return;
		const showIcons = getSetting("showIcons", true);
		// NOTE: アイコン表示 ON 時は src で即時読み込み。data-src による遅延読み込みは廃止。
		container.querySelectorAll(".note-cw").forEach((el) => {
			el.addEventListener("click", () => {
				const expanded = el.dataset.cwExpanded === "true";
				const body = container.querySelector(`.note-cw-body[data-note-id="${el.dataset.noteId}"]`);
				if (body) {
					body.style.display = expanded ? "none" : "block";
					el.dataset.cwExpanded = expanded ? "false" : "true";
					el.textContent = expanded
						? el.textContent.replace("（タップで折り畳み）", "（タップで展開）")
						: el.textContent.replace("（タップで展開）", "（タップで折り畳み）");
				}
			});
		});
		const bindEmojiPlaceholder = (span) => {
			span.addEventListener("click", (e) => {
				e.stopPropagation();
				const url = span.dataset.emojiUrl;
				if (!url) return;
				const text = span.textContent || span.title || "";
				emojiDisplayedAsImageCache.add(text);
				const m = /^:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9.-]+))?:$/.exec(text);
				if (m) emojiDisplayedAsImageCache.add(m[2] ? `${m[1]}@${m[2]}` : m[1]);
				const img = document.createElement("img");
				img.src = url;
				img.alt = text;
				img.className = "note-emoji-img";
				img.dataset.emojiUrl = url;
				img.dataset.emojiText = text;
				img.style.height = "1.25em";
				img.style.width = "auto";
				img.style.verticalAlign = "middle";
				img.style.cursor = "pointer";
				img.addEventListener("click", (e) => {
					e.stopPropagation();
					const span2 = document.createElement("span");
					span2.className = "note-emoji-placeholder";
					span2.dataset.emojiUrl = url;
					span2.title = text;
					span2.textContent = text;
					bindEmojiPlaceholder(span2);
					img.replaceWith(span2);
				});
				span.replaceWith(img);
			});
		};
		container.querySelectorAll(".note-emoji-placeholder").forEach(bindEmojiPlaceholder);
		container.querySelectorAll(".note-emoji-img").forEach((img) => {
			const url = img.dataset.emojiUrl;
			const text = img.dataset.emojiText;
			if (!url || !text) return;
			img.style.cursor = "pointer";
			img.addEventListener("click", (e) => {
				e.stopPropagation();
				const span = document.createElement("span");
				span.className = "note-emoji-placeholder";
				span.dataset.emojiUrl = url;
				span.title = text;
				span.textContent = text;
				bindEmojiPlaceholder(span);
				img.replaceWith(span);
			});
		});
		container.querySelectorAll(".note-file-btn").forEach((btn) => {
			btn.addEventListener("click", () => {
				const url = btn.dataset.url;
				const type = btn.dataset.type || "";
				if (type.startsWith("image")) {
					const img = document.createElement("img");
					img.src = url;
					img.alt = "";
					btn.replaceWith(img);
				} else if (type.startsWith("video")) {
					const v = document.createElement("video");
					v.src = url;
					v.controls = true;
					btn.replaceWith(v);
				} else {
					window.open(url);
				}
			});
		});
		container.querySelectorAll(".note-user").forEach((el) => {
			el.addEventListener("click", () => openProfile(el.dataset.userId));
		});
		container.querySelectorAll(".note-detail, .note-detail-target").forEach((el) => {
			el.addEventListener("click", (e) => { e.stopPropagation(); openNoteDetail(el.dataset.noteId); });
		});
		container.querySelectorAll(".note-reply").forEach((el) => {
			el.addEventListener("click", (e) => { e.stopPropagation(); setReplyMode(el.dataset.noteId); });
		});
		container.querySelectorAll(".note-reaction").forEach((el) => {
			el.addEventListener("click", (e) => { e.stopPropagation(); openReactionPicker(el.dataset.noteId); });
		});
		container.querySelectorAll(".note-rt").forEach((el) => {
			el.addEventListener("click", (e) => { e.stopPropagation(); setRenoteMode(el.dataset.noteId); });
		});
		container.querySelectorAll(".note-delete").forEach((el) => {
			el.addEventListener("click", (e) => { e.stopPropagation(); deleteNote(el.dataset.noteId); });
		});
	}

	// 投稿フォーム
	let replyNoteId = null;
	let renoteNoteId = null;
	let dmUserIds = null;
	/** @type {Record<string,{username:string,host?:string}>} */
	let dmUserCache = {};

	function initPostForm() {
		const text = document.getElementById("post-text");
		const cwArea = document.getElementById("post-cw-area");
		const cwToggle = document.getElementById("post-cw-toggle");
		if (cwToggle && cwArea) {
			cwToggle.onclick = () => {
				const show = cwArea.style.display !== "none";
				cwArea.style.display = show ? "none" : "block";
				debounceSaveDraft();
			};
		}
		const draft = loadDraft();
		if (draft) {
			if (text) text.value = draft.text || "";
			document.getElementById("post-cw").value = draft.cw || "";
			document.getElementById("post-cw-area").style.display = draft.cw ? "block" : "none";
			document.getElementById("post-visibility").value = draft.visibility || "public";
			document.getElementById("post-local-only").checked = !!draft.localOnly;
			if (draft.replyId) setReplyMode(draft.replyId, true);
			if (draft.renoteId) setRenoteMode(draft.renoteId, true);
			if (draft.dmUserIds?.length) {
				dmUserIds = draft.dmUserIds;
				document.getElementById("post-visibility").value = "specified";
			}
		} else {
			const lv = loadLastVisibility();
			if (lv) {
				document.getElementById("post-visibility").value = lv.visibility || "home";
				document.getElementById("post-local-only").checked = !!lv.localOnly;
			} else {
				document.getElementById("post-visibility").value = currentTl === "home" ? "home" : "public";
				document.getElementById("post-local-only").checked = getSetting("defaultLocalOnly", false);
			}
		}
		renderPostAttributes();
		debounceSaveDraft();
	}

	function truncatePreview(str, maxLen = 40) {
		if (!str || typeof str !== "string") return "";
		const s = str.replace(/\s+/g, " ").trim();
		return s.length <= maxLen ? s : s.slice(0, maxLen) + "…";
	}

	function renderPostAttributes() {
		const attr = document.getElementById("post-attributes");
		if (!attr) return;
		const items = [];
		if (replyNoteId) {
			const note = getNoteById(replyNoteId);
			const target = note;
			const preview = target ? truncatePreview((target.cw || target.text || "")) : "";
			items.push({ type: "reply", id: replyNoteId, label: "返信" + (preview ? `: ${escapeHtml(preview)}` : ""), rawPreview: preview });
		}
		if (renoteNoteId) {
			const note = getNoteById(renoteNoteId);
			const target = note?.renote || note;
			const preview = target ? truncatePreview((target.cw || target.text || "")) : "";
			items.push({ type: "renote", id: renoteNoteId, label: "引用/RT" + (preview ? `: ${escapeHtml(preview)}` : ""), rawPreview: preview });
		}
		if (dmUserIds?.length) {
			const missing = dmUserIds.filter((id) => !dmUserCache[id]);
			if (missing.length > 0) {
				Promise.all(missing.map((id) => api("users/show", { userId: id }).catch(() => null))).then((users) => {
					users.forEach((u, i) => { if (u && missing[i]) dmUserCache[missing[i]] = { username: u.username || "", host: u.host }; });
					renderPostAttributes();
				});
			}
			const accts = dmUserIds.map((id) => {
				const u = dmUserCache[id];
				return u ? getAcct(u) : null;
			}).filter(Boolean);
			const label = accts.length ? `DM → ${accts.join(", ")}` : "DM";
			items.push({ type: "dm", label });
		}
		attr.innerHTML = items.map((i) => `
			<span class="attr-item">
				${i.label}
				<button type="button" class="attr-remove" data-type="${i.type}">×</button>
			</span>
		`).join("");
		attr.querySelectorAll(".attr-remove").forEach((b) => {
			b.addEventListener("click", () => {
				if (b.dataset.type === "reply") replyNoteId = null;
				if (b.dataset.type === "renote") renoteNoteId = null;
				if (b.dataset.type === "dm") { dmUserIds = null; dmUserCache = {}; }
				renderPostAttributes();
				saveDraftFromForm();
			});
		});
	}

	async function setReplyMode(noteId, silent) {
		replyNoteId = noteId;
		renoteNoteId = null;
		dmUserIds = null;
		renderPostAttributes();
		if (!silent) {
			loadDraft();
			const note = getNoteById(noteId);
			if (note && note.user) {
				const username = note.user.username || "";
				const host = note.user.host || "";
				const mention = host ? `@${username}@${host} ` : `@${username} `;
				const textarea = document.getElementById("post-text");
				if (textarea && !textarea.value.includes(mention.trim())) {
					textarea.value = mention + textarea.value;
					textarea.focus();
				}
			}
		}
	}

	function setRenoteMode(noteId, silent) {
		renoteNoteId = noteId;
		replyNoteId = null;
		dmUserIds = null;
		renderPostAttributes();
		if (!silent) loadDraft();
	}

	function setDmMode(userIds, userInfo) {
		dmUserIds = Array.isArray(userIds) ? userIds : [];
		if (userInfo && userInfo.id) dmUserCache[userInfo.id] = { username: userInfo.username || "", host: userInfo.host };
		replyNoteId = null;
		renoteNoteId = null;
		document.getElementById("post-visibility").value = "specified";
		renderPostAttributes();
	}

	let draftSaveTimer = null;
	function debounceSaveDraft() {
		if (draftSaveTimer) clearTimeout(draftSaveTimer);
		draftSaveTimer = setTimeout(saveDraftFromForm, 500);
	}

	function saveDraftFromForm() {
		const text = document.getElementById("post-text")?.value || "";
		const cwEl = document.getElementById("post-cw");
		const visEl = document.getElementById("post-visibility");
		const localEl = document.getElementById("post-local-only");
		if (!text && !replyNoteId && !renoteNoteId && !dmUserIds?.length) {
			clearDraft();
			return;
		}
		saveDraft({
			text,
			cw: cwEl?.value || "",
			visibility: visEl?.value || "public",
			localOnly: localEl?.checked || false,
			replyId: replyNoteId || undefined,
			renoteId: renoteNoteId || undefined,
			dmUserIds: dmUserIds || undefined,
		});
	}

	async function submitPost() {
		const text = document.getElementById("post-text")?.value?.trim() || "";
		const cwArea = document.getElementById("post-cw-area");
		const cw = cwArea?.style.display !== "none" ? (document.getElementById("post-cw")?.value?.trim() || "") : "";
		const visibility = document.getElementById("post-visibility")?.value || "public";
		const localOnly = document.getElementById("post-local-only")?.checked || false;
		const body = {
			visibility: dmUserIds?.length ? "specified" : visibility,
			localOnly,
		};
		if (dmUserIds?.length) body.visibleUserIds = dmUserIds;
		if (replyNoteId) body.replyId = replyNoteId;
		if (renoteNoteId) {
			body.renoteId = renoteNoteId;
			if (text) body.text = text;
		} else {
			if (cw) body.cw = cw;
			if (text) body.text = text;
		}
		await api("notes/create", body);
		clearDraft();
		document.getElementById("post-text").value = "";
		document.getElementById("post-cw").value = "";
		replyNoteId = null;
		renoteNoteId = null;
		dmUserIds = null;
		renderPostAttributes();
		saveLastVisibility(visibility, localOnly);
		loadCurrentTl();
	}

	// リアクション・削除
	async function openReactionPicker(noteId) {
		await fetchEmojiUrlCache();
		const overlay = document.getElementById("modal-overlay");
		const body = document.getElementById("modal-body");
		let note = getNoteById(noteId);
		if (!note) {
			try { note = await api("notes/show", { noteId }); } catch (_) {}
		}
		const reactions = note?.reactions || {};
		const myReaction = note?.myReaction || "";

		async function toggleReaction(reaction) {
			const r = (reaction && !reaction.startsWith(":")) && reaction.length > 2 ? `:${reaction}:` : (reaction || "👍");
			const hasIt = myReaction === r;
			try {
				if (hasIt) await api("notes/reactions/delete", { noteId });
				else await api("notes/reactions/create", { noteId, reaction: r });
				overlay.style.display = "none";
				loadCurrentTl();
			} catch (_) {}
		}

		const emojiDisplayAttrs = (str) => {
			const norm = str && !str.startsWith(":") ? `:${str}:` : str;
			const url = getEmojiUrl(norm || str);
			return url ? ` data-emoji-url="${escapeHtml(url)}"` : "";
		};
		const existingHtml = Object.keys(reactions).length
			? `<div class="reaction-existing"><span style="font-size:0.85rem;color:var(--lc-muted)">既存のリアクション</span><div class="emoji-picker-vertical" style="margin-top:0.25rem">${
				Object.entries(reactions).map(([r, c]) => {
					const active = myReaction === r ? " active" : "";
					return `<div class="emoji-picker-row"><span class="emoji-picker-display${active}" data-emoji="${escapeHtml(r)}"${emojiDisplayAttrs(r)}>${escapeHtml(r)}×${c}</span><button type="button" class="emoji-picker-use" data-emoji="${escapeHtml(r)}">使用</button></div>`;
				}).join("")
			}</div></div>`
			: "";

		const manualHtml = `<div class="reaction-manual" style="margin:0.5rem 0"><label style="font-size:0.85rem;color:var(--lc-muted)">手動入力（:emoji:形式）</label><input type="text" id="reaction-manual-input" placeholder=":sushi:" style="width:100%;padding:0.25rem;margin-top:0.25rem"><button type="button" id="reaction-manual-submit" style="margin-top:0.25rem">追加</button></div>`;

		const emojis = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "[]");
		const emojiButtons = emojis.length === 0
			? `<button type="button" id="emoji-fetch-btn">よく使う絵文字を取得</button>`
			: `<span style="font-size:0.85rem;color:var(--lc-muted)">よく使う絵文字</span><div class="emoji-picker-vertical post-emoji-picker" style="margin-top:0.25rem">${emojis.map((e) => {
				const s = typeof e === "string" ? e : (e?.name ? `:${e.name}:` : (e?.name || e));
				return `<div class="emoji-picker-row"><span class="emoji-picker-display" data-emoji="${escapeHtml(s)}"${emojiDisplayAttrs(s)}>${escapeHtml(s)}</span><button type="button" class="emoji-picker-use" data-emoji="${escapeHtml(s)}">使用</button></div>`;
			}).join("")}</div>`;

		body.innerHTML = `<h3>リアクション</h3>${existingHtml}${manualHtml}<div class="reaction-frequent">${emojiButtons}</div>`;
		overlay.style.display = "flex";

		body.querySelectorAll(".reaction-existing-btn").forEach((btn) => {
			btn.addEventListener("click", () => toggleReaction(btn.dataset.emoji));
		});
		body.querySelector("#reaction-manual-submit")?.addEventListener("click", () => {
			const v = (body.querySelector("#reaction-manual-input")?.value || "").trim();
			if (v) { toggleReaction(v); }
		});
		body.querySelector("#emoji-fetch-btn")?.addEventListener("click", async () => {
			try {
				await fetchEmojis();
				openReactionPicker(noteId);
			} catch (_) {}
		});
		body.querySelectorAll(".emoji-picker-use[data-emoji]").forEach((btn) => {
			btn.addEventListener("click", () => toggleReaction(btn.dataset.emoji));
		});
		body.querySelectorAll(".emoji-picker-display[data-emoji-url]").forEach((span) => {
			span.addEventListener("click", (e) => {
				if (span.querySelector("img")) return;
				e.stopPropagation();
				const url = span.dataset.emojiUrl;
				if (!url) return;
				const text = span.textContent || "";
				span.dataset.emojiText = text;
				const img = document.createElement("img");
				img.src = url;
				img.alt = text;
				img.style.height = "1.25em";
				img.style.width = "auto";
				img.style.verticalAlign = "middle";
				img.style.cursor = "pointer";
				span.textContent = "";
				span.appendChild(img);
				img.addEventListener("click", (ev) => {
					ev.stopPropagation();
					img.remove();
					span.textContent = span.dataset.emojiText || "";
				});
			});
		});
	}

	async function deleteNote(noteId) {
		const note = getNoteById(noteId);
		if (!note) return;
		if (note.renoteId) {
			const ok = confirm("投稿を削除しますか？アンリノートしますか？\nOK=削除, Cancel=アンリノート");
			if (ok) await api("notes/delete", { noteId });
			else await api("notes/unrenote", { noteId });
		} else {
			if (!confirm("削除しますか？")) return;
			await api("notes/delete", { noteId });
		}
		loadCurrentTl();
	}

	// プロフィール・ノート詳細（モーダル）
	function openProfile(userId) {
		api("users/show", { userId })
			.then((user) => {
				const rel = user.relation;
				const hasRelation = rel != null && typeof rel === "object";
				const overlay = document.getElementById("modal-overlay");
				const body = document.getElementById("modal-body");
				const desc = (user.description || "").replace(/<[^>]+>/g, "").trim() || "";
				const hiddenIds = getHiddenIconUserIds();
				const isIconHidden = hiddenIds.includes(userId);

				const normalActions = [];
				if (hasRelation && rel.hasPendingFollowRequestFromYou) {
					normalActions.push({ label: "フォローリクエスト中", disabled: true });
				} else if (hasRelation && !rel.isFollowing) {
					normalActions.push({ label: "フォロー", action: () => api("following/create", { userId }) });
				}
				if (hasRelation && rel.hasPendingFollowRequestToYou) {
					normalActions.push({ label: "フォローリクエスト承認", action: () => api("following/requests/accept", { userId }) });
					normalActions.push({ label: "フォローリクエスト却下", action: () => api("following/requests/reject", { userId }) });
				}
				if (token) {
					normalActions.push({ label: "DM", action: () => { setDmMode([userId], user); hideModal(); } });
				}
				if (hasRelation) {
					normalActions.push({ label: rel.isMuted ? "ミュート解除" : "ミュート", action: () => rel.isMuted ? api("mute/delete", { userId }) : api("mute/create", { userId }) });
				}
				if (token) {
					normalActions.push({ label: "ニックネーム編集", action: async () => {
						const name = prompt("ニックネーム", user.name || "");
						if (name != null) await api("users/update-memo", { userId, customName: name });
					} });
				}
				normalActions.push({ label: isIconHidden ? "アイコン非表示を解除" : "アイコンを非表示", action: () => {
					if (isIconHidden) {
						setHiddenIconUserIds(hiddenIds.filter((id) => id !== userId));
					} else {
						setHiddenIconUserIds([...hiddenIds, userId]);
					}
					hideModal();
					loadCurrentTl();
				} });
				if (hasRelation) {
					normalActions.push({ label: rel.isRenoteMuted ? "RTミュート解除" : "RTだけミュート", action: () => rel.isRenoteMuted ? api("renote-mute/delete", { userId }) : api("renote-mute/create", { userId }) });
				}

				const dangerousActions = [];
				if (hasRelation) {
					if (rel.isFollowing) dangerousActions.push({ label: "フォロー解除", action: () => { if (confirm("フォローを解除しますか？")) return api("following/delete", { userId }); } });
					dangerousActions.push({ label: rel.isBlocking ? "ブロック解除" : "ブロック", action: () => { if (confirm(rel.isBlocking ? "ブロックを解除しますか？" : "ブロックしますか？")) return rel.isBlocking ? api("blocking/delete", { userId }) : api("blocking/create", { userId }); } });
					if (rel.isFollowed) dangerousActions.push({ label: "フォロワー解除", action: () => { if (confirm("フォロワーから削除しますか？")) return api("following/invalidate", { userId }); } });
				}

				const emojiMap = {};
				(user.emojis || []).forEach((e) => {
					if (e.name && e.url) {
						emojiMap[e.name] = e.url;
						if (e.name.includes("@")) emojiMap[e.name] = e.url;
					}
				});
				const showIcons = getSetting("showIcons", true);
				const avatar = getAvatarUrl(user, showIcons)
					? `<img class="note-avatar" src="${escapeHtml(getAvatarUrl(user, showIcons))}" alt="" width="40" height="40">`
					: "";
				const userName = (user.name || "").trim() || (user.username ? `@${user.username}` : "");
				const userAcct = getAcct(user);
				let html = `<div class="note-header" style="margin-bottom:0.75rem">${avatar}<div class="note-user-info note-user" data-user-id="${user.id}"><span class="note-user-name">${buildTextWithEmojiHtml(userName, emojiMap)}</span><span class="note-user-acct">${escapeHtml(userAcct)}</span></div></div>`;
				if (desc) html += `<div class="profile-description" style="white-space:pre-wrap;margin:0.5rem 0;font-size:0.9rem">${buildTextWithEmojiHtml(desc, emojiMap)}</div>`;
				const fields = user.fields || [];
				if (fields.length > 0) {
					html += `<div class="profile-fields" style="margin:0.5rem 0;font-size:0.9rem">`;
					fields.forEach((f) => {
						const label = (f.name || "").trim() || "";
						const raw = (f.value || "").replace(/<[^>]+>/g, "").trim() || "";
						if (!raw) return;
						const labelPart = label ? `<span class="profile-field-name" style="font-weight:bold;color:var(--lc-muted)">${escapeHtml(label)}</span>: ` : "";
						html += `<div class="profile-field" style="margin:0.25rem 0">${labelPart}<span class="profile-field-value">${buildTextWithEmojiHtml(raw, emojiMap)}</span></div>`;
					});
					html += `</div>`;
				}
				html += `<ul class="profile-actions-list">`;
				normalActions.forEach((a) => {
					html += `<li data-action${a.disabled ? ' style="opacity:0.7;cursor:default"' : ""}>${escapeHtml(a.label)}</li>`;
				});
				if (dangerousActions.length > 0) {
					html += `<li data-dangerous-toggle class="profile-dangerous-toggle" style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--lc-border);font-size:0.85rem;color:var(--lc-muted)">危険な操作</li>`;
					html += `</ul><ul class="profile-actions-list profile-dangerous-list" data-dangerous-sublist style="display:none;margin-top:0.25rem;padding-left:1rem">`;
					dangerousActions.forEach((a) => {
						html += `<li data-dangerous>${escapeHtml(a.label)}</li>`;
					});
				}
				html += `</ul>`;

				body.innerHTML = html;
				bindNoteEvents(body);
				const normalItems = Array.from(body.querySelectorAll(".profile-actions-list:not(.profile-dangerous-list) li[data-action]"));
				const toggleBtn = body.querySelector("[data-dangerous-toggle]");
				const dangerousSublist = body.querySelector("[data-dangerous-sublist]");
				const dangerousItems = Array.from(body.querySelectorAll(".profile-dangerous-list li[data-dangerous]"));
				normalItems.forEach((li, i) => {
					const a = normalActions[i];
					if (a && !a.disabled && a.action) {
						li.addEventListener("click", () => a.action().then(() => { hideModal(); loadCurrentTl(); }).catch(() => {}));
					}
				});
				if (toggleBtn && dangerousSublist) {
					toggleBtn.addEventListener("click", () => {
						const visible = dangerousSublist.style.display !== "none";
						dangerousSublist.style.display = visible ? "none" : "block";
					});
				}
				dangerousItems.forEach((li, i) => {
					const a = dangerousActions[i];
					if (a) li.addEventListener("click", () => a.action().then(() => { hideModal(); loadCurrentTl(); }).catch(() => {}));
				});
				overlay.style.display = "flex";
			})
			.catch((e) => showError(e?.message || "ユーザー取得失敗"));
	}

	async function openNoteDetail(noteId) {
		try {
			const [target, conv, replies] = await Promise.all([
				api("notes/show", { noteId }),
				api("notes/conversation", { noteId, limit: 100 }),
				api("notes/replies", { noteId, limit: 30 }),
			]);
			const parents = Array.isArray(conv) ? conv : [];
			const replyList = Array.isArray(replies) ? replies : [];
			const thread = [...parents, target, ...replyList];
			const overlay = document.getElementById("modal-overlay");
			const body = document.getElementById("modal-body");
			const showIcons = getSetting("showIcons", true);
			body.innerHTML = thread.filter(Boolean).map((n) => renderNote(n, showIcons)).join("");
			overlay.style.display = "flex";
			bindNoteEvents(body);
		} catch (e) {
			showError(e?.message || "取得失敗");
		}
	}

	function hideModal() {
		document.getElementById("modal-overlay").style.display = "none";
	}

	// 検索
	async function openSearch() {
		const overlay = document.getElementById("modal-overlay");
		const body = document.getElementById("modal-body");
		body.innerHTML = `
			<h3>検索</h3>
			<input type="text" id="search-query" placeholder="キーワード" style="width:100%;padding:0.5rem;margin:0.5rem 0">
			<div style="display:flex;gap:0.5rem;margin:0.5rem 0">
				<button id="search-notes-btn">ノート検索</button>
				<button id="search-users-btn">ユーザー検索</button>
			</div>
			<div id="search-results"></div>
		`;
		overlay.style.display = "flex";
		document.getElementById("search-notes-btn")?.addEventListener("click", async () => {
			const q = document.getElementById("search-query")?.value?.trim();
			if (!q) { showError("キーワードを入力してください"); return; }
			try {
				const data = await api("notes/search", { query: q, limit: 20 });
				const showIcons = getSetting("showIcons", true);
				const results = document.getElementById("search-results");
				results.innerHTML = (data || []).length
					? (data || []).map((n) => renderNote(n, showIcons)).join("")
					: "<p>見つかりませんでした</p>";
				bindNoteEvents(results);
			} catch (e) {
				showError(e?.message || "検索失敗");
			}
		});
		document.getElementById("search-users-btn")?.addEventListener("click", async () => {
			const q = document.getElementById("search-query")?.value?.trim();
			if (!q) { showError("キーワードを入力してください"); return; }
			try {
				const data = await api("users/search", { query: q, limit: 20 });
				const results = document.getElementById("search-results");
				results.innerHTML = (data || []).length
					? (data || []).map((u) => `
						<div class="note" style="cursor:pointer" data-user-id="${u.id}">
							<span class="note-user">${escapeHtml(getUserLabel(u))}</span>
						</div>
					`).join("")
					: "<p>見つかりませんでした</p>";
				results.querySelectorAll(".note[data-user-id]").forEach((el) => {
					el.addEventListener("click", () => {
						openProfile(el.dataset.userId);
					});
				});
			} catch (e) {
				showError(e?.message || "検索失敗");
			}
		});
	}

	// 設定パネル
	function updateDefaultVisibilitySectionVisibility() {
		const rem = document.getElementById("setting-remember-visibility")?.checked ?? true;
		const vis = document.getElementById("default-visibility-section");
		const loc = document.getElementById("default-local-section");
		if (vis) vis.style.display = rem ? "none" : "block";
		if (loc) loc.style.display = rem ? "none" : "block";
	}

	function initSettings() {
		document.getElementById("setting-show-icons").checked = getSetting("showIcons", true);
		document.getElementById("setting-notifications").checked = getSetting("notifications", false);
		document.getElementById("setting-remember-visibility").checked = getSetting("rememberVisibility", true);
		document.getElementById("setting-default-visibility").value = getSetting("defaultVisibility", "public");
		document.getElementById("setting-default-local-only").checked = getSetting("defaultLocalOnly", false);
		document.getElementById("setting-word-mute").value = getSetting("wordMute", "") || "";
		updateDefaultVisibilitySectionVisibility();
	}

	// 絵文字取得（users/emoji-stats でログインユーザーのよく使う絵文字を取得）
	async function fetchEmojis() {
		try {
			if (!currentAccount?.id) {
				localStorage.setItem(REACTIONS_KEY, "[]");
				return;
			}
			const data = await api("users/emoji-stats", { userId: currentAccount.id, limit: 50 });
			const list = data?.recentlySentReactions || [];
			const names = list.map((x) => (typeof x === "string" ? x : x?.name || "")).filter(Boolean);
			localStorage.setItem(REACTIONS_KEY, JSON.stringify(names));
			showError("絵文字を取得しました");
			setTimeout(hideError, 2000);
		} catch (e) {
			showError(e?.message || "絵文字取得失敗");
		}
	}

	async function fetchEmojiUrlCache() {
		if (Object.keys(emojiUrlCache).length > 0) return;
		try {
			const meta = await api("meta", { detail: false });
			const list = meta?.emojis || [];
			const arr = Array.isArray(list) ? list : (list.default || []).concat(...Object.values(list).filter(Array.isArray).flat());
			emojiUrlCache = {};
			arr.forEach((e) => {
				if (e?.name && e?.url) {
					emojiUrlCache[e.name] = e.url;
					if (e.name.includes("@")) {
						emojiUrlCache[e.name] = e.url;
					} else {
						// ローカル絵文字: リアクションは ":name@.:" 形式なので、このキーでも引けるようにする
						emojiUrlCache[e.name + "@."] = e.url;
					}
				}
			});
		} catch (_) {}
	}

	function getEmojiUrl(emojiStr) {
		const m = /^:([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9.-]+))?:$/.exec(emojiStr);
		if (!m) return null;
		const key = m[2] ? `${m[1]}@${m[2]}` : m[1];
		return emojiUrlCache[key] || emojiUrlCache[m[1]] || null;
	}

	// 初期化
	async function init() {
		try {
			await loadAccounts();
			// 未ログイン時、初期TLがログイン必須の場合はlocalに切り替え
			if (!token && !["local", "global"].includes(currentTl)) {
				currentTl = "local";
				try { localStorage.setItem("light:lastTl", currentTl); } catch (_) {}
			}
			renderHeader();
			updateTlTabVisibility();
		initSettings();
		initPostForm();
		updateTlSelectorVisibility();
		if (token) {
			// NOTE: 絵文字選択UI・ノート描画でキャッシュが必要。TL読み込みより先に取得
			await fetchEmojiUrlCache();
			showPostForm();
			updateNotificationTabVisibility();
			if (["antenna", "list", "channel"].includes(currentTl)) {
				await populateTlSelector();
			}
			loadCurrentTl();
		} else {
			hidePostForm();
			updateNotificationTabVisibility();
		}
		document.querySelectorAll(".tab-btn").forEach((btn) => {
			btn.addEventListener("click", async () => {
				currentTl = btn.dataset.tl || "home";
				try { localStorage.setItem("light:lastTl", currentTl); } catch (_) {}
				document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
				updateTlSelectorVisibility();
				if (["antenna", "list", "channel"].includes(currentTl)) {
					await populateTlSelector();
				}
				loadCurrentTl();
				initPostForm();
			});
		});
		document.getElementById("header-streaming-btn")?.addEventListener("click", () => {
			const next = !getSetting("streaming", false);
			setSetting("streaming", next);
			renderHeader();
			updateStreamConnection();
		});
		document.getElementById("header-reload-btn")?.addEventListener("click", () => {
			loadCurrentTl();
		});
		document.getElementById("header-guest-reload-btn")?.addEventListener("click", () => {
			loadCurrentTl();
		});
		document.getElementById("post-submit")?.addEventListener("click", () => submitPost());
		document.getElementById("post-text")?.addEventListener("input", debounceSaveDraft);
		document.getElementById("post-cw")?.addEventListener("input", debounceSaveDraft);
		document.getElementById("post-visibility")?.addEventListener("change", debounceSaveDraft);
		document.getElementById("post-local-only")?.addEventListener("change", debounceSaveDraft);
		document.getElementById("post-emoji-btn")?.addEventListener("click", async () => {
			const picker = document.getElementById("post-emoji-picker");
			const show = picker.style.display !== "none";
			picker.style.display = show ? "none" : "flex";
			if (!show) {
				await fetchEmojiUrlCache();
				const emojiDisplayAttrs = (str) => {
					const norm = str && !str.startsWith(":") ? `:${str}:` : str;
					const url = getEmojiUrl(norm || str);
					return url ? ` data-emoji-url="${escapeHtml(url)}"` : "";
				};
				const emojis = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "[]");
				picker.innerHTML = emojis.length ? emojis.map((e) => {
					const s = typeof e === "string" ? e : (e.name ? `:${e.name}:` : String(e));
					return `<div class="emoji-picker-row"><span class="emoji-picker-display" data-emoji="${escapeHtml(s)}"${emojiDisplayAttrs(s)}>${escapeHtml(s)}</span><button type="button" class="emoji-picker-use" data-emoji="${escapeHtml(s)}">使用</button></div>`;
				}).join("") : `<button type="button" id="post-emoji-fetch-btn">取得</button>`;
				picker.classList.add("emoji-picker-vertical");
				if (emojis.length) {
					picker.querySelectorAll(".emoji-picker-use[data-emoji]").forEach((btn) => {
						btn.addEventListener("click", () => {
							const textarea = document.getElementById("post-text");
							const emoji = btn.dataset.emoji;
							const start = textarea.selectionStart;
							const end = textarea.selectionEnd;
							const v = textarea.value;
							textarea.value = v.slice(0, start) + emoji + v.slice(end);
							textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
							textarea.focus();
							debounceSaveDraft();
						});
					});
					picker.querySelectorAll(".emoji-picker-display[data-emoji-url]").forEach((span) => {
						span.addEventListener("click", (e) => {
							if (span.querySelector("img")) return;
							e.stopPropagation();
							const url = span.dataset.emojiUrl;
							if (!url) return;
							const text = span.textContent || "";
							span.dataset.emojiText = text;
							const img = document.createElement("img");
							img.src = url;
							img.alt = text;
							img.style.height = "1.25em";
							img.style.width = "auto";
							img.style.verticalAlign = "middle";
							img.style.cursor = "pointer";
							span.textContent = "";
							span.appendChild(img);
							img.addEventListener("click", (ev) => {
								ev.stopPropagation();
								img.remove();
								span.textContent = span.dataset.emojiText || "";
							});
						});
					});
				} else {
					picker.querySelector("#post-emoji-fetch-btn")?.addEventListener("click", async () => {
						try {
							await fetchEmojis();
							await fetchEmojiUrlCache();
							const emojiDisplayAttrs2 = (str) => {
								const norm = str && !str.startsWith(":") ? `:${str}:` : str;
								const url = getEmojiUrl(norm || str);
								return url ? ` data-emoji-url="${escapeHtml(url)}"` : "";
							};
							const newEmojis = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "[]");
							picker.innerHTML = newEmojis.map((e) => {
								const s = typeof e === "string" ? e : (e.name ? `:${e.name}:` : String(e));
								return `<div class="emoji-picker-row"><span class="emoji-picker-display" data-emoji="${escapeHtml(s)}"${emojiDisplayAttrs2(s)}>${escapeHtml(s)}</span><button type="button" class="emoji-picker-use" data-emoji="${escapeHtml(s)}">使用</button></div>`;
							}).join("");
							picker.classList.add("emoji-picker-vertical");
							picker.querySelectorAll(".emoji-picker-use[data-emoji]").forEach((btn) => {
								btn.addEventListener("click", () => {
									const textarea = document.getElementById("post-text");
									const emoji = btn.dataset.emoji;
									const start = textarea.selectionStart;
									const end = textarea.selectionEnd;
									const v = textarea.value;
									textarea.value = v.slice(0, start) + emoji + v.slice(end);
									textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
									textarea.focus();
									debounceSaveDraft();
								});
							});
							picker.querySelectorAll(".emoji-picker-display[data-emoji-url]").forEach((span) => {
								span.addEventListener("click", (e) => {
									if (span.querySelector("img")) return;
									e.stopPropagation();
									const url = span.dataset.emojiUrl;
									if (!url) return;
									const text = span.textContent || "";
									span.dataset.emojiText = text;
									const img = document.createElement("img");
									img.src = url;
									img.alt = text;
									img.style.height = "1.25em";
									img.style.width = "auto";
									img.style.verticalAlign = "middle";
									img.style.cursor = "pointer";
									span.textContent = "";
									span.appendChild(img);
									img.addEventListener("click", (ev) => {
										ev.stopPropagation();
										img.remove();
										span.textContent = span.dataset.emojiText || "";
									});
								});
							});
						} catch (_) {}
					});
				}
			}
		});
		document.getElementById("header-menu-btn")?.addEventListener("click", (e) => {
			e.stopPropagation();
			const menu = document.getElementById("header-menu");
			if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
		});
		document.getElementById("header-menu")?.addEventListener("click", (e) => {
			const item = e.target.closest(".header-menu-item");
			if (!item) return;
			const action = item.dataset.action;
			document.getElementById("header-menu").style.display = "none";
			if (action === "search") openSearch();
			else if (action === "settings") document.getElementById("settings-panel").style.display = "block";
			else if (action === "back-to-normal") {
				if (confirm("通常版もこきーに戻りますか？")) {
					window.location.href = window.location.origin + "/";
				}
			} else if (action === "logout") doLogout();
			else if (action === "switch-account") showAccountSwitch();
		});
		document.addEventListener("click", (e) => {
			const m = document.getElementById("header-menu");
			const btn = document.getElementById("header-menu-btn");
			if (m && !m.contains(e.target) && !btn?.contains(e.target)) m.style.display = "none";
		});
		document.getElementById("settings-reload")?.addEventListener("click", () => { location.reload(); });
		document.getElementById("settings-close")?.addEventListener("click", () => {
			setSetting("showIcons", document.getElementById("setting-show-icons").checked);
			setSetting("notifications", document.getElementById("setting-notifications").checked);
			setSetting("rememberVisibility", document.getElementById("setting-remember-visibility").checked);
			setSetting("defaultVisibility", document.getElementById("setting-default-visibility").value);
			setSetting("defaultLocalOnly", document.getElementById("setting-default-local-only").checked);
			setSetting("wordMute", document.getElementById("setting-word-mute").value || "");
			document.getElementById("settings-panel").style.display = "none";
			updateDefaultVisibilitySectionVisibility();
			updateNotificationTabVisibility();
			updateStreamConnection();
		});
		document.getElementById("setting-remember-visibility")?.addEventListener("change", updateDefaultVisibilitySectionVisibility);
		document.getElementById("setting-fetch-emojis")?.addEventListener("click", fetchEmojis);
		document.getElementById("login-btn")?.addEventListener("click", showLoginForm);
		document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
			if (e.target.id === "modal-overlay") hideModal();
		});
		document.getElementById("error-retry")?.addEventListener("click", () => { hideError(); loadCurrentTl(); });
		document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
		document.querySelector(`.tab-btn[data-tl="${currentTl}"]`)?.classList.add("active");
		updateStreamConnection();
		} catch (e) {
			console.error("Light Client init error:", e);
			showError("初期化に失敗しました。ページを再読み込みしてください。");
			renderHeader();
			if (!token) showLoginForm();
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
