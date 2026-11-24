<template>
	<div :class="$style.container">
		<div :class="$style.card">
			<Transition
				mode="out-in"
				:enter-active-class="$style.transition_enterActive"
				:leave-active-class="$style.transition_leaveActive"
				:enter-from-class="$style.transition_enterFrom"
				:leave-to-class="$style.transition_leaveTo"
			>
				<div
					v-if="phase === 'accountSelect'"
					key="accountSelect"
					:class="$style.root"
				>
					<div :class="$style.header">
						<div :class="$style.iconFallback">
							<i class="ph-user ph-bold ph-lg"></i>
						</div>
						<div :class="$style.headerText">
							{{
								$i
									? i18n.ts._auth.pleaseSelectAccount
									: i18n.ts._auth.pleaseLogin
							}}
						</div>
					</div>
					<div>
						<div :class="$style.label">
							{{ i18n.ts.selectAccount }}
						</div>
						<div :class="$style.accountList">
							<template v-for="[id, user] in users" :key="id">
								<input
									:id="`auth-account-${id}`"
									v-model="selectedUserId"
									type="radio"
									name="authAccountSelector"
									:value="id"
									:class="$style.accountRadio"
								/>
								<label
									:for="`auth-account-${id}`"
									:class="$style.accountItem"
								>
									<MkAvatar
										:user="user"
										:class="$style.accountAvatar"
										disable-link
									/>
									<div :class="$style.accountBody">
										<MkUserName
											:user="user"
											:class="$style.accountName"
										/>
										<MkAcct
											:user="user"
											:class="$style.accountAcct"
										/>
									</div>
									<i
										v-if="id === $i?.id"
										:class="$style.accountCurrent"
										class="ph-check-circle ph-bold ph-lg"
									></i>
								</label>
							</template>
							<div
								v-if="users.size === 0 && !waiting"
								:class="$style.accountEmpty"
							>
								{{ i18n.ts._auth.noSavedAccounts }}
							</div>
							<button
								class="_button"
								:class="[$style.accountItem, $style.accountAdd]"
								@click="clickAddAccount"
							>
								<div
									:class="[
										$style.accountAvatar,
										$style.accountAddIcon,
									]"
								>
									<i class="ph-user-plus ph-bold ph-lg"></i>
								</div>
								<div
									:class="[
										$style.accountBody,
										$style.accountName,
									]"
								>
									{{ $i ? i18n.ts.addAccount : i18n.ts.login }}
								</div>
							</button>
						</div>
					</div>
					<div :class="$style.buttons">
						<MkButton
							rounded
							gradate
							:disabled="selectedUser == null"
							@click="clickChooseAccount"
						>
							{{ i18n.ts.next }}
							<i class="ph-arrow-right ph-bold ph-lg"></i>
						</MkButton>
					</div>
				</div>
				<div
					v-else-if="phase === 'consent' && selectedUser"
					key="consent"
					:class="$style.root"
				>
					<div :class="$style.header">
						<img
							v-if="icon"
							:class="$style.icon"
							:src="getProxiedImageUrl(icon, 'preview')"
							alt=""
						/>
						<div v-else :class="$style.iconFallback">
							<i class="ph-app-window ph-bold ph-lg"></i>
						</div>
						<div :class="$style.headerText">
							{{
								name
									? i18n.t("_auth.shareAccess", { name })
									: i18n.ts._auth.shareAccessAsk
							}}
						</div>
					</div>
					<div
						v-if="permissions && permissions.length > 0"
						:class="$style.box"
					>
						<div>{{ i18n.ts._auth.permissionAsk }}</div>
						<ul :class="$style.permissionList">
							<li v-for="p in permissions" :key="p">
								{{ i18n.t(`_permissions.${p}`) }}
							</li>
						</ul>
					</div>
					<slot name="consentAdditionalInfo"></slot>
					<div>
						<div :class="[$style.label, $style.labelWithAction]">
							<span>{{ i18n.ts._auth.scopeUser }}</span>
							<button
								class="_textButton"
								@click="clickBackToAccountSelect"
							>
								<i class="ph-arrows-left-right ph-bold"></i>
								{{ i18n.ts.switchAccount }}
							</button>
						</div>
						<div :class="$style.accountList">
							<div :class="[$style.accountItem, $style.static]">
								<MkAvatar
									:user="selectedUser"
									:class="$style.accountAvatar"
									disable-link
								/>
								<div :class="$style.accountBody">
									<MkUserName
										:user="selectedUser"
										:class="$style.accountName"
									/>
									<MkAcct
										:user="selectedUser"
										:class="$style.accountAcct"
									/>
								</div>
							</div>
						</div>
					</div>
					<div :class="$style.buttons">
						<MkButton rounded @click="clickCancel">
							{{ i18n.ts.reject }}
						</MkButton>
						<MkButton rounded gradate @click="clickAccept">
							{{ i18n.ts.accept }}
						</MkButton>
					</div>
				</div>
				<div
					v-else-if="phase !== 'accountSelect' && phase !== 'consent'"
					:key="phase"
					:class="$style.root"
				>
					<div :class="$style.header">
						<div
							:class="[
								$style.iconFallback,
								{
									[$style.iconError]:
										phase === 'denied' || phase === 'failed',
								},
							]"
						>
							<i
								v-if="phase === 'success' || phase === 'redirecting'"
								class="ph-check ph-bold ph-lg"
							></i>
							<i v-else class="ph-x ph-bold ph-lg"></i>
						</div>
						<div :class="$style.headerText">
							{{
								phase === "success" || phase === "redirecting"
									? i18n.ts._auth.accepted
									: phase === "denied"
									? i18n.ts._auth.denied
									: i18n.ts.somethingHappened
							}}
						</div>
						<div
							v-if="phase === 'redirecting'"
							:class="$style.headerTextSub"
						>
							{{ i18n.ts._auth.callback }}<MkEllipsis />
						</div>
						<div
							v-else-if="phase === 'success'"
							:class="$style.headerTextSub"
						>
							{{ i18n.ts._auth.pleaseGoBack }}
						</div>
					</div>
					<slot v-if="phase === 'success'" name="successAdditionalInfo"></slot>
				</div>
			</Transition>
			<div v-if="_waiting" :class="$style.waiting">
				<MkLoading />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * @packageDocumentation
 *
 * 外部アプリにアカウントへのアクセスを許可するときの確認画面（共通部品）
 *
 * @remarks
 * - MiAuth（`/miauth/:session`）と旧式の認証（`/auth/:token`、Mastodon 互換 OAuth もここを通る）の両方で使う。
 *   API の呼び出しは呼び出し側のページが行い、この部品は「どのアカウントで許可するか」と
 *   「許可 / 拒否」の操作、結果の表示だけを受け持つ。
 * - 上流 Misskey の `MkAuthConfirm.vue`（misskey-dev/misskey#14828）を土台に移植したもの。
 * - 画面の流れ: アカウント選択 → 内容の確認 → 結果（許可 / 拒否 / 失敗 / 移動中）。
 *   ログイン中は、そのアカウントを選んだ状態で「内容の確認」から始める（上流は毎回アカウント選択から）。
 * - NOTE: アカウントを切り替えても、ブラウザでログインしているアカウントは変えない。
 *   このブラウザに保存されたアカウントのトークンを `accept` イベントで渡し、
 *   呼び出し側はそのトークンで API を呼ぶ。
 * - NOTE: 未ログイン時に「ログイン」からサインインした場合は、通常のログインとして扱い
 *   ページを読み込み直す（未ログインのままトークンだけ保存するとアカウント一覧が不整合になるため）。
 * - アカウントの新規登録はここからはできない（招待制・メール確認があり、その場でトークンが得られないため）。
 *
 * @public
 */
