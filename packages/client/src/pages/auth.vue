<template>
	<MkAuthConfirm
		ref="authRoot"
		:name="session?.app.name"
		:permissions="session?.app.permission ?? []"
		:manual-waiting="session == null && !loadFailed"
		@accept="onAccept"
		@deny="onDeny"
	>
		<template #consentAdditionalInfo>
			<div v-if="redirectPreview" :class="$style.box">
				<div>{{ i18n.ts._auth.byClickingYouWillBeRedirectedToThisUrl }}</div>
				<div class="_monospace" :class="$style.url">
					{{ redirectPreview }}
				</div>
			</div>
		</template>
		<template #successAdditionalInfo>
			<MkKeyValue v-if="authCode" :copy="authCode">
				<template #key>{{ i18n.ts._auth.copyAsk }}</template>
				<template #value>{{ authCode }}</template>
			</MkKeyValue>
		</template>
	</MkAuthConfirm>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 旧式のアプリ認証（`/auth/:token`）の許可画面
 *
 * @remarks
 * - `auth/session/generate` で作られたセッションを許可する。Mastodon 互換 API の
 *   `/oauth/authorize` もここへ `?mastodon=true` 付きでリダイレクトしてくる。
 * - 見た目とアカウントの選択は {@link MkAuthConfirm} に任せ、選ばれたアカウントのトークンで
 *   `auth/accept` を呼ぶ（ブラウザのログイン状態は変えない）。
 * - CHANGED: 以前は「このアプリを既に許可済み」なら確認なしで自動的に許可していたが、
 *   別のアカウントで連携し直せるよう、毎回アカウントを確認してから許可するようにした。
 *   `auth/accept` は同じアプリ・同じユーザーに既存のトークンがあれば作り直さないので、二度押しても害はない。
 * - CHANGED: 拒否は画面の表示だけで済ませる。以前は存在しない `auth/deny` を呼んでいて必ず失敗していた。
 *   セッションは許可されないまま残るだけで、アプリ側にはトークンが渡らない。
 * - コールバック URL は `javascript:` などの危険なスキームを拒否する（GHSA-cc6r-chgr-8r5m 対策）。
 *
 * @public
 */
import { computed, onMounted, ref } from "vue";
import MkAuthConfirm from "@/components/MkAuthConfirm.vue";
import MkKeyValue from "@/components/MkKeyValue.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const props = defineProps<{
	token: string;
}>();

/**
 * `auth/session/show` の返り値のうち、この画面で使う部分
 *
 * @internal
 */
type AuthSession = {
	token: string;
	app: {
		id: string;
		name: string;
		callbackUrl: string | null;
		permission: string[];
	};
};

/** 遷移を許さないコールバック URL のスキーム */
const BLOCKED_PROTOCOLS = [
	"javascript:",
	"file:",
	"data:",
	"mailto:",
	"tel:",
	"vbscript:",
];

/** 認証コードを画面に表示して手で貼ってもらう方式のコールバック */
const OOB_CALLBACK = "urn:ietf:wg:oauth:2.0:oob";

const authRoot = ref<InstanceType<typeof MkAuthConfirm> | null>(null);
const session = ref<AuthSession | null>(null);
/** OOB 方式のときに表示する認証コード */
const authCode = ref<string | null>(null);
/** セッションの取得に失敗したか（読み込み中の表示を外すため） */
const loadFailed = ref(false);

//#region URL パラメータ

/**
 * 現在の URL のクエリを読み取る
 *
 * @remarks
 * NOTE: `URLSearchParams` は `+` を空白に変えてしまうため、`state` をそのまま返すよう
 * 以前の実装（`decodeURI` で読む）を保っている。
 *
 * @internal
 */
function getUrlParams(): Record<string, string> {
	return window.location.search
		.substring(1)
		.split("&")
		.filter((q) => q.length > 0)
		.reduce((result, q) => {
			const [k, v] = q.split("=");
			result[k] = decodeURI(v ?? "");
			return result;
		}, {} as Record<string, string>);
}

const isMastodon = !!getUrlParams().mastodon;

//#endregion

//#region コールバック

/**
 * コールバック URL を検査して返す（無い・OOB・不正なときは null）
 *
 * @internal
 */
function getSafeCallbackUrl(): URL | null {
	const callbackUrl = session.value?.app.callbackUrl;
	if (!callbackUrl || callbackUrl === OOB_CALLBACK) return null;
	try {
		const url = new URL(callbackUrl);
		return BLOCKED_PROTOCOLS.includes(url.protocol) ? null : url;
	} catch {
		return null;
	}
}

/** 確認画面に出す移動先（クエリを付ける前の URL） */
const redirectPreview = computed(() => getSafeCallbackUrl()?.toString() ?? null);

/**
 * 許可したあと、アプリへ戻す
 *
 * @remarks
 * - Mastodon 互換: `code` と `state` を付けてリダイレクトする。
 * - OOB: 認証コードを画面に表示する（Mastodon 互換でも同じ）。
 * - それ以外: `token` / `code` / `state` を付けてリダイレクトする（以前からの形式を維持）。
 *
 * @internal
 */
function accepted(): void {
	const s = session.value;
	if (s == null) return;

	// NOTE: Mastodon 互換でも OOB ならコードを表示する（リダイレクト先が無いため）
	if (s.app.callbackUrl === OOB_CALLBACK) {
		authCode.value = s.token;
		authRoot.value?.showUI("success");
		return;
	}

	const url = getSafeCallbackUrl();
	if (url == null) {
		// コールバックが無い（または不正な）ときは、アプリに戻ってもらう案内だけ出す
		authRoot.value?.showUI("success");
		return;
	}

	const params = getUrlParams();
	authRoot.value?.showUI("redirecting");
	if (isMastodon) {
		url.searchParams.append("code", s.token);
		if (params.state) url.searchParams.append("state", params.state);
		location.href = url.toString();
	} else {
		location.href = `${s.app.callbackUrl}?token=${s.token}&code=${
			s.token
		}&state=${params.state || ""}`;
	}
}

//#endregion

//#region 操作

/**
 * 選ばれたアカウントでセッションを許可する
 *
 * @param token - 許可に使うアカウントのトークン
 * @internal
 */
async function onAccept(token: string): Promise<void> {
	if (session.value == null) return;
	try {
		await os.api("auth/accept", { token: session.value.token }, token);
	} catch {
		// NOTE: 失敗理由は os.api がトーストで表示済み
		authRoot.value?.showUI("failed");
		return;
	}
	accepted();
}

function onDeny(): void {
	authRoot.value?.showUI("denied");
}

//#endregion

onMounted(async () => {
	try {
		session.value = (await os.api(
			"auth/session/show",
			{ token: props.token },
			undefined,
			true,
		)) as AuthSession;
	} catch {
		loadFailed.value = true;
		authRoot.value?.showUI("failed");
	}
});

definePageMetadata({
	title: i18n.ts.permission,
	icon: "ph-app-window ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.box {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 14px 16px;
	border-radius: var(--radius);
	background: var(--bg);
	font-size: 0.95em;
}

.url {
	padding: 10px 12px;
	border-radius: var(--radius);
	background: var(--panel);
	font-size: 0.85em;
	overflow-x: auto;
	white-space: nowrap;
}
</style>
