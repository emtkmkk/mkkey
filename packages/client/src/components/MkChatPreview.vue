<template>
	<MkA
		class="rivslvers"
		tabindex="-1"
		:class="{
			isMe: isMe(message),
			isRead: message.groupId
				? message.reads.includes($i?.id)
				: message.isRead,
		}"
		:to="roomLink(message)"
	>
		<div class="message _block">
			<MkAvatar
				class="avatar"
				:user="
					message.groupId
						? message.user
						: isMe(message)
						? message.recipient
						: message.user
				"
				:show-indicator="true"
			/>
			<header v-if="message.groupId">
				<span class="name">{{ message.group.name }}</span>
				<MkTime :time="message.createdAt" class="time" />
			</header>
			<header v-else>
				<span class="name"
					><MkUserName
						:user="
							isMe(message) ? message.recipient : message.user
						"
				/></span>
				<span class="username"
					>@{{
						acct(isMe(message) ? message.recipient : message.user)
					}}</span
				>
				<MkTime :time="message.createdAt" class="time" />
			</header>
			<div class="body">
				<p class="text">
					<span v-if="isMe(message)" class="me"
						>{{ i18n.ts.you }}:
					</span>
					<Mfm
						v-if="message.text != null && message.text.length > 0"
						:text="message.text"
					/>
					<span v-else> 📎</span>
				</p>
			</div>
		</div>
	</MkA>
</template>

<script lang="ts" setup>
import * as Acct from "calckey-js/built/acct";
import { i18n } from "@/i18n";
import { acct } from "@/filters/user";
import { $i } from "@/account";

const getAcct = Acct.toString;

const props = defineProps<{
	message: Record<string, any>;
}>();

/**
 * メッセージの画面へのリンクを作る。
 *
 * @param message - 一覧の 1 件（相手とのやり取りの最新のメッセージ）
 * @returns グループならグループの画面、そうでなければ相手との画面の URL
 *
 * @remarks
 * 相手が削除済みなら `?userId=` を付ける。メッセージの画面は `@名前@ホスト` から `users/show` で相手を引くが、
 * 削除済みの人は返らないため。ID があれば、過去のやり取りだけは読める。
 *
 * @internal
 */
function roomLink(message): string {
	if (message.groupId) return `/my/messaging/group/${message.groupId}`;
	const partner = isMe(message) ? message.recipient : message.user;
	const base = `/my/messaging/${getAcct(partner)}`;
	return partner?.isDeleted ? `${base}?userId=${partner.id}` : base;
}

function isMe(message): boolean {
	return message.userId === $i?.id;
}
</script>

<style lang="scss" scoped>
.rivslvers {
	> .message {
		display: block;
		text-decoration: none;
		margin-bottom: var(--margin);

		* {
			pointer-events: none;
			user-select: none;
		}

		&:hover {
			.avatar {
				filter: saturate(200%);
			}
		}

		&.isRead,
		&.isMe {
			opacity: 0.8;
		}

		&:not(.isMe):not(.isRead) {
			> div {
				background-image: url("/client-assets/unread.svg");
				background-repeat: no-repeat;
				background-position: 0 center;
			}
		}

		&:after {
			content: "";
			display: block;
			clear: both;
		}

		padding: 1.25rem 1.875rem;

		> header {
			display: flex;
			align-items: center;
			margin-bottom: 0.125rem;
			white-space: nowrap;
			overflow: hidden;

			> .name {
				margin: 0;
				padding: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				font-size: 1em;
				font-weight: bold;
				transition: all 0.1s ease;
			}

			> .username {
				margin: 0 0.5rem;
			}

			> .time {
				margin: 0 0 0 auto;
			}
		}

		> .avatar {
			float: left;
			width: 3.375rem;
			height: 3.375rem;
			margin: 0 1rem 0 0;
			border-radius: 0.5rem;
			transition: all 0.1s ease;
		}

		> .body {
			> .text {
				display: block;
				margin: 0 0 0 0;
				padding: 0;
				overflow: hidden;
				overflow-wrap: break-word;
				text-decoration: none;
				font-size: 1.1em;
				color: var(--faceText);

				.me {
					opacity: 0.7;
				}
			}

			> .image {
				display: block;
				max-width: 100%;
				max-height: 32rem;
			}
		}
	}

	&.max-width_400px {
		> .message {
			&:not(.isMe):not(.isRead) {
				> div {
					background-image: none;
					border-left: solid 0.25rem #3aa2dc;
				}
			}

			> div {
				padding: 1rem;
				font-size: 0.9em;

				> .avatar {
					margin: 0 0.75rem 0 0;
				}
			}
		}
	}
}
</style>