import { computed, defineAsyncComponent, ref } from "vue";
import type * as misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import { $i, addAccount, getAccounts, login } from "@/account";
import { i18n } from "@/i18n";
import * as os from "@/os";
import { getProxiedImageUrl } from "@/scripts/media-proxy";

//#region 型

/**
 * 画面の段階
 *
 * @remarks
 * `success` / `denied` / `failed` / `redirecting` は呼び出し側が {@link showUI} で切り替える。
 *
 * @internal
 */
type Phase =
	| "accountSelect"
	| "consent"
	| "success"
	| "denied"
	| "failed"
	| "redirecting";

/**
 * 選択肢として表示するアカウント（ユーザー情報 + このブラウザに保存されたトークン）
 *
 * @internal
 */
type SelectableUser = misskey.entities.UserDetailed & { token: string };

//#endregion

//#region プロパティとイベント

const props = defineProps<{
	/** アプリ名。無いときは名前を出さない文言にする */
	name?: string;
	/** アプリのアイコン URL。メディアプロキシを通して表示する */
	icon?: string;
	/** 要求されている権限（`_permissions` の翻訳キー） */
	permissions?: string[];
	/** 呼び出し側の読み込み中など、操作を止めたいとき true */
	manualWaiting?: boolean;
}>();

const emit = defineEmits<{
	/** 許可が押された。引数は選ばれたアカウントのトークン */
	(ev: "accept", token: string): void;
	/** 拒否が押された。引数は選ばれたアカウントのトークン */
	(ev: "deny", token: string): void;
}>();

