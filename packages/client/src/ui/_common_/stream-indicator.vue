<template>
	<div
		v-if="
			hasDisconnected &&
			$store.state.serverDisconnectedBehavior === 'quiet'
		"
		class="nsbbhtug"
		@click="resetDisconnected"
	>
		<div>{{ i18n.ts.disconnectedFromServer }}</div>
		<div class="command">
			<button class="_textButton" @click="reload">
				{{ i18n.ts.reload }}
			</button>
			<button class="_textButton">{{ i18n.ts.doNothing }}</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onUnmounted } from "vue";
import { stream } from "@/stream";
import { i18n } from "@/i18n";

let hasDisconnected = $ref(false);

function onDisconnected() {
	hasDisconnected = true;
}

function resetDisconnected() {
	hasDisconnected = false;
}

function reload() {
	location.reload();
}

stream.on("_disconnected_", onDisconnected);

onUnmounted(() => {
	stream.off("_disconnected_", onDisconnected);
});
</script>

<style lang="scss" scoped>
.nsbbhtug {
	position: fixed;
	z-index: 16385;
	bottom: 0.5rem;
	right: 0.5rem;
	margin: 0;
	padding: 0.375rem 0.75rem;
	font-size: 0.9em;
	color: #fff;
	background: #000;
	opacity: 0.8;
	border-radius: 0.25rem;
	max-width: 20rem;

	> .command {
		display: flex;
		justify-content: space-around;

		> button {
			padding: 0.7em;
		}
	}
}
</style>
