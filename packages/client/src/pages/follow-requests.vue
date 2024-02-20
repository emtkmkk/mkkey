<template>
	<MkStickyContainer>
		<template #header><MkPageHeader /></template>
		<MkSpacer :content-max="800">
			<MkPagination ref="paginationComponent" :pagination="pagination">
				<template #empty>
					<div class="_fullinfo">
						<img
							src="/static-assets/badges/info.png"
							class="_ghost"
						/>
						<div>{{ i18n.ts.noFollowRequests }}</div>
					</div>
				</template>
				<template #default="{ items }">
					<div class="mk-follow-requests">
						<div
							v-for="req in items"
							:key="req.id"
							class="user _panel"
						>
							<MkAvatar
								class="avatar"
								:user="req.follower"
								:show-indicator="true"
								disableLink
							/>
							<div class="body">
								<div class="name">
									<MkA
										v-user-preview="req.follower.id"
										class="name"
										:to="userPage(req.follower)"
										><MkUserName :user="req.follower"
									/></MkA>
									<p class="acct">
										@{{ acct(req.follower) }}
									</p>
								</div>
								<div
									v-if="req.follower.description"
									class="description"
									:title="req.follower.description"
								>
									<Mfm
										:text="req.follower.description"
										:is-note="false"
										:author="req.follower"
										:i="$i"
										:custom-emojis="req.follower.emojis"
										:plain="true"
										:nowrap="true"
									/>
								</div>
								<div class="actions">
									<button
										class="_button"
										@click="accept(req.follower)"
									>
										<i class="ph-check ph-bold ph-lg"></i>
									</button>
									<button
										class="_button"
										@click="reject(req.follower)"
									>
										<i class="ph-x ph-bold ph-lg"></i>
									</button>
									<button
										class="_button"
										@click="ignore(req.follower)"
									>
										<i
											class="ph-bell-slash ph-bold ph-lg"
										></i>
									</button>
								</div>
							</div>
						</div>
					</div>
				</template>
			</MkPagination>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import MkPagination from "@/components/MkPagination.vue";
import { userPage, acct } from "@/filters/user";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const paginationComponent = ref<InstanceType<typeof MkPagination>>();

const pagination = {
	endpoint: "following/requests/list" as const,
	limit: 10,
};

async function accept(user) {
	const { canceled } = await os.confirm({
		type: "question",
		text: i18n.t("acceptConfirm", {
			name: user.name || user.username,
		}),
	});
	if (canceled) return;
	os.api("following/requests/accept", { userId: user.id }).then(() => {
		paginationComponent.value.reload();
	});
}

async function reject(user) {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("rejectConfirm", {
			name: user.name || user.username,
		}),
	});
	if (canceled) return;
	os.api("following/requests/reject", { userId: user.id }).then(() => {
		paginationComponent.value.reload();
	});
}

async function ignore(user) {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("ignoreConfirm", {
			name: user.name || user.username,
		}),
	});
	if (canceled) return;
	os.api("follow-blocking/create", { userId: user.id }).then(() => {
		paginationComponent.value.reload();
	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata(
	computed(() => ({
		title: i18n.ts.followRequests,
		icon: "ph-hand-waving ph-bold ph-lg",
	}))
);
</script>

<style lang="scss" scoped>
.mk-follow-requests {
	> .user {
		display: flex;
		padding: 1rem;
		margin: 0.625rem 0 auto;

		> .avatar {
			display: block;
			flex-shrink: 0;
			margin: 0 0.75rem 0 0;
			width: 2.625rem;
			height: 2.625rem;
			border-radius: 0.5rem;
		}

		> .body {
			display: flex;
			width: calc(100% - 3.375rem);
			position: relative;

			> .name {
				width: 45%;

				@media (max-width: 31.25rem) {
					width: 100%;
				}

				> .name,
				> .acct {
					display: block;
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;
					margin: 0;
				}

				> .name {
					font-size: 1rem;
					line-height: 1.5rem;
				}

				> .acct {
					font-size: 0.9375rem;
					line-height: 1rem;
					opacity: 0.7;
				}
			}

			> .description {
				width: 55%;
				line-height: 2.625rem;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				opacity: 0.7;
				font-size: 0.875rem;
				padding-right: 2.5rem;
				padding-left: 0.5rem;
				box-sizing: border-box;

				@media (max-width: 31.25rem) {
					display: none;
				}
			}

			> .actions {
				position: absolute;
				top: 0;
				bottom: 0;
				right: 0;
				margin: auto 0;

				> button {
					padding: 0.75rem;
				}
			}
		}
	}
}
</style>
