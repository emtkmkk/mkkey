<template>
	<MkContainer>
		<template #header
			><i
				class="ph-chart-bar ph-bold ph-lg"
				style="margin-right: 0.5em"
			></i
			>{{
				[i18n.ts.activity, suffix].filter(Boolean).join(" ")
			}}</template
		>
		<!--<template #func>
			<button class="_button" @click="showMenu">
				<i class="ph-dots-three-outline ph-bold ph-lg"></i>
			</button>
		</template>-->

		<div style="padding: 0.5rem">
			<MkChart
				:src="chartSrc"
				:args="{ user, withoutAll: true }"
				span="day"
				:limit="limit"
				:bar="true"
				:stacked="true"
				:detailed="false"
				:aspect-ratio="5"
			/>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as misskey from "calckey-js";
import MkContainer from "@/components/MkContainer.vue";
import MkChart from "@/components/MkChart.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

const props = withDefaults(
	defineProps<{
		user: misskey.entities.User;
		limit?: number;
		suffix?: string;
	}>(),
	{
		limit: 30,
	}
);

let chartSrc = $ref("per-user-notes");

function showMenu(ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: i18n.ts.notes,
				active: true,
				action: () => {
					chartSrc = "per-user-notes";
				},
			} /*,
			{
				text: i18n.ts.reaction,
				action: () => {
					chartSrc = "per-user-reactions";
				},
			} , {
		text: i18n.ts.following,
		action: () => {
			chartSrc = 'per-user-following';
		}
	}, {
		text: i18n.ts.followers,
		action: () => {
			chartSrc = 'per-user-followers';
		}
	}*/,
		],
		ev.currentTarget ?? ev.target
	);
}
</script>
