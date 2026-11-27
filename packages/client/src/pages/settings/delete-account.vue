<template>
	<div class="_formRoot">
		<FormInfo warn class="_formBlock">{{
			i18n.ts._accountDelete.mayTakeTime
		}}</FormInfo>
		<FormInfo v-if="$i" warn class="_formBlock" style="white-space: pre-wrap;">{{
			i18n.t("_accountDelete.warn", {name: $i.username, note: $i.notesCount?.toLocaleString(), follower: $i.followersCount?.toLocaleString()})
		}}</FormInfo>
		<FormInfo v-if="state" class="_formBlock" style="white-space: pre-wrap;">{{
			i18n.t("_accountDelete.scheduleInfo", {
				date: formatJstDateTime(state.scheduledAtIfRequestedNow),
			})
		}}</FormInfo>
		<FormInfo class="_formBlock">{{
			i18n.ts._accountDelete.duringSchedule
		}}</FormInfo>
		<FormInfo class="_formBlock">{{
			i18n.ts._accountDelete.sendEmail
		}}</FormInfo>

		<FormInfo v-if="state?.reRequestableAt" warn class="_formBlock">{{
			i18n.t("_accountDelete.cannotRequestUntil", {
				date: formatJstDateTime(state.reRequestableAt),
			})
		}}</FormInfo>

		<FormButton
			v-if="state?.scheduledAt"
			class="_formBlock"
			@click="cancelAccountDeletionWithConfirm"
			>{{ i18n.ts._accountDelete.cancelSchedule }}</FormButton
		>
		<FormButton
			v-else-if="!$i?.isDeleted"
			danger
			class="_formBlock"
			:disabled="state == null || state.reRequestableAt != null || requesting"
			@click="requestDeletion"
			>{{ i18n.ts._accountDelete.requestSchedule }}</FormButton
		>
		<FormButton v-else disabled>{{
			i18n.ts._accountDelete.inProgress
		}}</FormButton>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * アカウント削除の申請（予約）画面。
 *
 * @remarks
 * - 削除は予約制。予約すると日本時間 2:00 の定期ジョブが予定日時に削除する
 *   （20:00 より前の予約は翌日、以降は翌々日）。予定日時はこの画面と確認のダイアログに出す。
 * - 本人確認はログインと同じ。パスワード（2 段階認証ならワンタイムコードかセキュリティキー）、
 *   パスワードレスの人はセキュリティキー。最後にユーザー名を入れてもらう。
 * - 予約できたら、自分の情報を更新してページを読み直す。予約中はいつもの画面の代わりに専用画面が出る
 *   （ui/account-deletion-scheduled.vue）。
 * - CHANGED: 以前は確認のあと、管理者宛ての指名投稿の下書きを開いていた。
 *
 * @internal
 */
import { onMounted } from "vue";
import FormInfo from "@/components/MkInfo.vue";
import FormButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { $i, updateAccount } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import {
	cancelAccountDeletionWithConfirm,
	formatJstDateTime,
} from "@/scripts/account-deletion";
import { getSecurityKeyAssertion } from "@/scripts/security-key-assertion";

/** `i/account-deletion/show` の結果（読み込み前は null） */
let state = $ref<{
	scheduledAt: string | null;
	reRequestableAt: string | null;
	scheduledAtIfRequestedNow: string;
	reRequestableAtIfCanceledNow: string | null;
} | null>(null);
let requesting = $ref(false);

onMounted(async () => {
	state = await os.api("i/account-deletion/show");
});

/**
 * セキュリティキーで答える（チャレンジを発行して、キーに答えてもらう）。
 *
 * @returns サーバーに送る答え。取り消したら null
 * @internal
 */
async function answerWithSecurityKey() {
	if (!window.PublicKeyCredential || !navigator.credentials) {
		os.alert({ type: "error", text: i18n.ts._accountDelete.securityKeyUnavailable });
		return null;
	}
	try {
		const challenge = await os.api("i/account-deletion/key-challenge");
		os.toast(i18n.ts._accountDelete.touchSecurityKey);
		return await getSecurityKeyAssertion(challenge);
	} catch {
		return null;
	}
}

/**
 * ログインと同じ本人確認の値を集める。
 *
 * @returns 予約の API に渡す値。途中で取り消したら null
 * @internal
 */
async function collectIdentityProof(): Promise<{
	password?: string;
	token?: string;
	credential?: unknown;
} | null> {
	if (!$i) return null;

	// パスワードレスの人はセキュリティキーだけ
	if ($i.usePasswordLessLogin) {
		const credential = await answerWithSecurityKey();
		return credential ? { credential } : null;
	}

	const password = await os.inputText({
		type: "password",
		title: i18n.ts._accountDelete.enterPassword,
	});
	if (password.canceled) return null;

	if (!$i.twoFactorEnabled) return { password: password.result };

	// 2 段階認証: ワンタイムコードか、空のままならセキュリティキー
	const token = await os.inputText({
		title: i18n.ts._accountDelete.enterTotp,
	});
	if (token.canceled) return null;
	if (token.result.trim() !== "") {
		return { password: password.result, token: token.result.trim() };
	}
	const credential = await answerWithSecurityKey();
	return credential ? { password: password.result, credential } : null;
}

/**
 * 確認と本人確認のうえで、アカウントの削除を予約する。
 *
 * @internal
 */
async function requestDeletion() {
	if (!$i || !state) return;

	const latest = await os.api("i/account-deletion/show");
	state = latest;
	if (latest.reRequestableAt != null) return;

	const confirm = await os.confirm({
		type: "warning",
		text: i18n.t("_accountDelete.requestConfirm", {
			date: formatJstDateTime(latest.scheduledAtIfRequestedNow),
		}),
	});
	if (confirm.canceled) return;

	const typed = await os.inputText({
		text: i18n.t("typeToConfirm", { x: $i.username }),
	});
	if (typed.canceled) return;
	if (typed.result !== $i.username) {
		os.alert({ type: "error", text: i18n.ts.inputMismatch });
		return;
	}

	const proof = await collectIdentityProof();
	if (proof == null) return;

	requesting = true;
	try {
		const res = await os.apiWithDialog("i/account-deletion/request", proof);
		updateAccount({ accountDeletionScheduledAt: res.scheduledAt });
		location.reload();
	} catch {
		// エラーは apiWithDialog がダイアログで出している
		state = await os.api("i/account-deletion/show");
	} finally {
		requesting = false;
	}
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._accountDelete.accountDelete,
	icon: "ph-warning ph-bold ph-lg",
});
</script>
