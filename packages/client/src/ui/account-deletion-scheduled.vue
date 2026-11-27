<template>
	<div class="mk-app account-deletion-scheduled">
		<div class="box _panel">
			<i class="icon ph-warning ph-bold"></i>
			<h1 class="title">{{ i18n.ts._accountDelete.scheduledTitle }}</h1>
			<p v-if="$i?.accountDeletionScheduledAt" class="date">
				{{
					i18n.t("_accountDelete.scheduledAt", {
						date: formatJstDateTime($i.accountDeletionScheduledAt),
					})
				}}
			</p>
			<p class="description">
				{{ i18n.ts._accountDelete.scheduledDescription }}
			</p>
			<div class="actions">
				<MkButton primary rounded @click="cancelAccountDeletionWithConfirm">
					{{ i18n.ts._accountDelete.cancelSchedule }}
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
 * - 「予約を解除」は、再び申請できる日時を書いた確認のポップアップを出してから解除する
 *   （{@link cancelAccountDeletionWithConfirm}）。
 * - NB: いつもの画面の共通部品（ui/_common_/common.vue）は使わない。ストリーミングにつないで
 *   通知を受け取ろうとするため。ダイアログを出す部分だけをここに書いている。
 *
 * @internal
 */
import MkButton from "@/components/MkButton.vue";
import { popups } from "@/os";
import { $i, signout } from "@/account";
import { i18n } from "@/i18n";
import {
	cancelAccountDeletionWithConfirm,
	formatJstDateTime,
} from "@/scripts/account-deletion";

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
