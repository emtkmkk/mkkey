<template>
	<div class="dlrsnxqu">
		<div
			v-for="x in defaultStore.reactiveState.statusbars.value"
			:key="x.id"
			class="item"
			:class="[
				{ black: x.black },
				{
					verySmall: x.size === 'verySmall',
					small: x.size === 'small',
					medium: x.size === 'medium',
					large: x.size === 'large',
					veryLarge: x.size === 'veryLarge',
				},
			]"
		>
			<span class="name">{{ x.name }}</span>
			<XRss
				v-if="x.type === 'rss'"
				class="body"
				:refresh-interval-sec="x.props.refreshIntervalSec"
				:marquee-duration="x.props.marqueeDuration"
				:marquee-reverse="x.props.marqueeReverse"
				:display="x.props.display"
				:url="x.props.url"
				:shuffle="x.props.shuffle"
			/>
			<XFederation
				v-else-if="x.type === 'federation'"
				class="body"
				:refresh-interval-sec="x.props.refreshIntervalSec"
				:marquee-duration="x.props.marqueeDuration"
				:marquee-reverse="x.props.marqueeReverse"
				:display="x.props.display"
				:colored="x.props.colored"
			/>
			<XUserList
				v-else-if="x.type === 'userList'"
				class="body"
				:refresh-interval-sec="x.props.refreshIntervalSec"
				:marquee-duration="x.props.marqueeDuration"
				:marquee-reverse="x.props.marqueeReverse"
				:display="x.props.display"
				:user-list-id="x.props.userListId"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref, toRef, watch } from "vue";
import * as os from "@/os";
import { defaultStore } from "@/store";
const XRss = defineAsyncComponent(() => import("./statusbar-rss.vue"));
const XFederation = defineAsyncComponent(
	() => import("./statusbar-federation.vue")
);
const XUserList = defineAsyncComponent(
	() => import("./statusbar-user-list.vue")
);
</script>

<style lang="scss" scoped>
.dlrsnxqu {
	font-size: 0.9375rem;
	background: var(--panel);

	> .item {
		--height: 1.5rem;
		--nameMargin: 0.625rem;
		font-size: 0.85em;

		&.verySmall {
			--nameMargin: 0.4375rem;
			--height: 1rem;
			font-size: 0.75em;
		}

		&.small {
			--nameMargin: 0.5rem;
			--height: 1.25rem;
			font-size: 0.8em;
		}

		&.large {
			--nameMargin: 0.75rem;
			--height: 1.625rem;
			font-size: 0.875em;
		}

		&.veryLarge {
			--nameMargin: 0.875rem;
			--height: 1.875rem;
			font-size: 0.9em;
		}

		display: flex;
		vertical-align: bottom;
		width: 100%;
		line-height: var(--height);
		height: var(--height);
		overflow: clip;
		contain: strict;

		> .name {
			padding: 0 var(--nameMargin);
			font-weight: bold;
			color: var(--accent);

			&:empty {
				display: none;
			}
		}

		> .body {
			min-width: 0;
			flex: 1;
		}

		&.black {
			background: #000;
			color: #fff;
		}
	}
}
</style>
