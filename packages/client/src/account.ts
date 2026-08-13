import { defineAsyncComponent, reactive } from "vue";
import * as misskey from "calckey-js";
import { showSuspendedDialog } from "./scripts/show-suspended-dialog";
import { showUsagePausedDialog } from "./scripts/show-usage-paused-dialog";
import { showDeletedDialog } from "./scripts/show-deleted-dialog";
import { i18n } from "./i18n";
import { del, get, set } from "@/scripts/idb-proxy";
import { apiUrl } from "@/config";
import { mergeMkkeyApiClientHeaders } from "@/scripts/mkkey-api-client-headers";
import { waiting, api, popup, popupMenu, success, alert } from "@/os";
import { clearAppBadge } from "@/scripts/app-badge";
import { resetAppBadgeReceivedCount } from "@/scripts/app-badge-counter";
import { unisonReload, reloadChannel } from "@/scripts/unison-reload";

// TODO: 他のタブと永続化されたstateを同期

type Account = misskey.entities.MeDetailed;

const accountData = localStorage.getItem("account");

// TODO: 外部からはreadonlyに
export const $i = accountData
	? reactive(JSON.parse(accountData) as Account)
	: null;

export const iAmModerator = $i != null && ($i.isAdmin || $i.isModerator);
export const iAmAdmin = $i?.isAdmin;

function getCookieAttributes(maxAge?: number): string {
	const attrs = ["path=/", "SameSite=Lax"];
	if (maxAge !== undefined) {
		attrs.push(`max-age=${maxAge}`);
	}
	if (document.location.protocol.startsWith("https")) {
		attrs.push("Secure");
	}
	return attrs.join("; ");
}

/**
 * Bull Board（/queue）認証用 `token` Cookie の属性を生成する。
 *
 * @remarks
 * GHSA-38w6-vx8g-67pp 対策:
 * `token` Cookie は Bull Board の認証にのみ使われるため、
 * - `path=/queue` … `/queue` 配下のリクエストにのみ送信し、漏洩面を最小化する。
 * - `SameSite=Strict` … 他サイトからのクロスサイトリクエストでは送信されず、CSRF を防ぐ。
 * とし、必要最小限のスコープに限定する。
 *
 * @param maxAge - Cookie の有効期間（秒）。削除時は 0 を指定する。
 */
function getBullBoardCookieAttributes(maxAge?: number): string {
	const attrs = ["path=/queue", "SameSite=Strict"];
	if (maxAge !== undefined) {
		attrs.push(`max-age=${maxAge}`);
	}
	if (document.location.protocol.startsWith("https")) {
		attrs.push("Secure");
	}
	return attrs.join("; ");
}

export async function signout() {
	const waitingDialog = waiting();
	// ログアウト直後に前アカウントの未読バッジが OS に残らないよう先にクリアする
	clearAppBadge();

	const signingOutToken = $i?.token;
	const signingOutUserId = $i?.id;

	if (signingOutUserId != null) {
		await resetAppBadgeReceivedCount(signingOutUserId);
	}

	if (signingOutUserId == null) {
		localStorage.removeItem("account");
		document.cookie = `igi=; ${getCookieAttributes(0)}`;
		// token Cookie は path=/queue で発行しているため、その path で削除する。
		// 旧 path=/ の残存 Cookie も併せて削除する（移行措置）。
		document.cookie = `token=; ${getBullBoardCookieAttributes(0)}`;
		document.cookie = `token=; ${getCookieAttributes(0)}`;
		unisonReload("/");
		return;
	}

	localStorage.removeItem("account");

	await removeAccount(signingOutUserId);

	const accounts = await getAccounts();

	//#region Remove service worker push registration
	if (navigator.serviceWorker.controller && signingOutToken) {
		try {
			const registration = await navigator.serviceWorker.ready;
			const push = await registration.pushManager.getSubscription();
			if (push) {
				const res = await fetch(`${apiUrl}/sw/unregister`, {
					method: "POST",
					headers: mergeMkkeyApiClientHeaders({
						authorization: `Bearer ${signingOutToken}`,
					}),
					body: JSON.stringify({
						endpoint: push.endpoint,
						cause: "logout",
					}),
				});
				if (!res.ok) {
					console.warn(
						`[mkkey-push] ログアウト時の sw/unregister に失敗しました: status=${res.status}`,
					);
				}
				// 最後の1アカウントのみブラウザ購読も解除
				if (accounts.length === 0) {
					try {
						await push.unsubscribe();
					} catch (err) {
						console.warn(
							"[mkkey-push] ログアウト時の push.unsubscribe に失敗しました",
							err,
						);
					}
				}
			}
		} catch (err) {
			console.warn("[mkkey-push] ログアウト時のプッシュ購読解除に失敗しました", err);
		}
	}

	if (accounts.length === 0) {
		try {
			await navigator.serviceWorker.getRegistrations().then((registrations) => {
				return Promise.all(
					registrations.map((registration) => registration.unregister()),
				);
			});
		} catch (err) {
			console.warn("[mkkey-push] Service Worker の unregister に失敗しました", err);
		}
	}
	//#endregion

	document.cookie = `igi=; ${getCookieAttributes(0)}`;
	// token Cookie は path=/queue で発行しているため、その path で削除する。
	// 旧 path=/ の残存 Cookie も併せて削除する（移行措置）。
	document.cookie = `token=; ${getBullBoardCookieAttributes(0)}`;
	document.cookie = `token=; ${getCookieAttributes(0)}`;

	if (accounts.length > 0) {
		// NOTE: login() 自身が固有の waiting() を表示するため、
		// ここで閉じておかないと signout 側のスピナーが（login 失敗時に）残り続ける
		waitingDialog.close();
		login(accounts[0].token);
	} else {
		unisonReload("/");
	}
}

