<template>
	<div v-size="{ min: [350, 500] }" class="yohlumlk">
		<MkAvatar class="avatar" :user="note.user" />
		<div class="main">
			<XNoteHeader class="header" :note="note" :mini="true" />
			<div class="body">
				<MkSubNoteContent class="text" :note="note" />
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as misskey from "calckey-js";
import XNoteHeader from "@/components/MkNoteHeader.vue";
import MkSubNoteContent from "@/components/MkSubNoteContent.vue";

const props = defineProps<{
	note: misskey.entities.Note;
	pinned?: boolean;
}>();

const showContent = $ref(false);
</script>

<style lang="scss" scoped>
.yohlumlk {
	display: flex;
	margin: 0;
	padding: 0;
	overflow: clip;
	font-size: 0.95em;

	&.min-width_350px {
		> .avatar {
			margin: 0 0.625rem 0 0;
			width: 2.75rem;
			height: 2.75rem;
		}
	}

	&.min-width_500px {
		> .avatar {
			margin: 0 0.75rem 0 0;
			width: 3rem;
			height: 3rem;
		}
	}

	> .avatar {
		flex-shrink: 0;
		display: block;
		margin: 0 0.625rem 0 0;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
	}

	> .main {
		flex: 1;
		min-width: 0;

		> .header {
			margin-bottom: 0.125rem;
		}
	}
}
</style>
