<template>
	<MkA :to="`/channels/${channel.id}`" class="eftoefju _panel" tabindex="-1">
		<div class="banner" :style="bannerStyle">
			<div class="fade"></div>
			<div class="name">
				<i class="ph-television ph-bold ph-lg"></i> {{ channel.name }}
			</div>
			<div class="status">
				<div>
					<i class="ph-users ph-bold ph-lg ph-fw ph-lg"></i>
					<I18n
						:src="i18n.ts._channel.usersCount"
						tag="span"
						style="margin-left: 0.25rem"
					>
						<template #n>
							<b>{{ channel.usersCount }}</b>
						</template>
					</I18n>
				</div>
				<div>
					<i class="ph-pencil ph-bold ph-lg ph-fw ph-lg"></i>
					<I18n
						:src="i18n.ts._channel.notesCount"
						tag="span"
						style="margin-left: 0.25rem"
					>
						<template #n>
							<b>{{ channel.notesCount }}</b>
						</template>
					</I18n>
				</div>
			</div>
		</div>
		<article v-if="channel.description">
			<p :title="channel.description">
				{{
					channel.description.length > 85
						? `${channel.description.slice(0, 85)}…`
						: channel.description
				}}
			</p>
		</article>
		<footer>
			<span v-if="channel.lastNotedAt">
				{{ i18n.ts.updatedAt }}: <MkTime :time="channel.lastNotedAt" />
			</span>
		</footer>
	</MkA>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { i18n } from "@/i18n";

const props = defineProps<{
	channel: Record<string, any>;
}>();

const bannerStyle = computed(() => {
	if (props.channel.bannerUrl) {
		return { backgroundImage: `url(${props.channel.bannerUrl})` };
	} else {
		return { backgroundColor: "#4c5e6d" };
	}
});
</script>

<style lang="scss" scoped>
.eftoefju {
	display: block;
	overflow: hidden;
	width: 100%;

	&:hover {
		text-decoration: none;
	}

	> .banner {
		position: relative;
		width: 100%;
		height: 12.5rem;
		background-position: center;
		background-size: cover;

		> .fade {
			position: absolute;
			bottom: 0;
			left: 0;
			width: 100%;
			height: 4rem;
			background: linear-gradient(0deg, var(--panel), var(--X15));
		}

		> .name {
			position: absolute;
			top: 1rem;
			left: 1rem;
			padding: 0.75rem 1rem;
			-webkit-backdrop-filter: var(--blur, blur(8px));
			backdrop-filter: var(--blur, blur(8px));
			background: rgba(0, 0, 0, 0.2);
			color: #fff;
			font-size: 1.2em;
			border-radius: 999px;
		}

		> .status {
			position: absolute;
			z-index: 1;
			bottom: 1rem;
			right: 1rem;
			padding: 0.5rem 0.75rem;
			font-size: 80%;
			-webkit-backdrop-filter: var(--blur, blur(8px));
			backdrop-filter: var(--blur, blur(8px));
			background: rgba(0, 0, 0, 0.2);
			border-radius: 0.375rem;
			color: #fff;
		}
	}

	> article {
		padding: 1rem;

		> p {
			margin: 0;
			font-size: 1em;
		}
	}

	> footer {
		padding: 0.75rem 1rem;
		border-top: solid 0.0.3125rem var(--divider);

		> span {
			opacity: 0.7;
			font-size: 0.9em;
		}
	}

	@media (max-width: 34.375rem) {
		font-size: 0.9em;

		> .banner {
			height: 5rem;

			> .status {
				display: none;
			}
		}

		> article {
			padding: 0.75rem;
		}

		> footer {
			display: none;
		}
	}

	@media (max-width: 31.25rem) {
		font-size: 0.8em;

		> .banner {
			height: 4.375rem;
		}

		> article {
			padding: 0.5rem;
		}
	}
}
</style>
