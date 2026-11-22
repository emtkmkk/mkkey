<template>
	<MkAuthConfirm
		ref="authRoot"
		:name="name"
		:icon="icon || undefined"
		:permissions="_permissions"
		@accept="onAccept"
		@deny="onDeny"
	>
		<template #consentAdditionalInfo>
			<div v-if="safeCallback" :class="$style.box">
				<div>{{ i18n.ts._auth.byClickingYouWillBeRedirectedToThisUrl }}</div>
				<div class="_monospace" :class="$style.url">
					{{ safeCallback }}
				</div>
			</div>
			<FormInput v-model="comment">
				<template #label>{{ i18n.ts._auth.comment }}</template>
			</FormInput>
		</template>
	</MkAuthConfirm>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * MiAuth（`/miauth/:session`）の許可画面
 *
 * @remarks
 * - 見た目と「どのアカウントで許可するか」の選択は {@link MkAuthConfirm} に任せ、
 *   このページは MiAuth のパラメータの解釈と `miauth/gen-token` の呼び出しだけを行う。
 * - NOTE: トークンは、選ばれたアカウントのトークンで発行する（ブラウザのログイン状態は変えない）。
 * - mkkey 独自: トークン識別用のコメント（20 文字まで）をアプリ名の後ろに付けて保存する。
 *   設定 → API の連携アプリ一覧で見分けるため。
 * - コールバック URL は `javascript:` などの危険なスキームを拒否する（XSS 対策）。
 *   不正な URL は確認画面にも表示しない。
 *
 * @public
 */
import { computed, ref } from "vue";
import MkAuthConfirm from "@/components/MkAuthConfirm.vue";
import FormInput from "@/components/form/input.vue";
import * as os from "@/os";
import { appendQuery, query } from "@/scripts/url";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const props = defineProps<{
	session: string;
	callback?: string;
	name?: string;
	icon?: string;
	permission?: string; // コンマ区切り
}>();

/** 遷移を許さないコールバック URL のスキーム */
const BLOCKED_PROTOCOLS = [
	"javascript:",
	"file:",
	"data:",
	"mailto:",
	"tel:",
	"vbscript:",
];

const _permissions = (props.permission ?? "")
	.split(",")
	.map((permission) => permission.trim())
	.filter((permission) => permission.length > 0);

const appName = props.name?.trim() || "MiAuth";

/**
 * 遷移してよいコールバック URL（無い・不正なときは null）
 *
 * @internal
 */
const safeCallback = computed((): string | null => {
	if (!props.callback) return null;
	try {
		const url = new URL(props.callback);
		return BLOCKED_PROTOCOLS.includes(url.protocol) ? null : props.callback;
	} catch {
		return null;
	}
});

const authRoot = ref<InstanceType<typeof MkAuthConfirm> | null>(null);
const comment = ref("");

/**
 * 選ばれたアカウントでトークンを発行し、アプリへ戻す
 *
 * @param token - 許可に使うアカウントのトークン（{@link MkAuthConfirm} から渡される）
 * @internal
 */
async function onAccept(token: string): Promise<void> {
	const trimmedComment = comment.value.trim().slice(0, 20);
	try {
		await os.api(
			"miauth/gen-token",
			{
				session: props.session,
				name: `${appName}${trimmedComment ? ` (${trimmedComment})` : ""}`,
				iconUrl: props.icon,
				permission: _permissions,
			},
			token,
		);
	} catch {
		// NOTE: 失敗理由は os.api がトーストで表示済み
		authRoot.value?.showUI("failed");
		return;
	}

	if (props.callback && safeCallback.value == null) {
		// 不正なコールバックには移動しない（トークン自体は発行済み）
		authRoot.value?.showUI("success");
		return;
	}

	if (safeCallback.value) {
		authRoot.value?.showUI("redirecting");
		location.href = appendQuery(
			safeCallback.value,
			query({
				session: props.session,
			}),
		);
	} else {
		authRoot.value?.showUI("success");
	}
}

function onDeny(): void {
	authRoot.value?.showUI("denied");
}

definePageMetadata({
	title: "MiAuth",
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
