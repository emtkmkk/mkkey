<template>
	<MkSpacer :content-max="800">
		<XPhotos :key="user.id" :user="user" :limit="100"/>
	</MkSpacer>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as misskey from "calckey-js";

const props = defineProps<{
	user: misskey.entities.User;
}>();

</script>

<style lang="scss" scoped></style>