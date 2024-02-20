<template>
	<div class="zbwaqsat">
		<XPie class="pie" :value="usage" />
		<div>
			<p><i class="ph-hard-drives ph-bold ph-lg"></i>Disk</p>
			<p>Total: {{ bytes(total, 1) }}</p>
			<p>Free: {{ bytes(available, 1) }}</p>
			<p>Used: {{ bytes(used, 1) }}</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import XPie from "./pie.vue";
import bytes from "@/filters/bytes";

const props = defineProps<{
	meta: any; // TODO
}>();

const usage = $computed(() => props.meta.fs.used / props.meta.fs.total);
const total = $computed(() => props.meta.fs.total);
const used = $computed(() => props.meta.fs.used);
const available = $computed(() => props.meta.fs.total - props.meta.fs.used);
</script>

<style lang="scss" scoped>
.zbwaqsat {
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
