<template>
	<Mfm
		:class="$style.root"
		:text="maxlength && (user.name || user.username).length > maxlength ? (user.name?.replaceAll(/:\w+:/g,'') || user.username).slice(0,maxlength) + '…' : (user.name || user.username)"
		:plain="true"
		:nowrap="nowrap"
		:custom-emojis="user.emojis"
	/>
</template>

<script lang="ts" setup>
import {} from "vue";
import * as misskey from "calckey-js";

const props = withDefaults(
	defineProps<{
		user: misskey.entities.User;
		nowrap?: boolean;
		maxlength?: number;
	}>(),
	{
		nowrap: true,
		maxlength: 0,
	}
);
</script>

<style lang="scss" module>
.root {
	unicode-bidi: isolate;
}
</style>
