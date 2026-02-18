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

	let token = null;
	let currentAccount = null;
	let accounts = [];
	let currentTl = "home";
	let notes = [];
	let notifications = [];
	let isLoading = false;
	let streamWs = null;
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
					currentAccount = { id: accounts[0].id, token: accounts[0].token };
					token = accounts[0].token;
					localStorage.setItem("account", JSON.stringify(currentAccount));
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
			currentAccount = { id: me.id, token };
			localStorage.setItem("account", JSON.stringify(currentAccount));
			const accs = await getAccountsFromStorage();
			if (!accs.some((a) => a.id === me.id)) {
				await saveAccounts([...accs, { id: me.id, token }]);
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
		currentAccount = { id: me.id, token };
		localStorage.setItem("account", JSON.stringify(currentAccount));
		const accs = await getAccountsFromStorage();
		if (!accs.some((a) => a.id === me.id)) {
			await saveAccounts([...accs, { id: me.id, token }]);
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
		currentAccount = { id: me.id, token };
		localStorage.setItem("account", JSON.stringify(currentAccount));
		const accs = await getAccountsFromStorage();
		if (!accs.some((a) => a.id === me.id)) {
			await saveAccounts([...accs, { id: me.id, token }]);
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

	// ヘッダー
	function renderHeader() {
		const loginBtn = document.getElementById("login-btn");
		const logoutBtn = document.getElementById("logout-btn");
		const accountSelect = document.getElementById("account-select");
		const accountName = document.getElementById("account-name");
		if (token) {
			if (loginBtn) loginBtn.style.display = "none";
			if (logoutBtn) logoutBtn.style.display = "inline-block";
			if (accountName) accountName.textContent = currentAccount?.id ? `@${currentAccount.id.slice(0, 8)}...` : "";
		} else {
			if (loginBtn) loginBtn.style.display = "inline-block";
			if (logoutBtn) logoutBtn.style.display = "none";
			if (accountName) accountName.textContent = "";
		}
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
			if (n.note && ["reply", "quote", "mention", "reaction", "renote", "unreadAntenna"].includes(n.type)) {
				return renderNote(n.note, showIcons);
			}
			const label = typeLabels[n.type] || n.type;
			const userPart = n.user
				? `<span class="note-user" data-user-id="${escapeHtml(n.user.id)}">${escapeHtml(getUserLabel(n.user))}</span>`
				: "";
			return `<div class="note notification-item" data-notification-id="${n.id}">
				<div class="note-header">
					<span class="note-meta">${escapeHtml(label)}: </span>${userPart}
				</div>
			</div>`;
		}).join("");
		bindNoteEvents(container);
	}

	function updateNotificationTabVisibility() {
		const tab = document.getElementById("tab-notifications");
		if (!tab) return;
		const show = !!token && getSetting("notifications", false);
		tab.style.display = show ? "inline-block" : "none";
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
		}
		if (streamReconnectTimer) {
			clearTimeout(streamReconnectTimer);
			streamReconnectTimer = null;
		}
		const enabled = getSetting("streaming", false);
		if (!enabled || !token) return;
		const ch = getStreamChannel();
		if (!ch || currentTl === "notifications") return;
		const params = getStreamParams();
		if ((ch === "antenna" || ch === "userList" || ch === "channel") && !Object.values(params)[0]) return;
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${proto}//${window.location.host}/streaming?i=${encodeURIComponent(token)}`;
		try {
			const ws = new WebSocket(wsUrl);
			streamWs = ws;
			ws.onopen = () => {
				ws.send(JSON.stringify({
					type: "connect",
					body: {
						channel: ch,
						id: "light-" + Date.now(),
						params: params,
					},
				}));
			};
			ws.onmessage = (ev) => {
				try {
					const msg = JSON.parse(ev.data);
					const chBody = msg.type === "channel" ? msg.body : null;
					const note = (msg.type === "note" ? msg.body?.body : chBody?.type === "note" ? chBody?.body : null);
					if (note && !notes.some((n) => n.id === note.id)) {
						notes = [note, ...notes];
						renderNotes();
					}
					if ((msg.type === "notification" || msg.type === "unreadNotification") && getSetting("notifications", false)) {
						const n = msg.body?.body || msg.body;
						if (n) {
							notifications = [n, ...notifications];
							renderNotifications();
						}
					}
				} catch (_) {}
			};
			ws.onclose = () => {
				streamWs = null;
				if (getSetting("streaming", false) && token) {
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
		const name = (user.name || "").replace(/:\w+:/g, "").trim() || `@${user.username}`;
		return `${name}@${user.username}${user.host ? `@${user.host}` : ""}`;
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
		const app = note.renote || note;
		const user = app.user;
		const avatar = showIcons && user.avatarUrl
			? `<img class="note-avatar" data-src="${escapeHtml(user.avatarUrl)}" alt="" width="40" height="40">`
			: "";
		let text = "";
		if (app.cw) {
			text += `<div class="note-cw" data-note-id="${note.id}" data-cw-expanded="false">CWあり（タップで展開）</div>`;
			text += `<div class="note-cw-body" data-note-id="${note.id}" style="display:none">${escapeHtml(app.cw)}</div>`;
		}
		const textContent = app.text || "";
		const emojiMap = {};
		(app.emojis || []).forEach((e) => {
			emojiMap[e.name] = e.url;
			if (e.name.includes("@")) emojiMap[e.name] = e.url;
		});
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
				const url = emojiMap[key] || emojiMap[p.name];
				if (url) {
					safeText += `<span class="note-emoji-placeholder" data-emoji-url="${escapeHtml(url)}" title=":${escapeHtml(key)}:">:${escapeHtml(key)}:</span>`;
				} else {
					safeText += escapeHtml(`:${key}:`);
				}
			}
		});
		text += `<div class="note-text" data-note-id="${note.id}">${safeText}</div>`;
		const files = (app.files || []).map((f, i) => {
			const label = f.type?.startsWith("image") ? "画像" : f.type?.startsWith("video") ? "動画" : "ファイル";
			return `<button class="note-file-btn" data-url="${escapeHtml(f.thumbnailUrl || f.url)}" data-type="${f.type || ""}">[${label}]</button>`;
		}).join("");
		if (files) text += `<div class="note-files">${files}</div>`;
		const reactions = Object.entries(note.reactions || {}).map(([r, c]) => `${r}×${c}`).join(" ") || "";
		const isFav = (note.myReaction || "") === "❤️" || Object.keys(note.reactionCounts || {}).some(() => true);
		return `
			<div class="note" data-note-id="${note.id}">
				<div class="note-header">
					${avatar}
					<span class="note-user" data-user-id="${user.id}">${escapeHtml(getUserLabel(user))}</span>
					<span class="note-meta">${reactions}</span>
				</div>
				${note.renote ? `<div class="note-meta">RT ${escapeHtml(getUserLabel(note.user))}</div>` : ""}
				${text}
				<div class="note-actions">
					<button class="note-reply" data-note-id="${note.id}">返信</button>
					<button class="note-reaction" data-note-id="${note.id}">リアクション</button>
					<button class="note-rt" data-note-id="${note.id}">RT</button>
					${note.userId === currentAccount?.id ? `<button class="note-delete" data-note-id="${note.id}">削除</button>` : ""}
				</div>
			</div>
		`;
	}

	function bindNoteEvents(container) {
		if (!container) return;
		const showIcons = getSetting("showIcons", true);
		container.querySelectorAll(".note-avatar[data-src]").forEach((img) => {
			img.addEventListener("click", () => {
				img.src = img.dataset.src;
			});
		});
		container.querySelectorAll(".note-cw").forEach((el) => {
			el.addEventListener("click", () => {
				const expanded = el.dataset.cwExpanded === "true";
				const body = container.querySelector(`.note-cw-body[data-note-id="${el.dataset.noteId}"]`);
				if (body) {
					body.style.display = expanded ? "none" : "block";
					el.dataset.cwExpanded = expanded ? "false" : "true";
					el.textContent = expanded ? "CWあり（タップで展開）" : "CW（タップで折り畳み）";
				}
			});
		});
		container.querySelectorAll(".note-emoji-placeholder").forEach((span) => {
			span.addEventListener("click", () => {
				const url = span.dataset.emojiUrl;
				if (!url) return;
				const img = document.createElement("img");
				img.src = url;
				img.alt = span.textContent || "";
				img.className = "note-emoji-img";
				img.style.maxWidth = "1.25em";
				img.style.verticalAlign = "middle";
				span.replaceWith(img);
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
		container.querySelectorAll(".note").forEach((el) => {
			el.addEventListener("click", (e) => {
				if (e.target.closest(".note-reply, .note-reaction, .note-rt, .note-delete, .note-file-btn, .note-cw, .note-user")) return;
				openNoteDetail(el.dataset.noteId);
			});
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
			if (draft.dmUserIds?.length) dmUserIds = draft.dmUserIds;
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

	function renderPostAttributes() {
		const attr = document.getElementById("post-attributes");
		if (!attr) return;
		const items = [];
		if (replyNoteId) items.push({ type: "reply", id: replyNoteId, label: "返信" });
		if (renoteNoteId) items.push({ type: "renote", id: renoteNoteId, label: "引用/RT" });
		if (dmUserIds?.length) items.push({ type: "dm", label: "DM" });
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
				if (b.dataset.type === "dm") dmUserIds = null;
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

	function setDmMode(userIds) {
		dmUserIds = userIds || [];
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
		const overlay = document.getElementById("modal-overlay");
		const body = document.getElementById("modal-body");

		function renderEmojiPicker() {
			const emojis = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "[]");
			if (emojis.length === 0) {
				body.innerHTML = `<div class="post-emoji-picker"><button type="button" id="emoji-fetch-btn">取得</button></div>`;
				body.querySelector("#emoji-fetch-btn")?.addEventListener("click", async () => {
					try {
						await fetchEmojis();
						renderEmojiPicker();
					} catch (_) {}
				});
				return;
			}
			body.innerHTML = `<div class="post-emoji-picker">${emojis.map((e) => `<button data-emoji="${escapeHtml(typeof e === "string" ? e : e.name || e)}">${typeof e === "string" ? e : e.name || e}</button>`).join("")}</div>`;
			body.querySelectorAll("button[data-emoji]").forEach((btn) => {
				btn.addEventListener("click", async () => {
					let emoji = btn.dataset.emoji;
					if (emoji && !emoji.startsWith(":") && emoji.length > 2) emoji = `:${emoji}:`;
					await api("notes/reactions/create", { noteId, reaction: emoji || "👍" });
					overlay.style.display = "none";
					loadCurrentTl();
				});
			});
		}

		overlay.style.display = "flex";
		renderEmojiPicker();
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
				const rel = user.relation || {};
				const actions = [];
				if (rel.isFollowing) actions.push({ label: "フォロー解除", action: () => api("following/delete", { userId }) });
				else actions.push({ label: "フォロー", action: () => api("following/create", { userId }) });
				if (rel.hasPendingFollowRequestToYou) {
					actions.push({ label: "承認", action: () => api("following/requests/accept", { userId }) });
					actions.push({ label: "却下", action: () => api("following/requests/reject", { userId }) });
				}
				actions.push({ label: "DM", action: () => { setDmMode([userId]); hideModal(); } });
				if (rel.isMuting) actions.push({ label: "ミュート解除", action: () => api("mute/delete", { userId }) });
				else actions.push({ label: "ミュート", action: () => api("mute/create", { userId }) });
				if (rel.isBlocking) actions.push({ label: "ブロック解除", action: () => api("blocking/delete", { userId }) });
				else actions.push({ label: "ブロック", action: () => { if (confirm("ブロックしますか？")) api("blocking/create", { userId }); } });
				const overlay = document.getElementById("modal-overlay");
				const body = document.getElementById("modal-body");
				body.innerHTML = `
					<h3>${escapeHtml(getUserLabel(user))}</h3>
					<ul class="profile-actions-list">
						${actions.map((a) => `<li data-action="${escapeHtml(a.label)}">${escapeHtml(a.label)}</li>`).join("")}
					</ul>
				`;
				overlay.style.display = "flex";
				body.querySelectorAll("li").forEach((li, i) => {
					li.addEventListener("click", () => {
						actions[i].action().then(() => { hideModal(); loadCurrentTl(); });
					});
				});
			})
			.catch((e) => showError(e?.message || "ユーザー取得失敗"));
	}

	function openNoteDetail(noteId) {
		api("notes/conversation", { noteId })
			.then((thread) => {
				const overlay = document.getElementById("modal-overlay");
				const body = document.getElementById("modal-body");
				const showIcons = getSetting("showIcons", true);
				body.innerHTML = (thread || []).map((n) => renderNote(n, showIcons)).join("");
				overlay.style.display = "flex";
				bindNoteEvents(body);
			})
			.catch((e) => showError(e?.message || "取得失敗"));
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
		document.getElementById("setting-streaming").checked = getSetting("streaming", false);
		document.getElementById("setting-notifications").checked = getSetting("notifications", false);
		document.getElementById("setting-remember-visibility").checked = getSetting("rememberVisibility", true);
		document.getElementById("setting-default-visibility").value = getSetting("defaultVisibility", "public");
		document.getElementById("setting-default-local-only").checked = getSetting("defaultLocalOnly", false);
		document.getElementById("setting-word-mute").value = getSetting("wordMute", "") || "";
		updateDefaultVisibilitySectionVisibility();
	}

	// 絵文字取得
	async function fetchEmojis() {
		try {
			const meta = await api("meta", {});
			const emojis = meta?.emojis || [];
			const names = emojis.slice(0, 50).map((e) => (e.name ? (e.host ? `:${e.name}@${e.host}:` : `:${e.name}:`) : "")).filter(Boolean);
			localStorage.setItem(REACTIONS_KEY, JSON.stringify(names));
			showError("絵文字を取得しました");
			setTimeout(hideError, 2000);
		} catch (e) {
			showError(e?.message || "絵文字取得失敗");
		}
	}

	// 初期化
	async function init() {
		await loadAccounts();
		renderHeader();
		initSettings();
		initPostForm();
		updateTlSelectorVisibility();
		if (token) {
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
		document.getElementById("post-submit")?.addEventListener("click", () => submitPost());
		document.getElementById("post-text")?.addEventListener("input", debounceSaveDraft);
		document.getElementById("post-cw")?.addEventListener("input", debounceSaveDraft);
		document.getElementById("post-visibility")?.addEventListener("change", debounceSaveDraft);
		document.getElementById("post-local-only")?.addEventListener("change", debounceSaveDraft);
		document.getElementById("post-emoji-btn")?.addEventListener("click", () => {
			const picker = document.getElementById("post-emoji-picker");
			const show = picker.style.display !== "none";
			picker.style.display = show ? "none" : "flex";
			if (!show) {
				const emojis = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "[]");
				picker.innerHTML = emojis.length ? emojis.map((e) => {
					const s = typeof e === "string" ? e : (e.name ? `:${e.name}:` : String(e));
					return `<button type="button" data-emoji="${escapeHtml(s)}">${s.length <= 4 ? s : s.replace(/:[^:]+:/g, ":)")}</button>`;
				}).join("") : `<button type="button" id="post-emoji-fetch-btn">取得</button>`;
				if (emojis.length) {
					picker.querySelectorAll("button[data-emoji]").forEach((btn) => {
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
				} else {
					picker.querySelector("#post-emoji-fetch-btn")?.addEventListener("click", async () => {
						try {
							await fetchEmojis();
							const newEmojis = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "[]");
							picker.innerHTML = newEmojis.map((e) => {
								const s = typeof e === "string" ? e : (e.name ? `:${e.name}:` : String(e));
								return `<button type="button" data-emoji="${escapeHtml(s)}">${s.length <= 4 ? s : s.replace(/:[^:]+:/g, ":)")}</button>`;
							}).join("");
							picker.querySelectorAll("button[data-emoji]").forEach((btn) => {
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
						} catch (_) {}
					});
				}
			}
		});
		document.getElementById("settings-btn")?.addEventListener("click", () => {
			document.getElementById("settings-panel").style.display = "block";
		});
		document.getElementById("settings-close")?.addEventListener("click", () => {
			setSetting("showIcons", document.getElementById("setting-show-icons").checked);
			setSetting("streaming", document.getElementById("setting-streaming").checked);
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
		document.getElementById("search-btn")?.addEventListener("click", openSearch);
		document.getElementById("login-btn")?.addEventListener("click", showLoginForm);
		document.getElementById("logout-btn")?.addEventListener("click", doLogout);
		document.getElementById("modal-close")?.addEventListener("click", hideModal);
		document.getElementById("error-retry")?.addEventListener("click", () => { hideError(); loadCurrentTl(); });
		document.querySelector(".tab-btn[data-tl='home']")?.classList.add("active");
		updateStreamConnection();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
