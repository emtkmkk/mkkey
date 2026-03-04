<template>
	<MkTooltip
		ref="tooltip"
		:target-element="targetElement"
		:max-width="250"
		@closed="emit('closed')"
	>
		<div class="beaffaef">
			<div
				v-for="(u, index) in displayedUsers"
				:key="`${u.user.id}-${index}`"
				class="user"
			>
				<MkAvatar class="avatar" :user="u.user" disableLink />
				<MkUserName class="name" :user="u.user" :nowrap="true" />
				<span v-if="u.count > 1" class="count">×{{ u.count }}</span>
			</div>
			<div v-if="shownCount < count" class="omitted">
				+{{ count - shownCount }}
			</div>
		</div>
	</MkTooltip>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import MkTooltip from "./MkTooltip.vue";

const props = defineProps<{
	users: any[]; // TODO
	count: number;
	targetElement: HTMLElement;
	showCount?: boolean;
	userRenoteCounts?: Record<string, number>;
}>();

const emit = defineEmits<{
	(ev: "closed"): void;
}>();

const displayedUsers = computed(() => {
	if (!props.showCount) {
		return props.users.map((user) => ({ user, count: 1 }));
	}

	const usersById = new Map<string, { user: any; count: number }>();

	for (const user of props.users) {
		if (usersById.has(user.id)) continue;

		usersById.set(user.id, {
			user,
			count: props.userRenoteCounts?.[user.id] ?? 1,
		});
	}

	return Array.from(usersById.values());
});

const shownCount = computed(() =>
	displayedUsers.value.reduce((sum, user) => sum + user.count, 0)
);
</script>

<style lang="scss" scoped>
.beaffaef {
	font-size: 0.9em;
	text-align: left;

	> .user {
		line-height: 1.5rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;

		&:not(:last-child) {
			margin-bottom: 0.1875rem;
		}

		> .avatar {
			width: 1.5rem;
			height: 1.5rem;
			margin-right: 0.1875rem;
		}
	}
}
</style>
