<template>
	<Mfm
		:class="$style.root"
		:text="
			maxlength && name.length > maxlength
				? shortName.slice(0, maxlength) +
				  (shortName?.length > maxlength ? '…' : '')
				: name
		"
		:plain="true"
		:nowrap="nowrap"
		:author="user"
		:is-note="false"
		:custom-emojis="user.emojis"
	/>
	{{ hostIcon && user.host ? "@" : "" }}
	<img
		class="icon"
		style="height: 1.1em; border-radis: 0.3rem; vertical-align: middle"
		v-if="hostIcon && getIcon(hostIcon) && !errorIcon"
		:src="getIcon(hostIcon)"
		aria-hidden="true"
		@error="errorIcon = true"
	/>
	<img
		class="icon"
		style="height: 1.1em; border-radis: 0.3rem; vertical-align: middle"
		v-if="altIcon && getIcon(altIcon) && errorIcon && !erroraltIcon"
		:src="getIcon(altIcon)"
		aria-hidden="true"
		@error="erroraltIcon = true"
	/>
	{{
		hostIcon && errorIcon && (erroraltIcon || !altIcon) && user.host
			? user.host
			: ""
	}}
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
		original?: boolean;
	}>(),
	{
		nowrap: true,
		maxlength: 0,
	}
);
let errorIcon = $ref(false);
let erroraltIcon = $ref(false);
let shortName = $computed(() => {
	if (props.original && props.user.originalName) {
		return `${props.user.name
			?.replaceAll(/\s?:\w+:/g, "")
			?.trim()} (${props.user.originalName
			?.replaceAll(/\s?:\w+:/g, "")
			?.trim()})`;
	} else {
		return (
			props.user.name?.replaceAll(/\s?:\w+:/g, "")?.trim() ||
			props.user.username
		);
	}
});
let name = $computed(() => {
	if (props.original && props.user.originalName) {
		return `${props.user.name} (${props.user.originalName})`;
	} else {
		return props.user.name || props.user.username;
	}
});
function getIcon(url): string {
	return getProxiedImageUrlNullable(url, "preview");
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
