<template>
	<div class="vrvdvrys">
		<XPie class="pie" :value="usage" />
		<div>
			<p><i class="ph-microchip ph-bold ph-lg"></i>CPU</p>
			<p>{{ meta.cpu.cores }} Logical cores</p>
			<p>{{ meta.cpu.model }}</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from "vue";
import XPie from "./pie.vue";

const props = defineProps<{
	connection: any;
	meta: any;
}>();

let usage: number = $ref(0);

function onStats(stats) {
	usage = stats.cpu;
}

onMounted(() => {
	props.connection.on("stats", onStats);
});

onBeforeUnmount(() => {
	props.connection.off("stats", onStats);
});
</script>

<style lang="scss" scoped>
.vrvdvrys {
	display: flex;
	padding: 1rem;

	> .pie {
		height: 5.125rem;
		flex-shrink: 0;
		margin-right: 1rem;
	}

	> div {
		flex: 1;

		> p {
			margin: 0;
			font-size: 0.8em;

			&:first-child {
				font-weight: bold;
				margin-bottom: 0.25rem;

				> i {
					margin-right: 0.25rem;
				}
			}
		}
	}
}
</style>
