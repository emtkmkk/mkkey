<template>
	<MkStickyContainer>
		<template #header
			><MkPageHeader
				:actions="headerActions"
				:tabs="headerTabs"
				:display-back-button="true"
		/></template>
		<MkSpacer :content-max="700">
			<div v-if="channel">
				<div
					class="wpgynlbz _panel _gap"
					:class="{ hide: !showBanner }"
				>
					<XChannelFollowButton
						:channel="channel"
						:full="true"
						class="subscribe"
					/>
					<button
						class="_button toggle"
						@click="() => (showBanner = !showBanner)"
					>
						<template v-if="showBanner"
							><i class="ph-caret-up ph-bold ph-lg"></i
						></template>
						<template v-else
							><i class="ph-caret-down ph-bold ph-lg"></i
						></template>
					</button>
					<div v-if="!showBanner" class="hideOverlay"></div>
					<div
						:style="{
							backgroundImage: channel.bannerUrl
								? `url(${channel.bannerUrl})`
								: null,
						}"
						class="banner"
					>
						<div class="status">
							<div>
								<i
									class="ph-users ph-bold ph-lg ph-fw ph-lg"
								></i
								><I18n
									:src="i18n.ts._channel.usersCount"
									tag="span"
									style="margin-left: 0.25rem"
									><template #n
										><b>{{
											channel.usersCount
										}}</b></template
									></I18n
								>
							</div>
							<div>
								<i
									class="ph-pencil ph-bold ph-lg ph-fw ph-lg"
								></i
								><I18n
									:src="i18n.ts._channel.notesCount"
									tag="span"
									style="margin-left: 0.25rem"
									><template #n
										><b>{{
											channel.notesCount
										}}</b></template
									></I18n
								>
							</div>
						</div>
						<div class="fade"></div>
					</div>
					<div v-if="channel.description" class="description">
						<Mfm
							:text="channel.description"
							:is-note="false"
							:i="$i"
						/>
					</div>
				</div>

				<XPostForm
					v-if="$i"
					:channel="channel"
					class="post-form _panel _gap"
					fixed
				/>

				<XTimeline
					:key="channelId"
					class="_gap"
					src="channel"
					:channel="channelId"
					:channelName="
						channel.description?.includes('[localOnly]')
							? ''
							: channel.name
					"
					@before="before"
					@after="after"
				/>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, inject, watch } from "vue";
import MkContainer from "@/components/MkContainer.vue";
import XPostForm from "@/components/MkPostForm.vue";
import XTimeline from "@/components/MkTimeline.vue";
import XChannelFollowButton from "@/components/MkChannelFollowButton.vue";
import * as os from "@/os";
import { useRouter } from "@/router";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { search } from "@/scripts/search";

const router = useRouter();

const props = defineProps<{
	channelId: string;
}>();

let channel = $ref(null);
let showBanner = $ref(true);

watch(
	() => props.channelId,
	async () => {
		channel = await os.api("channels/show", {
			channelId: props.channelId,
		});
	},
	{ immediate: true }
);

function edit() {
	router.push(`/channels/${channel?.id}/edit`);
}

function channelSearch() {
	search(channel?.id, undefined);
}

const headerActions = $computed(() => [
	...(channel
		? [
				{
					icon: "ph-magnifying-glass ph-bold ph-lg",
					text: i18n.ts.search,
					handler: channelSearch,
				},
		  ]
		: []),
	...(channel && channel?.userId === $i?.id
		? [
				{
					icon: "ph-gear-six ph-bold ph-lg",
					text: i18n.ts.edit,
					handler: edit,
				},
		  ]
		: []),
]);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() =>
		channel
			? {
					title: channel.name,
					icon: "ph-television ph-bold ph-lg",
			  }
			: null
	)
);
</script>

<style lang="scss" scoped>
.wpgynlbz {
	position: relative;

	> .subscribe {
		position: absolute;
		z-index: 1;
		top: 1rem;
		left: 1rem;
	}

	> .toggle {
		position: absolute;
		z-index: 2;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 1.2em;
		width: 3rem;
		height: 3rem;
		color: #fff;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 100%;

		> i {
			vertical-align: middle;
		}
	}

	> .banner {
		position: relative;
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

		> .status {
			position: absolute;
			z-index: 1;
			bottom: 1rem;
			right: 1rem;
			padding: 0.5rem 0.75rem;
			font-size: 80%;
			background: rgba(0, 0, 0, 0.7);
			border-radius: 0.375rem;
			color: #fff;
		}
	}

	> .description {
		padding: 1rem;
	}

	> .hideOverlay {
		position: absolute;
		z-index: 1;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		-webkit-backdrop-filter: var(--blur, blur(1rem));
		backdrop-filter: var(--blur, blur(1rem));
		background: rgba(0, 0, 0, 0.3);
	}

	&.hide {
		> .subscribe {
			display: none;
		}

		> .toggle {
			top: 0;
			right: 0;
			height: 100%;
			background: transparent;
		}

		> .banner {
			height: 2.625rem;
			filter: blur(8px);

			> * {
				display: none;
			}
		}

		> .description {
			display: none;
		}
	}
}
</style>
