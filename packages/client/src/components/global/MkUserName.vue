<template>
	<Mfm
		:class="$style.root"
		:text="maxlength && (user.name || user.username).length > maxlength ? (user.name?.replaceAll(/\s?:\w+:/g,'')?.trim() || user.username).slice(0,maxlength) + (user.name?.replaceAll(/\s?:\w+:/g,'')?.trim()?.length > maxlength ? '…' : '') : (user.name?.trim() || user.username)"
		:plain="true"
		:nowrap="nowrap"
		:author="user"
		:is-note="false"
		:custom-emojis="user.emojis"
	/>
	{{ hostIcon && user.host ? '@' : '' }}
	<img
		class="icon"
		style="height:1.1em; border-radis:0.3rem;vertical-align: middle;"
		v-if="hostIcon && getIcon(hostIcon) && !errorIcon"
		:src="getIcon(hostIcon)"
		aria-hidden="true"
		@error="errorIcon = true"
	/>
	<img
		class="icon"
		style="height:1.1em; border-radis:0.3rem;vertical-align: middle;"
		v-if="altIcon && getIcon(altIcon) && errorIcon && !erroraltIcon"
		:src="getIcon(altIcon)"
		aria-hidden="true"
		@error="erroraltIcon = true"
	/>
	{{ hostIcon && errorIcon && (erroraltIcon || !altIcon) && user.host ? user.host : ''}}
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
		hostIcon?: string;
		altIcon?: string;
	}>(),
	{
		nowrap: true,
		maxlength: 0,
	}
);
let errorIcon = $ref(false);
let erroraltIcon = $ref(false);
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
