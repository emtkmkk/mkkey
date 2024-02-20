<template>
	<div>
		<Transition
			:name="$store.state.animation ? '_transition_zoom' : ''"
			mode="out-in"
		>
			<MkLoading v-if="fetching" />
			<div v-else :class="$style.root" class="_panel">
				<MkA
					v-for="user in moderators"
					:key="user.id"
					class="user"
					:to="`/user-info/${user.id}`"
				>
					<MkAvatar
						:user="user"
						class="avatar"
						indicator
						disableLink
					/>
				</MkA>
			</div>
		</Transition>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import * as os from "@/os";
import number from "@/filters/number";
import { i18n } from "@/i18n";

let moderators: any = $ref(null);
let fetching = $ref(true);

onMounted(async () => {
	moderators = await os.api("admin/show-users", {
		sort: "+updatedAt",
		state: "adminOrModerator",
		limit: 30,
	});

	fetching = false;
});
</script>

<style lang="scss" module>
.root {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(1.875rem, 2.5rem));
	grid-gap: 0.75rem;
	place-content: center;
	padding: 0.75rem;

	&:global {
		> .user {
			width: 100%;
			height: 100%;
			aspect-ratio: 1;

			> .avatar {
				width: 100%;
				height: 100%;
			}
		}
	}
}
</style>