export async function getAccounts(): Promise<
	{ id: Account["id"]; token: Account["token"] }[]
> {
	return (await get("accounts")) || [];
}

export async function addAccount(id: Account["id"], token: Account["token"]) {
	const accounts = await getAccounts();
	if (!accounts.some((x) => x.id === id)) {
		await set("accounts", accounts.concat([{ id, token }]));
	}
}

export async function removeAccount(id: Account["id"]) {
	if (id == null) return;

	const accounts = await getAccounts();
	const index = accounts.findIndex((x) => x.id === id);
	if (index < 0) return;

	accounts.splice(index, 1);

	if (accounts.length > 0) await set("accounts", accounts);
	else await del("accounts");
}

export function fetchAccount(token: string): Promise<Account> {
	return new Promise((done, fail) => {
		// Fetch user
		fetch(`${apiUrl}/i`, {
			method: "POST",
			headers: mergeMkkeyApiClientHeaders(),
			body: JSON.stringify({
				i: token,
			}),
		})
			.then((res) => res.json())
			.then((res) => {
				if (res.error) {
					if (res.error.id === "a8c724b3-6e9c-4b46-b1a8-bc3ed6258370") {
						showSuspendedDialog().then(() => {
							signout();
						});
					} else if (
						res.error.id === "c9a4e2b1-7f3d-4a2e-9e1c-0d5b8a4e6f2a"
					) {
						showUsagePausedDialog().then(() => {
							signout();
						});
					} else if (
						res.error.id === "b8f1a6c2-3d47-4e59-9a0b-2c7e5d4f8a13"
					) {
						showDeletedDialog().then(() => {
							signout();
						});
					} else {
						alert({
							type: "error",
							title: i18n.ts.failedToFetchAccountInformation,
							text: JSON.stringify(res.error),
						});
					}
					fail(res.error);
				} else {
					res.token = token;
					done(res);
				}
			})
			.catch(fail);
	});
}

export function updateAccount(accountData) {
	for (const [key, value] of Object.entries(accountData)) {
		$i[key] = value;
	}
	localStorage.setItem("account", JSON.stringify($i));
}

/**
 * 現在のトークンで /i を再取得し、$i と localStorage を更新する。
 * init では auth/validate 通過後に fetchAccount をバックグラウンドで呼び、updateAccount で反映している。
 */
export async function refreshAccount() {
	return updateAccount(await fetchAccount($i?.token));
}

