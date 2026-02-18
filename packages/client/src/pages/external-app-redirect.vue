<template>
	<div class="ipledcug">
		<div class="_fullinfo">
			<p class="_message">
				{{ config?.description ?? fallbackDescription }}
			</p>
			<MkButton class="button primary" @click="goToTarget">
				{{ config?.moveLabel ?? i18n.ts._externalAppRedirect?.move ?? "移動する" }}
			</MkButton>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * もこきー本体以外のアプリ（軽量クライアント /light、CLI /cli、SC /sc など）への誘導ページ。
 * クライアント起動中にこれらのパスへ遷移しようとした場合、
 * エラーではなく「〇〇へのリンクです。移動しますか？」と表示し、
 * 移動ボタンでリロードして該当ページへ遷移する。
 *
 * @remarks
 * NOTE: 実際のHTMLはサーバーが返すため、移動時は location.href でフルページ遷移する。
 *
 * @public
 */
import { computed } from "vue";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import MkButton from "@/components/MkButton.vue";
import { useRouter } from "@/router";

/** 誘導先ごとの表示名・説明。path は先頭の / なしで指定。 */
export const EXTERNAL_APP_CONFIG: Record<
	string,
	{ title: string; description: string; moveLabel?: string; icon: string }
> = {
	light: {
		title: "軽量クライアントへ移動",
		description:
			i18n.ts._externalAppRedirect?.lightDescription ??
			"もこきー軽量クライアントへのリンクです。移動しますか？",
		moveLabel: i18n.ts._externalAppRedirect?.move ?? "移動する",
		icon: "ph-arrow-square-out ph-bold ph-lg",
	},
	cli: {
		title: "CLIへ移動",
		description:
			i18n.ts._externalAppRedirect?.cliDescription ??
			"もこきーCLI（簡易クライアント）へのリンクです。移動しますか？",
		moveLabel: i18n.ts._externalAppRedirect?.move ?? "移動する",
		icon: "ph-terminal ph-bold ph-lg",
	},
	sc: {
		title: "SCへ移動",
		description:
			i18n.ts._externalAppRedirect?.scDescription ??
			"もこきーSCへのリンクです。移動しますか？",
		moveLabel: i18n.ts._externalAppRedirect?.move ?? "移動する",
		icon: "ph-arrow-square-out ph-bold ph-lg",
	},
};

const fallbackDescription =
	i18n.ts._externalAppRedirect?.description ??
	"こちらへのリンクです。移動しますか？";

const router = useRouter();
const currentPath = computed(() => {
	const r = router?.currentRef?.value;
	return r?.route?.path ?? "";
});
const pathKey = computed(() => currentPath.value.replace(/^\//, "") || "light");
const config = computed(
	() => EXTERNAL_APP_CONFIG[pathKey.value] ?? EXTERNAL_APP_CONFIG.light,
);

function goToTarget() {
	window.location.href = currentPath.value || "/light";
}

const headerActions = $computed(() => []);
const headerTabs = $computed(() => []);

definePageMetadata({
	title: config.value?.title ?? "外部アプリへ移動",
	icon: config.value?.icon ?? "ph-arrow-square-out ph-bold ph-lg",
});
</script>

<style scoped>
._message {
	margin-bottom: 16px;
	text-align: center;
}
</style>
