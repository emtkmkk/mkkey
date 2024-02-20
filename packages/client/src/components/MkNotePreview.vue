<template>
	<div v-size="{ min: [350, 500] }" class="fefdfafb">
		<MkAvatar class="avatar" :user="$i" disableLink />
		<div class="main">
			<div class="header">
				<MkUserName :user="$i" />
			</div>
			<div class="body">
				<div class="content">
					<Mfm
						v-if="cw != null"
						class="text"
						:text="
							(cw ? preprocess(cw).trim() + ' ' : '') +
							'[' +
							i18n.ts._cw.show +
							']\n'
						"
						:author="$i"
						:i="$i"
						reaction-menu-enabled
					/>
					<Mfm
						:text="preprocess(text).trim()"
						:author="$i"
						:i="$i"
						reaction-menu-enabled
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import { preprocess } from "@/scripts/preprocess";
import { i18n } from "@/i18n";

const props = defineProps<{
	text: string;
	cw?: string;
}>();
</script>

<style lang="scss" scoped>
.fefdfafb {
	display: flex;
	margin: 0;
	padding: 0;
	overflow: clip;
	font-size: 0.95em;

	&.min-width_350px {
		> .avatar {
			margin: 0 0.625rem 0 0;
			width: 2.75rem;
			height: 2.75rem;
		}
	}

	&.min-width_500px {
		> .avatar {
			margin: 0 0.75rem 0 0;
			width: 3rem;
			height: 3rem;
		}
	}

	> .avatar {
		flex-shrink: 0;
		display: block;
		margin: 0 0.625rem 0 0;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		pointer-events: none;
	}

	> .main {
		flex: 1;
		min-width: 0;

		> .header {
			margin-bottom: 0.125rem;
			font-weight: bold;
		}

		> .body {
			> .cw {
				cursor: default;
				display: block;
				margin: 0;
				padding: 0;
				overflow-wrap: break-word;

				> .text {
					margin-right: 0.5rem;
				}
			}

			> .content {
				> .text {
					cursor: default;
					margin: 0;
					padding: 0;
				}
			}
		}
	}
}
</style>