export async function login(token: Account["token"], redirect?: string) {
	const waitingDialog = waiting();
	if (_DEV_) console.log("logging as token ", token);
	let me: Account;
	try {
		me = await fetchAccount(token);
	} catch (err) {
		// NOTE: fetchAccount が失敗理由のダイアログを既に表示済み。
		// ここではスピナーだけを閉じ、ページはそのまま維持する（fetchAccount が
		// suspended/usage-paused の場合は自身で signout 経由の遷移を行う）。
		waitingDialog.close();
		if (_DEV_) console.warn("login: fetchAccount failed", err);
		return;
	}
	localStorage.setItem("account", JSON.stringify(me));
	// Bull dashboard（/queue）の認証で使う。GHSA-38w6 対策で path=/queue・SameSite=Strict に限定。
	document.cookie = `token=${token}; ${getBullBoardCookieAttributes(31536000)}`;
	// 旧バージョンで path=/ ・SameSite=Lax として保存された token Cookie が残っていると
	// CSRF 緩和が損なわれるため、ログイン時に併せて削除する（移行措置）。
	document.cookie = `token=; ${getCookieAttributes(0)}`;
	await addAccount(me.id, token);

	if (redirect) {
		// 他のタブは再読み込みするだけ
		reloadChannel.postMessage(null);
		// このページはredirectで指定された先に移動
		location.href = redirect;
		return;
	}

	unisonReload();
}

export async function openAccountMenu(
	opts: {
		includeCurrentAccount?: boolean;
		withExtraOperation: boolean;
		active?: misskey.entities.UserDetailed["id"];
		onChoose?: (account: misskey.entities.UserDetailed) => void;
	},
	ev: MouseEvent,
) {
	function showSigninDialog() {
		popup(
			defineAsyncComponent(() => import("@/components/MkSigninDialog.vue")),
			{},
			{
				done: (res) => {
					addAccount(res.id, res.i);
					success();
				},
			},
			"closed",
		);
	}

	function createAccount() {
		popup(
			defineAsyncComponent(() => import("@/components/MkSignupDialog.vue")),
			{},
			{
				done: (res) => {
					addAccount(res.id, res.i);
					switchAccountWithToken(res.i);
				},
			},
			"closed",
		);
	}

	async function switchAccount(account: misskey.entities.UserDetailed) {
		const storedAccounts = await getAccounts();
		const token = storedAccounts.find((x) => x.id === account.id).token;
		switchAccountWithToken(token);
	}

	function switchAccountWithToken(token: string) {
		login(token);
	}

	const storedAccounts = await getAccounts().then((accounts) =>
		accounts.filter((x) => x.id !== $i.id),
	);
	const accountsPromise = api("users/show", {
		userIds: storedAccounts.map((x) => x.id),
	});

	function createItem(account: misskey.entities.UserDetailed) {
		return {
			type: "user",
			user: account,
			active: opts.active != null ? opts.active === account.id : false,
			action: () => {
				if (opts.onChoose) {
					opts.onChoose(account);
				} else {
					switchAccount(account);
				}
			},
		};
	}

	const accountItemPromises = storedAccounts.map(
		(a) =>
			new Promise((res) => {
				accountsPromise.then((accounts) => {
					const account = accounts.find((x) => x.id === a.id);
					if (account == null) return res(null);
					res(createItem(account));
				});
			}),
	);

	if (opts.withExtraOperation) {
		popupMenu(
			[
				...[
					{
						type: "link",
						text: i18n.ts.profile,
						to: `/@${$i.username}`,
						avatar: $i,
					},
					null,
					...(opts.includeCurrentAccount ? [createItem($i)] : []),
					...accountItemPromises,
					{
						type: "parent",
						icon: "ph-plus ph-bold ph-lg",
						text: i18n.ts.addAccount,
						children: [
							{
								text: i18n.ts.existingAccount,
								action: () => {
									showSigninDialog();
								},
							},
							{
								text: i18n.ts.createAccount,
								action: () => {
									createAccount();
								},
							},
						],
					},
					{
						type: "link",
						icon: "ph-users ph-bold ph-lg",
						text: i18n.ts.manageAccounts,
						to: "/settings/accounts",
					},
					...(!/mobile|iphone|android/.test(navigator.userAgent.toLowerCase())
						? [
								{
									type: "button",
									icon: "ph-sign-out ph-bold ph-lg",
									text: i18n.ts.logout,
									action: () => {
										signout();
									},
								},
						  ]
						: []),
				],
			],
			ev.currentTarget ?? ev.target,
			{
				align: "left",
			},
		);
	} else {
		popupMenu(
			[
				...(opts.includeCurrentAccount ? [createItem($i)] : []),
				...accountItemPromises,
			],
			ev.currentTarget ?? ev.target,
			{
				align: "left",
			},
		);
	}
}
