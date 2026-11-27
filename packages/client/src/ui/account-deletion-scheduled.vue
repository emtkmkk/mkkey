<template>
	<div class="mk-app account-deletion-scheduled">
		<div class="box _panel">
			<i class="icon ph-warning ph-bold"></i>
			<h1 class="title">{{ i18n.ts._accountDelete.scheduledTitle }}</h1>
			<p v-if="$i?.accountDeletionScheduledAt" class="date">
				<I18n :src="i18n.ts._accountDelete.scheduledAt" text-tag="span">
					<template #date>
						<span class="nowrap">{{
							formatJstDateTime($i.accountDeletionScheduledAt)
						}}</span>
					</template>
				</I18n>
			</p>
			<p class="description">
				{{ i18n.ts._accountDelete.scheduledDescription }}
			</p>
			<div class="actions">
				<MkButton primary rounded @click="cancelAccountDeletionWithConfirm">
					{{ i18n.ts._accountDelete.cancelSchedule }}
				</MkButton>
				<MkButton v-if="hasOtherAccounts" rounded @click="onSwitchAccount">
					<i class="ph-users ph-bold"></i>
					{{ i18n.ts.switchAccount }}
				</MkButton>
				<MkButton rounded @click="onSignout">
					{{ i18n.ts.logout }}
				</MkButton>
			</div>
		</div>

		<component
			:is="popup.component"
			v-for="popup in popups"
			:key="popup.id"
			v-bind="popup.props"
			v-on="popup.events"
		/>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * アカウント削除を予約中の人に、いつもの画面の代わりに出す専用画面。
 *
 * @remarks
 * - 予約中は、予約の解除とログアウトのほかは何もできない（サーバーがほかの API を断る）。
 *   そのため、タイムラインなどのいつもの画面は出さず、この画面だけを出す（init.ts が選ぶ）。
 * - 出すもの: 予約していること、削除の予定日時（日本時間）、「予約を解除」、ログアウト。
 *   この端末にほかのアカウントも保存されていれば、「アカウントを切り替え」も出す
 *   （切り替えメニューが使う `users/show` は、予約中でも呼べる API に入っている）。
 * - 「予約を解除」は、再び申請できる日時を書いた確認のポップアップを出してから解除する
 *   （{@link cancelAccountDeletionWithConfirm}）。
 * - 文は、文節で折り返して行の長さをそろえ（`word-break: auto-phrase`・`text-wrap: balance`）、
 *   予定日時はひとかたまりで折り返さない。日本語が単語の途中で折り返されて読みにくかったため。
 *   この指定に対応していないブラウザでは、今までどおりの折り返しになる。
 * - NB: いつもの画面の共通部品（ui/_common_/common.vue）は使わない。ストリーミングにつないで
 *   通知を受け取ろうとするため。ダイアログを出す部分だけをここに書いている。
 *
 * @internal
 */
import { onMounted } from "vue";
import MkButton from "@/components/MkButton.vue";
import { popups } from "@/os";
import { $i, getAccounts, openAccountMenu, signout } from "@/account";
import { i18n } from "@/i18n";
import {
	cancelAccountDeletionWithConfirm,
	formatJstDateTime,
} from "@/scripts/account-deletion";

/** この端末に、ほかのアカウントも保存されているか */
let hasOtherAccounts = $ref(false);

onMounted(async () => {
	const accounts = await getAccounts();
	hasOtherAccounts = accounts.some((account) => account.id !== $i?.id);
});

/**
 * ほかのアカウントを選ぶメニューを出す。選ぶとそのアカウントに切り替わる（ページを読み直す）。
 *
 * @param ev - ボタンを押したときのイベント（メニューの位置に使う）
 * @internal
 */
function onSwitchAccount(ev: MouseEvent) {
	openAccountMenu({ withExtraOperation: false }, ev);
}

/**
 * ログアウトする。
 *
 * @internal
 */
function onSignout() {
	signout();
}
</script>

<style lang="scss" scoped>
.account-deletion-scheduled {
	min-height: calc(var(--vh, 1vh) * 100);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16px;
	box-sizing: border-box;

	> .box {
		max-width: 480px;
		width: 100%;
		padding: 32px 24px;
		text-align: center;

		> .icon {
			font-size: 3em;
			color: var(--warn);
		}

		> .title,
		> .date,
		> .description {
			// 日本語を単語の途中で折り返さず、行の長さもそろえる（対応していないブラウザは無視する）
			word-break: auto-phrase;
			text-wrap: balance;
		}

		.nowrap {
			white-space: nowrap;
		}

		> .title {
			font-size: 1.3em;
			margin: 12px 0 8px;
		}

		> .date {
			font-weight: bold;
			margin: 0 0 8px;
		}

		> .description {
			opacity: 0.8;
			margin: 0 0 24px;
		}

		> .actions {
			display: flex;
			flex-direction: column;
			gap: 8px;
			align-items: center;
		}
	}
}
</style>
