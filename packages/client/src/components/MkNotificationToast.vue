<template>
	<div class="mk-notification-toast" :style="{ zIndex }">
		<transition
			:name="$store.state.animation ? 'notification-toast' : ''"
			appear
			@after-leave="$emit('closed')"
		>
			<XNotification
				v-if="showing"
				:notification="notification"
				class="notification _acrylic"
			/>
		</transition>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import XNotification from "@/components/MkNotification.vue";
import * as os from "@/os";

defineProps<{
	notification: any; // TODO
}>();

const emit = defineEmits<{
	(ev: "closed"): void;
}>();

const zIndex = os.claimZIndex("high");
let showing = $ref(true);

onMounted(() => {
	window.setTimeout(() => {
		showing = false;
	}, 6000);
});
</script>

<style lang="scss" scoped>
.notification-toast-enter-active,
.notification-toast-leave-active {
	transition: opacity 0.3s, transform 0.3s !important;
}
.notification-toast-enter-from,
.notification-toast-leave-to {
	opacity: 0;
	transform: translateX(-15.625rem);
}

.mk-notification-toast {
	position: fixed;
	left: 0;
	width: 15.625rem;
	top: 2rem;
	padding: 0 2rem;
	pointer-events: none;

	@media (max-width: 43.75rem) {
		top: initial;
		bottom: 7rem;
		padding: 0 1rem;
	}

	@media (max-width: 31.25rem) {
		bottom: calc(env(safe-area-inset-bottom, 0) + 5.75rem);
		padding: 0 0.5rem;
	}

	> .notification {
		height: 100%;
		box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.3);
		border-radius: 0.5rem;
		overflow: hidden;
	}
}
</style>
