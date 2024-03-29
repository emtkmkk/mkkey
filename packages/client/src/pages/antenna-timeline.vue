<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader :actions="headerActions" :tabs="headerTabs"
		/></template>
		<div
			ref="rootEl"
			v-hotkey.global="keymap"
			v-size="{ min: [800] }"
			class="tqmomfks"
		>
			<div v-if="queue > 0" class="new">
				<button class="_buttonPrimary" @click="top()">
					{{ i18n.ts.newNoteRecived }}
				</button>
			</div>
			<div class="tl _block">
				<XTimeline
					ref="tlEl"
					:key="antennaId"
					class="tl"
					src="antenna"
					:antenna="antennaId"
					:sound="true"
					@queue="queueUpdated"
				/>
			</div>
		</div>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, inject, watch } from "vue";
import XTimeline from "@/components/MkTimeline.vue";
import { scroll } from "@/scripts/scroll";
import * as os from "@/os";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { i18n } from "@/i18n";

const router = useRouter();

const props = defineProps<{
	antennaId: string;
}>();

let antenna = $ref(null);
let queue = $ref(0);
let rootEl = $ref<HTMLElement>();
let tlEl = $ref<InstanceType<typeof XTimeline>>();
const keymap = $computed(() => ({
	t: focus,
}));

function queueUpdated(q, a) {
	queue = q;
}

function top() {
	scroll(rootEl, { top: 0 });
}

async function timetravel() {
	const { canceled, result: date } = await os.inputDate({
		title: i18n.ts.date,
	});
	if (canceled) return;

	tlEl.timetravel(date);
}

function settings() {
	router.push(`/my/antennas/${props.antennaId}`);
}

async function doMarkRead() {
	const ret = await os.api("antennas/mark-read", {
		antennaId: props.antennaId,
	});

	if (ret) {
		return true;
	}

	throw new Error("Failed to mark all as read");
}

async function markRead() {
	await os.promiseDialog(doMarkRead());
}

function focus() {
	tlEl.focus();
}

watch(
	() => props.antennaId,
	async () => {
		antenna = await os.api("antennas/show", {
			antennaId: props.antennaId,
		});
	},
	{ immediate: true }
);

const headerActions = $computed(() =>
	antenna
		? [
				{
					icon: "ph-calendar-blank ph-bold ph-lg",
					text: i18n.ts.jumpToSpecifiedDate,
					handler: timetravel,
				},
				{
					icon: "ph-gear-six ph-bold ph-lg",
					text: i18n.ts.settings,
					handler: settings,
				},
				{
					icon: "ph-check ph-bold ph-lg",
					text: i18n.ts.markAllAsRead,
					handler: markRead,
				},
		  ]
		: []
);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() =>
		antenna
			? {
					title: antenna.name,
					icon: "ph-flying-saucer ph-bold ph-lg",
			  }
			: null
	)
);
</script>

<style lang="scss" scoped>
.tqmomfks {
	padding: var(--margin);

	> .new {
		position: sticky;
		top: calc(var(--stickyTop, 0) + 1rem);
		z-index: 1000;
		width: 100%;

		> button {
			display: block;
			margin: var(--margin) auto 0 auto;
			padding: 0.5rem 1rem;
			border-radius: 2rem;
		}
	}

	> .tl {
		background: none;
		border-radius: var(--radius);
		overflow: clip;
	}

	&.min-width_800px {
		max-width: 50rem;
		margin: 0 auto;
	}
}
</style>
