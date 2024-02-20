<template>
	<div class="zlxnikvl">
		<XPie class="pie" :value="usage" />
		<div>
			<p><i class="ph-cpu ph-bold ph-lg"></i>RAM</p>
			<p>Total: {{ bytes(total, 1) }}</p>
			<p>Used: {{ bytes(used, 1) }}</p>
			<p>Free: {{ bytes(free, 1) }}</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from "vue";
import XPie from "./pie.vue";
import bytes from "@/filters/bytes";

const props = defineProps<{
	connection: any;
	meta: any;
}>();

let usage: number = $ref(0);
let total: number = $ref(0);
let used: number = $ref(0);
let free: number = $ref(0);

function onStats(stats) {
	usage = stats.mem.active / props.meta.mem.total;
	total = props.meta.mem.total;
	used = stats.mem.active;
	free = total - used;
}

onMounted(() => {
	props.connection.on("stats", onStats);
});

onBeforeUnmount(() => {
	props.connection.off("stats", onStats);
});
</script>

<style lang="scss" scoped>
.zlxnikvl {
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
