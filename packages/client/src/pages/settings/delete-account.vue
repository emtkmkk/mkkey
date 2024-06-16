<template>
	<div class="_formRoot">
		<FormInfo warn class="_formBlock">{{
			i18n.ts._accountDelete.mayTakeTime
		}}</FormInfo>
		<FormInfo class="_formBlock">{{
			i18n.ts._accountDelete.sendEmail
		}}</FormInfo>
		<FormButton
			v-if="!$i.isDeleted"
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
import { signout } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

async function deleteAccount() {
	os.post({
		initialText: "@emtk #アカウント削除希望",
		instant: true,
		initialVisibility: "specified",
		specified: await os.api("users/show", { userId: "9d5ts6in38" }),
		forceSpecified: true,
	})
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts._accountDelete.accountDelete,
	icon: "ph-warning ph-bold ph-lg",
});
</script>
