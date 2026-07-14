<template>
	<div class="_formRoot" style="padding: 32px">
		{{ message }}
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import * as os from "@/os";
import { definePageMetadata } from "@/scripts/page-metadata";

const props = defineProps<{
	token: string;
	kind?: string;
}>();

const message = ref("配信停止の手続きを行っています…");

onMounted(async () => {
	const isSummary = props.kind === "summary";
	try {
		await os.api("unsubscribe-email", {
			token: props.token,
			...(isSummary ? { kind: "summary" } : {}),
		});
		message.value = `${
			isSummary ? "未読通知のお知らせメール" : "お知らせメール"
		}の配信停止が完了しました。配信を再開する場合は、ログイン後に「設定 > メール」から変更できます。`;
	} catch {
		message.value =
			"配信停止の手続きができませんでした。リンクが無効か、すでに配信停止済みの可能性があります。";
	}
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: "メール配信停止",
	icon: "ph-envelope-simple-open ph-bold ph-lg",
});
</script>