//#endregion

//#region 状態

/** この部品自身の読み込み中（アカウント一覧の取得・許可の送信中） */
const waiting = ref(true);
const _waiting = computed(() => waiting.value || props.manualWaiting);

const phase = ref<Phase>($i ? "consent" : "accountSelect");

/** 選ばれているアカウントの ID。ログイン中はそのアカウントを最初から選んでおく */
const selectedUserId = ref<string | null>($i?.id ?? null);

/**
 * ログイン中のアカウントだけを入れた選択肢
 *
 * @remarks
 * 読み込みを待たずに「内容の確認」を出せるよう、最初からログイン中のアカウントを入れておく。
 *
 * @internal
 */
function createInitialUsers(): Map<string, SelectableUser> {
	const map = new Map<string, SelectableUser>();
	if ($i) {
		map.set($i.id, $i as unknown as SelectableUser);
	}
	return map;
}

/** 選択肢のアカウント。ログイン中のアカウントを先頭にするため Map で順序を保つ */
const users = ref(createInitialUsers());

const selectedUser = computed(() =>
	selectedUserId.value != null
		? users.value.get(selectedUserId.value) ?? null
		: null,
);

//#endregion

//#region 初期化

/**
 * このブラウザに保存されたアカウントを読み込み、選択肢を作り直す
 *
 * @remarks
 * ログイン中のアカウントは手元の情報をそのまま使い、それ以外は `users/show` でまとめて取得する。
 * 取得できなかったアカウント（削除済みなど）は選択肢に出さない。
 *
 * @internal
 */
async function init(): Promise<void> {
	waiting.value = true;

	const next = createInitialUsers();

	try {
		const accounts = await getAccounts();
		const idsToFetch = accounts
			.map((a) => a.id)
			.filter((id) => !next.has(id));

		if (idsToFetch.length > 0) {
			const fetched = (await os.api("users/show", {
				userIds: idsToFetch,
			})) as misskey.entities.UserDetailed[];

			// NOTE: users/show の返り順は保証されないので、保存順に並べ直す
			for (const account of accounts) {
				const user = fetched.find((u) => u.id === account.id);
				if (user == null || account.token == null) continue;
				next.set(user.id, { ...user, token: account.token });
			}
		}
	} finally {
		users.value = next;
		waiting.value = false;
	}
}

init();

//#endregion

//#region 操作

/**
 * アカウントを追加する（サインイン用ダイアログを開く）
 *
 * @internal
 */
function clickAddAccount(): void {
	os.popup(
		defineAsyncComponent(() => import("@/components/MkSigninDialog.vue")),
		{},
		{
			done: async (res: { id: string; i: string }) => {
				if (!$i) {
					// 未ログインなら通常のログインにする（ページは読み込み直される）
					login(res.i);
					return;
				}
				await addAccount(res.id, res.i);
				os.success();
				await init();
				if (users.value.has(res.id)) {
					selectedUserId.value = res.id;
				}
			},
		},
		"closed",
	);
}

function clickChooseAccount(): void {
	if (selectedUser.value == null) return;
	phase.value = "consent";
}

function clickBackToAccountSelect(): void {
	phase.value = "accountSelect";
}

function clickCancel(): void {
	if (selectedUser.value == null) return;
	emit("deny", selectedUser.value.token);
}

function clickAccept(): void {
	if (selectedUser.value == null) return;
	// 呼び出し側が showUI() を呼ぶまで操作を止める
	waiting.value = true;
	emit("accept", selectedUser.value.token);
}

//#endregion

//#region 公開メソッド

/**
 * 結果の画面に切り替える
 *
 * @param state - 表示する結果。`redirecting` はアプリへ移動中の表示
 * @public
 */
function showUI(state: "success" | "denied" | "failed" | "redirecting"): void {
	phase.value = state;
	// 移動中は操作できないままでよいが、ローディングの膜は外して文言を見せる
	waiting.value = false;
}

defineExpose({
	showUI,
});

//#endregion
</script>

<style lang="scss" module>
.transition_enterActive,
.transition_leaveActive {
	transition: opacity 0.3s cubic-bezier(0, 0, 0.35, 1),
		transform 0.3s cubic-bezier(0, 0, 0.35, 1);
}
.transition_enterFrom {
	opacity: 0;
	transform: translateX(50px);
}
.transition_leaveTo {
	opacity: 0;
	transform: translateX(-50px);
}

