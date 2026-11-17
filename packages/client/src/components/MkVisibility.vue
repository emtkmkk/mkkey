<template>
	<span v-if="note.visibility !== 'public'" :class="$style.visibility">
		<i
			v-if="note.visibility === 'home' && note.semiPublic && !note.localOnly"
			:class="SEMI_PUBLIC_ICON"
			v-tooltip="i18n.ts._visibility.semiPublicTooltip"
		></i>
		<i
			v-else-if="note.visibility === 'home'"
			class="ph-house ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.homeTooltip"
		></i>
		<i
			v-else-if="note.visibility === 'followers'"
			class="ph-lock-simple ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.followersTooltip"
		></i>
		<i
			v-else-if="note.visibility === 'specified' && note.ccUserIdsCount"
			ref="specified"
			class="ph-user-circle-gear ph-bold ph-lg"
		></i>
		<i
			v-else-if="note.visibility === 'specified'"
			ref="specified"
			class="ph-envelope-simple-open ph-bold ph-lg"
		></i>
	</span>
	<span v-if="note.localOnly && note.channelId" :class="$style.localOnly"
		><i
			class="ph-hand-fist ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.localOnlyTooltip"
		></i
	></span>
	<span
		v-if="
			note.localOnly && !note.channelId && note.visibility !== 'followers'
		"
		:class="$style.localOnly"
		><i
			class="ph-hand-heart ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.localAndFollowerTooltip"
		></i
	></span>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ノートの公開範囲（ホーム・フォロワー・ダイレクト・ローカル限定など）をアイコンで表示する。
 *
 * @remarks
 * 公開（public）のときは何も出さない。
 * セミパブリック（ローカルではホーム、リモートには公開）は、ホームの代わりに専用のアイコンを出す。
 *
 * @internal
 */
import { ref } from "vue";
import XDetails from "@/components/MkUsersTooltip.vue";
import * as os from "@/os";
import { useTooltip } from "@/scripts/use-tooltip";
import { i18n } from "@/i18n";
import { SEMI_PUBLIC_ICON } from "@/scripts/semi-public";

const props = defineProps<{
	note: {
		visibility: string;
		localOnly?: boolean;
		semiPublic?: boolean;
		visibleUserIds?: string[];
		ccUserIdsCount?: number;
		channelId?: string;
	};
}>();

const specified = $ref<HTMLElement>();

if (props.note.visibility === "specified") {
	useTooltip($$(specified), async (showing) => {
		const users = await os.api("users/show", {
			userIds: props.note.visibleUserIds,
			limit: 10,
		});

		os.popup(
			XDetails,
			{
				showing,
				users,
				count:
					(props.note.visibleUserIds?.length || 0) +
					(props.note.ccUserIdsCount || 0),
				targetElement: specified,
			},
			{},
			"closed"
		);
	});
}
</script>

<style lang="scss" module>
.visibility,
.localOnly {
	margin-left: 0.5em;
}
</style>
