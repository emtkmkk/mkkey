<template>
	<span v-if="note.visibility !== 'public'" :class="$style.visibility">
		<i
			v-if="note.visibility === 'home'"
			class="ph-house ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.homeTooltip"
		></i>
		<i
			v-else-if="note.visibility === 'followers'"
			class="ph-lock-simple ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.followersTooltip"
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
	<span v-if="note.localOnly && !note.channelId && note.visibility !== 'followers'" :class="$style.localOnly"
		><i
			class="ph-hand-heart ph-bold ph-lg"
			v-tooltip="i18n.ts._visibility.localAndFollowerTooltip"
		></i
	></span>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import XDetails from "@/components/MkUsersTooltip.vue";
import * as os from "@/os";
import { useTooltip } from "@/scripts/use-tooltip";
import { i18n } from "@/i18n";

const props = defineProps<{
	note: {
		visibility: string;
		localOnly?: boolean;
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
				count: (props.note.visibleUserIds?.length || 0) + (props.note.ccUserIdsCount || 0),
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