// 画面の中央にカードを置く（zen UI で全画面表示される前提）
// NB: 列幅を minmax(0, 480px) にしておかないと、折り返さない長いコールバック URL などに
// 列が引っ張られ、スマホでカードが画面より広がってページごと横にはみ出す。
.container {
	min-height: calc(var(--vh, 1vh) * 100);
	padding: 32px 16px calc(env(safe-area-inset-bottom, 0px) + 32px);
	box-sizing: border-box;
	display: grid;
	grid-template-columns: minmax(0, 480px);
	justify-content: center;
	align-items: center;
	background: var(--bg);

	@media (max-width: 500px) {
		padding: 16px 12px calc(env(safe-area-inset-bottom, 0px) + 16px);
	}
}

.card {
	position: relative;
	min-width: 0;
	border-radius: var(--radius);
	background: var(--panel);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	overflow: hidden;
	overflow: clip;
}

.waiting {
	position: absolute;
	inset: 0;
	display: flex;
	justify-content: center;
	align-items: center;
	background: color-mix(in srgb, var(--panel), transparent 50%);
	cursor: wait;
	z-index: 1;
}

.root {
	display: flex;
	flex-direction: column;
	gap: 20px;
	box-sizing: border-box;
	padding: 40px 24px 32px;

	@media (max-width: 500px) {
		padding: 32px 16px 24px;
	}
}

.header {
	display: flex;
	flex-direction: column;
	gap: 12px;
	align-items: center;
	margin: 0 auto;
	max-width: 340px;
	text-align: center;
}

.icon,
.iconFallback {
	width: 56px;
	height: 56px;
	border-radius: 50%;
}

.icon {
	border: 1px solid var(--divider);
	background: #fff;
	object-fit: contain;
}

.iconFallback {
	display: grid;
	place-items: center;
	background: var(--accentedBg);
	color: var(--accent);
	font-size: 20px;

	&.iconError {
		background: color-mix(in srgb, var(--error), transparent 85%);
		color: var(--error);
	}
}

.headerText {
	font-size: 1.1em;
	font-weight: bold;
	word-break: auto-phrase;
}

.headerTextSub {
	opacity: 0.7;
	word-break: auto-phrase;
}

// 権限一覧の囲み
.box {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 14px 16px;
	border-radius: var(--radius);
	background: var(--bg);
	font-size: 0.95em;
}

.permissionList {
	max-height: 300px;
	overflow-y: auto;
	margin: 0;
	padding: 10px 12px 10px 2em;
	border-radius: var(--radius);
	background: var(--panel);
	font-size: 0.9em;
	line-height: 1.7;
}

.label {
	margin-bottom: 8px;
	font-size: 0.85em;
	opacity: 0.7;
}

.labelWithAction {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
	opacity: 1;

	> span {
		opacity: 0.7;
	}
}

.accountList {
	border: 1px solid var(--divider);
	border-radius: var(--radius);
	overflow: hidden;
	overflow: clip;
}

// ラジオボタン自体は隠し、直後の label を選択肢として見せる
.accountRadio {
	position: absolute;
	clip: rect(0, 0, 0, 0);
	pointer-events: none;

	&:focus-visible + .accountItem {
		outline: 2px solid var(--accent);
		outline-offset: -4px;
	}

	&:checked + .accountItem {
		background: var(--accent);
		color: var(--fgOnAccent);

		.accountCurrent {
			color: var(--fgOnAccent);
		}
	}
}

.accountItem {
	display: flex;
	align-items: center;
	width: 100%;
	box-sizing: border-box;
	padding: 10px 12px;
	font-size: 14px;
	text-align: left;
	cursor: pointer;
	-webkit-tap-highlight-color: transparent;

	&:hover {
		background: var(--buttonHoverBg);
	}

	&.static {
		cursor: default;

		&:hover {
			background: none;
		}
	}
}

.accountAvatar {
	flex-shrink: 0;
	width: 42px;
	height: 42px;
}

.accountBody {
	flex: 1;
	min-width: 0;
	padding: 0 10px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.accountName {
	display: block;
	font-weight: bold;
	overflow: hidden;
	text-overflow: ellipsis;
}

.accountAcct {
	opacity: 0.6;
	font-size: 0.9em;
}

.accountCurrent {
	flex-shrink: 0;
	color: var(--accent);
}

.accountAddIcon {
	display: grid;
	place-items: center;
	border-radius: 50%;
	background: var(--accentedBg);
	color: var(--accent);
}

.accountEmpty {
	padding: 16px;
	text-align: center;
	font-size: 0.9em;
	opacity: 0.6;
}

.buttons {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	gap: 12px;
}
</style>
