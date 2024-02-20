<template>
	<div class="_panel vjnjpkug">
		<div
			class="banner"
			:style="
				user.bannerUrl ? `background-image: url(${user.bannerUrl})` : ''
			"
		></div>
		<MkAvatar
			class="avatar"
			:user="user"
			:disable-preview="true"
			:show-indicator="true"
		/>
		<div class="title">
			<MkA class="name" :to="userPage(user)"
				><MkUserName :user="user" :nowrap="false"
			/></MkA>
			<span
				v-if="$i && $i.id != user.id && user.isFollowed"
				class="followed"
			>
				⭐</span
			>
			<p class="username"><MkAcct :user="user" /></p>
		</div>
		<div class="description">
			<div v-if="user.description" class="mfm">
				<Mfm
					:text="user.description"
					:author="user"
					:i="$i"
					:custom-emojis="user.emojis"
				/>
			</div>
			<span v-else style="opacity: 0.7">{{
				i18n.ts.noAccountDescription
			}}</span>
		</div>
		<div class="status">
			<div>
				<p>{{ i18n.ts.notes }}</p>
				<MkNumber :value="user.notesCount" />
			</div>
			<div>
				<p>{{ i18n.ts.following }}</p>
				<MkNumber :value="user.followingCount" />
			</div>
			<div>
				<p>{{ i18n.ts.followers }}</p>
				<MkNumber :value="user.followersCount" />
			</div>
		</div>
		<MkFollowButton
			v-if="$i && user.id != $i.id"
			class="koudoku-button"
			:user="user"
			mini
		/>
	</div>
</template>

<script lang="ts" setup>
import * as misskey from "calckey-js";
import MkFollowButton from "@/components/MkFollowButton.vue";
import MkNumber from "@/components/MkNumber.vue";
import { userPage } from "@/filters/user";
import { i18n } from "@/i18n";

defineProps<{
	user: misskey.entities.UserDetailed;
}>();
</script>

<style lang="scss" scoped>
.vjnjpkug {
	position: relative;

	> .banner {
		height: 5.25rem;
		background-color: rgba(0, 0, 0, 0.1);
		background-size: cover;
		background-position: center;
	}

	> .avatar {
		display: block;
		position: absolute;
		top: 3.875rem;
		left: 0.8125rem;
		z-index: 2;
		width: 3.625rem;
		height: 3.625rem;
		border: solid 0.25rem var(--panel);
	}

	> .title {
		display: block;
		padding: 0.625rem 0 0.625rem 5.5rem;

		> .name {
			display: inline-block;
			margin: 0;
			font-weight: bold;
			line-height: 1rem;
			word-break: break-all;
		}

		> .username {
			display: block;
			margin: 0;
			line-height: 1rem;
			font-size: 0.8em;
			color: var(--fg);
			opacity: 0.7;
		}
	}

	> .description {
		padding: 1rem;
		font-size: 0.8em;
		border-top: solid 0.03125rem var(--divider);

		> .mfm {
			display: -webkit-box;
			-webkit-line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
	}

	> .status {
		padding: 0.625rem 1rem;
		border-top: solid 0.03125rem var(--divider);

		> div {
			display: inline-block;
			width: 33%;

			> p {
				margin: 0;
				font-size: 0.7em;
				color: var(--fg);
			}

			> span {
				font-size: 1em;
				color: var(--accent);
			}
		}
	}

	> .koudoku-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
	}
}
</style>
