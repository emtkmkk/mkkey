<template>
	<MkSpacer :content-max="800">
		<MkButton style="text-align: center; margin: auto; margin-top: calc(var(--margin) / 2);" v-if="!showImages" @click="showImages = true">{{ "画像一覧を読み込む" }}</MkButton>
		<XPhotos v-if="showImages" :key="user.id + 'detail'" :user="user" :limit="100"/>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from "vue";
import * as misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";

const XPhotos = defineAsyncComponent(() => import("./index.photos.vue"));
let showImages = ref(!defaultStore.state.enableDataSaverMode);

const props = defineProps<{
	user: misskey.entities.User;
}>();

</script>

<style lang="scss" scoped></style>