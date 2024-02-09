<template>
	<header class="kkwtjztg">
		<div class="user-info">
			<div>
				<MkA
					v-user-preview="note.user.id"
					class="name"
					:to="userPage(note.user)"
					@click.stop
				>
					<MkUserName :user="note.user" class="mkusername">
						<span v-if="note.user.isBot" class="is-bot">bot</span>
						<span
							v-for="badge in mkBadge"
							:key="badge.key"
							style="badge"
							:title="i18n.ts[badge.key]"
							v-tooltip="i18n.ts[badge.key]"
							><MkEmoji
								class="emoji"
								:emoji="badge.emoji"
								style="height: 1em; pointer-events: none"
								static
							></MkEmoji
						></span>
					</MkUserName>
				</MkA>
				<div class="username"><MkAcct :user="note.user" /></div>
			</div>
			<div>
				<div class="info">
					<i
						v-if="
							$store.state.showRelationMark &&
							!note.user.isBot &&
							note.user.isFollowing != null &&
							note.user.isFollowing &&
							!note.user.isFollowed
						"
						class="ph-heart-half ph-bold relation"
					></i>
					<i
						v-if="
							$store.state.showRelationMark &&
							!note.user.isBot &&
							note.user.isFollowing != null &&
							!note.user.isFollowing &&
							note.user.isFollowed
						"
						class="ph-heart-half ph-bold relation"
						style="transform: scaleX(-1)"
					></i>
					<i
						v-if="
							$store.state.showRelationMark &&
							!note.user.isBot &&
							note.user.isFollowing != null &&
							!note.user.isFollowing &&
							!note.user.isFollowed
						"
						class="ph-smiley-meh ph-bold relation"
					></i>
					<MkA
						v-if="note.replyId"
						:to="`/notes/${note.replyId}`"
						class="reply-icon"
						@click.stop
					>
						<i class="ph-arrow-bend-left-up ph-bold ph-lg"></i>
					</MkA>
					<MkA class="created-at" :to="notePage(note)">
						<MkTime :time="note.createdAt" />
						<MkTime
							v-if="note.updatedAt"
							:time="note.updatedAt"
							mode="none"
						>
							(<i class="ph-pencil-line ph-bold"></i>
							{{ i18n.ts.edited }})</MkTime
						>
					</MkA>
					<MkVisibility :note="note" />
				</div>
				<MkInstanceTicker
					v-if="showTicker"
					class="ticker"
					:instance="note.user.instance"
				/>
			</div>
		</div>
	</header>
</template>

<script lang="ts" setup>
import {} from "vue";
import type * as misskey from "calckey-js";
import { defaultStore, noteViewInterruptors } from "@/store";
import MkVisibility from "@/components/MkVisibility.vue";
import MkInstanceTicker from "@/components/MkInstanceTicker.vue";
import { notePage } from "@/filters/note";
import { userPage } from "@/filters/user";
import { i18n } from "@/i18n";

const props = defineProps<{
	note: misskey.entities.Note;
	pinned?: boolean;
}>();

let note = $ref(props.note);

const mkBadge = $ref(note.user.badges || []);

const showTicker =
	defaultStore.state.instanceTicker === "always" ||
	(defaultStore.state.instanceTicker === "remote" && note.user.instance);
</script>

<style lang="scss" scoped>
.kkwtjztg {
	position: relative;
	z-index: 2;
	display: flex;
	align-items: center;
	white-space: nowrap;
	justify-self: flex-end;
	border-radius: 100px;
	font-size: 0.8em;
	text-shadow: 0 2px 2px var(--shadow);
	> .avatar {
		width: 3.7em;
		height: 3.7em;
		margin-right: 1em;
	}
	> .user-info {
		width: 0;
		flex-grow: 1;
		line-height: 1.5;
		display: flex;
		font-size: 1.2em;
		> div {
			&:first-child {
				flex-grow: 1;
				width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				gap: 0.1em 0;
			}
			&:last-child {
				max-width: 50%;
				gap: 0.3em 0.5em;
			}
			.article > .main & {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				&:last-child {
					align-items: flex-end;
				}
				> * {
					max-width: 100%;
				}
			}
		}
		.name {
			// flex: 1 1 0px;
			display: inline;
			margin: 0 0.5em 0 0;
			padding: 0;
			overflow: hidden;
			font-weight: bold;
			text-decoration: none;
			text-overflow: ellipsis;

			.mkusername > .is-bot {
				flex-shrink: 0;
				align-self: center;
				margin: 0 0.5em 0 0;
				padding: 1px 6px;
				font-size: 80%;
				border: solid 0.5px var(--divider);
				border-radius: 3px;
			}
			.badge {
				flex-shrink: 0;
				align-self: center;
				margin-right: 0.5em;
				padding: 1px 6px;
				vertical-align: middle;
			}

			&:hover {
				text-decoration: underline;
			}
		}

		.username {
			display: inline;
			margin: 0 0.5em 0 0;
			overflow: hidden;
			text-overflow: ellipsis;
			align-self: flex-start;
			font-size: 0.9em;
		}

		.info {
			display: inline-flex;
			flex-shrink: 0;
			margin-left: 0.5em;
			font-size: 0.9em;
			.created-at {
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.relation {
				margin-right: 0.5em;
				font-size: 0.9em;
				vertical-align: middle;
			}
			.reply-icon {
				display: inline-block;
				border-radius: 6px;
				color: var(--accent);
				transition: background 0.2s;
				&:hover,
				&:focus {
					background: var(--buttonHoverBg);
				}
			}
		}

		.ticker {
			display: inline-flex;
			margin-left: 0.5em;
			vertical-align: middle;
			> .name {
				display: none;
			}
		}
	}
}
</style>
