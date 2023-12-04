<template>
	<div class="defgtij">
		<div v-for="user in users" :key="user.id" class="avatar-holder">
			<MkAvatar :user="user" :show-indicator="true" class="avatar" />
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import * as os from "@/os";

const props = defineProps<{
	userIds: string[];
	sortStatus?: boolean;
	hiddenOfflineSleep?: boolean;
}>();

const users = ref([]);

watchEffect(() => {
  (async () => {
    const _users = (await os.api("users/show", {
      userIds: props.userIds,
    })).filter((x) =>
      props.hiddenOfflineSleep
        ? !(x.onlineStatus?.includes("offline") || x.onlineStatus?.includes("sleep"))
        : true
    );
    const onlineStatus = [
      "online",
      "half-online",
      "active",
      "half-active",
      "offline",
      "half-sleeping",
      "sleeping",
      "deep-sleeping",
      "never-sleeping",
      "unknown",
    ];
    users.value = props.sortStatus
      ? _users.sort((a, b) =>
          onlineStatus.indexOf(a.onlineStatus) < onlineStatus.indexOf(b.onlineStatus)
            ? -1
            : onlineStatus.indexOf(a.onlineStatus) === onlineStatus.indexOf(b.onlineStatus)
            ? 0
            : 1
        )
      : _users;
  })();
});
</script>

<style lang="scss">
.defgtij {
	padding: 12px;
	grid-gap: 12px;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(30px, 40px));
	place-content: center;

	> .avatar-holder {
		aspect-ratio: 1;

		> .avatar {
			width: 100%;
			height: 100%;
			aspect-ratio: 1;
		}
	}
}
</style>
