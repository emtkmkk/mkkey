<template>
	<div class="_formRoot">
		<FormInfo warn class="_formBlock">{{
			i18n.ts._accountDelete.mayTakeTime
		}}</FormInfo>
		<FormInfo v-if="$i" warn class="_formBlock">{{
			i18n.t("_accountDelete.warn", {name: $i.username, note: $i.notesCount?.toLocaleString(), follower: $i.followersCount?.toLocaleString()})
		}}</FormInfo>
		<FormInfo class="_formBlock">{{
			i18n.ts._accountDelete.sendEmail
		}}</FormInfo>
		<FormButton
			v-if="!$i?.isDeleted"
			danger
			class="_formBlock"
			@click="deleteAccount"
			>{{ i18n.ts._accountDelete.requestAccountDelete }}</FormButton
		>
		<FormButton v-else disabled>{{
			i18n.ts._accountDelete.inProgress
		}}</FormButton>
	</div>
</template>

<script lang="ts" setup>
import FormInfo from "@/components/MkInfo.vue";
import FormButton from "@/components/MkButton.vue";
import * as os from "@/os";
import { $i, signout } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

let confirmFlg = false;

async function deleteAccount() {
	if (!$i) return;
	if (!confirmFlg) {
		const confirm = await os.confirm({
			type: "warning",
			text: i18n.ts.deleteAccountRequestConfirm,
		});
		if (confirm.canceled) return;

		const typed = await os.inputText({
			text: i18n.t("typeToConfirm", { x: $i.username }),
		});
		if (typed.canceled) return;

		if (typed.result === $i.username) {
			confirmFlg = true;
		} else {
			os.alert({
				type: "error",
				text: "入力内容が異なります。",
			});
		}
	}
	if (confirmFlg) {
		os.post({
			initialText: "@emtk #アカウント削除希望",
			instant: true,
			initialVisibility: "specified",
			specified: await os.api("users/show", { userId: "9d5ts6in38" }),
			forceSpecified: true,
		});
	}
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._accountDelete.accountDelete,
	icon: "ph-warning ph-bold ph-lg",
});
</script>
