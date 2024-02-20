<template>
	<div class="mk-toast">
		<transition
			:name="$store.state.animation ? 'toast' : ''"
			appear
			@after-leave="emit('closed')"
		>
			<div v-if="showing" class="body _acrylic" :style="{ zIndex }">
				<Mfm
					class="message"
					:text="message"
					:plain="true"
					:nowrap="nowrap"
				/>
			</div>
		</transition>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import * as os from "@/os";

const props = defineProps<{
	message: string;
}>();

const emit = defineEmits<{
	(ev: "closed"): void;
}>();

const zIndex = os.claimZIndex("high");
let showing = $ref(true);
const toastMessageMatch = props.message.match(/.*[、？]/);
const toastMessageLength = toastMessageMatch ? toastMessageMatch[0].length : 0;

onMounted(() => {
	window.setTimeout(() => {
		showing = false;
	}, 4000 + (toastMessageLength >= 6 ? (toastMessageLength - 5) * 500 : 0));
});
</script>

<style lang="scss" scoped>
.toast-enter-active,
.toast-leave-active {
	transition: opacity 0.3s, transform 0.3s !important;
}
.toast-enter-from,
.toast-leave-to {
	opacity: 0;
	transform: translateY(-100%);
}

.mk-toast {
	> .body {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		margin: 0 auto;
		margin-top: 1rem;
		min-width: 18.75rem;
		max-width: calc(100% - 2rem);
		width: min-content;
		box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.3);
		border-radius: 0.5rem;
		overflow: clip;
		text-align: center;
		pointer-events: none;

		> .message {
			padding: 1rem 1.5rem;
		}
	}
}
</style>
