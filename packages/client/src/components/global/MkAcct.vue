<template>
	<span class="mk-acct">
		<span class="name"
			>@{{
				maxlength && user.username.length > maxlength
					? user.username.slice(0, maxlength) + "…"
					: user.username
			}}</span
		>
		<span
			v-if="user.host || detail || $store.state.showFullAcct"
			class="host"
			>@{{
				maxlength && (user.host || host).length > maxlength
					? `${(user.host || host).slice(0, ~~(maxlength / 2))}…${(
							user.host || host
					  ).slice((maxlength - ~~(maxlength / 2)) * -1)}`
					: user.host || host
			}}</span
		>
	</span>
</template>

<script lang="ts" setup>
import * as misskey from "calckey-js";
import { toUnicode } from "punycode/";
import { host as hostRaw } from "@/config";

defineProps<{
	user: misskey.entities.UserDetailed;
	detail?: boolean;
	maxlength?: boolean;
}>();

const host = toUnicode(hostRaw);
</script>

<style lang="scss" scoped>
.mk-acct {
	> .host {
		opacity: 0.5;
	}
}
</style>
