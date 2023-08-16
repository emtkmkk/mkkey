<template>
	<Mfm
		:class="$style.root"
		:text="maxlength && (user.name || user.username).length > maxlength ? (user.name?.replaceAll(/\s?:\w+:/g,'') || user.username).slice(0,maxlength) + (user.name?.replaceAll(/\s?:\w+:/g,'')?.length > maxlength ? '…' : '') : (user.name || user.username)"
		:plain="true"
		:nowrap="nowrap"
		:author="user"
		:custom-emojis="user.emojis"
	/>
	<img 
		class="icon"
		v-if="hostIcon && getIcon(hostIcon) && !errorIcon"
		:src="getIcon(hostIcon)"
		aria-hidden="true"
		@error="errorIcon = true"
	/>
	{{ hostIcon && errorIcon && user.host ? '@' + user.host : ''}}
</template>

<script lang="ts" setup>
import {} from "vue";
import * as misskey from "calckey-js";
import { getProxiedImageUrlNullable } from "@/scripts/media-proxy";

const props = withDefaults(
	defineProps<{
		user: misskey.entities.User;
		nowrap?: boolean;
		maxlength?: number;
		hosticon?: string;
	}>(),
	{
		nowrap: true,
		maxlength: 0,
	}
);
let errorIcon = $ref(false);
function getIcon(url): string {
		return (
					getProxiedImageUrlNullable(url, "preview")
		);
}
</script>

<style lang="scss" module>
.root {
	unicode-bidi: isolate;
}
.icon {
		height: 100%;
		border-radius: 0.3rem;
}
</style>
