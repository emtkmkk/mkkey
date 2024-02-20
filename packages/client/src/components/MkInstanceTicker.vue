<template>
	<div
		v-if="
			$store.state.developerTicker &&
			instance.softwareVersion?.length > 13
		"
		class="hpaizdrt"
		v-tooltip="
			instance.name + '/' + capitalize(instance.softwareName || '???')
		"
		ref="ticker"
		:style="bg"
	>
		<img
			class="icon"
			v-if="getInstanceFavicon(instance) && !errorFavicon"
			:src="getInstanceFavicon(instance)"
			aria-hidden="true"
			@error="errorFavicon = true"
		/>
		<img
			class="icon"
			v-if="
				getInstanceIcon(instance) &&
				instance.faviconUrl !== instance.iconUrl &&
				!errorIcon
			"
			:src="getInstanceIcon(instance)"
			aria-hidden="true"
			@error="errorIcon = true"
		/>
		<span class="name">{{ instance.softwareVersion || "???" }}</span>
	</div>
	<div
		v-else-if="$store.state.developerTicker"
		class="hpaizdrt"
		v-tooltip="instance.name"
		ref="ticker"
		:style="bg"
	>
		<img
			class="icon"
			v-if="getInstanceFavicon(instance) && !errorFavicon"
			:src="getInstanceFavicon(instance)"
			aria-hidden="true"
			@error="errorFavicon = true"
		/>
		<img
			class="icon"
			v-if="
				getInstanceIcon(instance) &&
				instance.faviconUrl !== instance.iconUrl &&
				!errorIcon
			"
			:src="getInstanceIcon(instance)"
			aria-hidden="true"
			@error="errorIcon = true"
		/>
		<span class="name">{{
			capitalize(instance.softwareName || "???") +
			"/" +
			(instance.softwareVersion || "???")
		}}</span>
	</div>
	<div
		v-else
		class="hpaizdrt"
		v-tooltip="
			capitalize(instance.softwareName || '???') +
			'/' +
			(instance.softwareVersion || '???')
		"
		ref="ticker"
		:style="bg"
	>
		<img
			class="icon"
			v-if="getInstanceFavicon(instance) && !errorFavicon"
			:src="getInstanceFavicon(instance)"
			aria-hidden="true"
			@error="errorFavicon = true"
		/>
		<img
			class="icon"
			v-if="
				getInstanceIcon(instance) &&
				instance.faviconUrl !== instance.iconUrl &&
				!errorIcon
			"
			:src="getInstanceIcon(instance)"
			aria-hidden="true"
			@error="errorIcon = true"
		/>
		<span class="name">{{ instance.name }}</span>
	</div>
</template>

<script lang="ts" setup>
import { instanceName } from "@/config";
import { instance as Instance } from "@/instance";
import { getProxiedImageUrlNullable } from "@/scripts/media-proxy";
import { defaultStore } from "@/store";

const props = defineProps<{
	instance?: {
		faviconUrl?: string;
		iconUrl?: string;
		name: string;
		themeColor?: string;
		softwareName?: string;
		softwareVersion?: string;
	};
}>();

let ticker = $ref<HTMLElement | null>(null);
let errorFavicon = $ref(false);
let errorIcon = $ref(false);

// if no instance data is given, this is for the local instance
const instance = props.instance ?? {
	faviconUrl: Instance.faviconUrl,
	iconUrl: Instance.iconUrl,
	name: instanceName,
	themeColor: (
		document.querySelector(
			'meta[name="theme-color-orig"]'
		) as HTMLMetaElement
	)?.content,
	softwareName: Instance.softwareName ?? "Calckey",
	softwareVersion: Instance.version,
};

const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1);

const computedStyle = getComputedStyle(document.documentElement);
const themeColor =
	instance.themeColor ?? computedStyle.getPropertyValue("--bg");

const bg = {
	background: `linear-gradient(90deg, ${themeColor}, ${themeColor}55)`,
};

function getInstanceFavicon(instance): string {
	return getProxiedImageUrlNullable(instance.faviconUrl, "preview");
}
function getInstanceIcon(instance): string {
	return getProxiedImageUrlNullable(instance.iconUrl, "preview");
}
</script>

<style lang="scss" scoped>
.hpaizdrt {
	display: flex;
	align-items: center;
	height: 1.1em;
	justify-self: flex-end;
	padding: 0.2em 0.4em;
	border-radius: 6.25rem;
	font-size: 0.8em;
	text-shadow: 0 0.125rem 0.125rem var(--shadow);
	overflow: hidden;
	.header > .body & {
		width: max-content;
		max-width: 100%;
	}

	> .icon {
		height: 100%;
		border-radius: 0.3rem;
	}

	> .name {
		display: none;
		margin-left: 0.25rem;
		font-size: 0.85em;
		vertical-align: top;
		font-weight: bold;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: -0.0625rem -0.0625rem 0 var(--bg),
			0.0625rem -0.0625rem 0 var(--bg), -0.0625rem 0.0625rem 0 var(--bg),
			0.0625rem 0.0625rem 0 var(--bg);
		.article > .main &,
		.header > .body & {
			display: unset;
		}
	}
}
</style>
