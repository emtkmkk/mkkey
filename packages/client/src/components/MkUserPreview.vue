<template>
	<transition
		:name="$store.state.animation ? 'popup' : ''"
		appear
		@after-leave="emit('closed')"
	>
		<div
			v-if="showing"
			class="fxxzrfni _popup _shadow"
			:style="{ zIndex, top: top + 'px', left: left + 'px' }"
			@mouseover="
				() => {
					emit('mouseover');
				}
			"
			@mouseleave="
				() => {
					emit('mouseleave');
				}
			"
		>
			<div v-if="user != null" class="info">
				<div
					class="banner"
					:style="
						user.bannerUrl
							? `background-image: url(${user.bannerUrl})`
							: ''
					"
				>
					<span
						v-if="$i && $i.id != user.id && user.isFollowed"
						class="followed"
						>{{ i18n.ts.followsYou }}</span
					>
				</div>
				<MkAvatar
					class="avatar"
					:user="user"
					:disable-preview="true"
					:show-indicator="true"
				/>
				<div class="title">
					<MkA class="name" :to="userPage(user)"
						><MkUserName
							:user="user"
							:nowrap="false"
							:original="true"
					/></MkA>
					<span
						v-if="$i && $i.id != user.id && user.isFollowed"
						class="followed"
					>
						⭐</span
					>
					<p class="username"><MkAcct :user="user" /></p>
				</div>
				<div
					class="description"
					:class="{ collapsed: isLong && collapsed }"
				>
					<Mfm
						v-if="user.description"
						:text="user.description"
						:author="user"
						:i="$i"
						:custom-emojis="user.emojis"
					/>
				</div>
				<XShowMoreButton
					v-if="isLong"
					v-model="collapsed"
				></XShowMoreButton>
				<div v-if="user.fields.length > 0" class="fields">
					<dl
						v-for="(field, i) in user.fields"
						:key="i"
						class="field"
					>
						<dt class="name">
							<Mfm
								:text="field.name"
								:plain="true"
								:custom-emojis="user.emojis"
								:colored="false"
							/>
						</dt>
						<dd class="value">
							<Mfm
								:text="field.value"
								:author="user"
								:i="$i"
								:custom-emojis="user.emojis"
								:colored="false"
							/>
						</dd>
					</dl>
				</div>
				<div class="status">
					<div>
						<p>{{ i18n.ts.notes }}</p>
						<span>{{ user.notesCount }}</span>
					</div>
					<div>
						<p>{{ i18n.ts.following }}</p>
						<span>{{ user.followingCount }}</span>
					</div>
					<div>
						<p>{{ i18n.ts.followers }}</p>
						<span>{{ user.followersCount }}</span>
					</div>
				</div>
				<MkFollowButton
					v-if="$i && user.id != $i.id"
					class="koudoku-button"
					:user="user"
					mini
				/>
			</div>
			<div v-else>
				<MkLoading />
			</div>
		</div>
	</transition>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import * as Acct from "calckey-js/built/acct";
import type * as misskey from "calckey-js";
import MkFollowButton from "@/components/MkFollowButton.vue";
import { userPage } from "@/filters/user";
import XShowMoreButton from "@/components/MkShowMoreButton.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";

const props = defineProps<{
	showing: boolean;
	q: string;
	source: HTMLElement;
}>();

const emit = defineEmits<{
	(ev: "closed"): void;
	(ev: "mouseover"): void;
	(ev: "mouseleave"): void;
}>();

const zIndex = os.claimZIndex("middle");
let user = $ref<misskey.entities.UserDetailed | null>(null);
let top = $ref(0);
let left = $ref(0);

let isLong = $ref(false);
let collapsed = $ref(!isLong);

onMounted(() => {
	if (typeof props.q === "object") {
		user = props.q;
		isLong =
			user.description.split("\n").length > 9 ||
			user.description.length > 400;
	} else {
		const query = props.q.startsWith("@")
			? Acct.parse(props.q.substr(1))
			: { userId: props.q };

		os.api("users/show", query).then((res) => {
			if (!props.showing) return;
			user = res;
			isLong =
				user.description.split("\n").length > 9 ||
				user.description.length > 400;
		});
	}

	const rect = props.source.getBoundingClientRect();
	const x =
		rect.left + props.source.offsetWidth / 2 - 300 / 2 + window.pageXOffset;
	const y = rect.top + props.source.offsetHeight + window.pageYOffset;

	top = y;
	left = x;
});
</script>

<style lang="scss" scoped>
.popup-enter-active,
.popup-leave-active {
	transition: opacity 0.3s, transform 0.3s !important;
}
.popup-enter-from,
.popup-leave-to {
	opacity: 0;
	transform: scale(0.9);
}

.fxxzrfni {
	position: absolute;
	width: 18.75rem;
	overflow: hidden;
	transform-origin: center top;

	> .info {
		> .banner {
			height: 5.25rem;
			background-color: rgba(0, 0, 0, 0.1);
			background-size: cover;
			background-position: center;
			> .followed {
				position: absolute;
				top: 0.75rem;
				left: 0.75rem;
				padding: 0.25rem 0.5rem;
				color: #fff;
				background: rgba(0, 0, 0, 0.7);
				font-size: 0.7em;
				border-radius: 0.375rem;
			}

			&::after {
				content: "";
				background-image: var(--blur, inherit);
				position: fixed;
				inset: 0;
				background-size: cover;
				background-position: center;
				pointer-events: none;
				opacity: 0.1;
				filter: var(--blur, blur(10px));
			}
		}

		> .avatar {
			display: block;
			position: absolute;
			top: 3.875rem;
			left: 0.8125rem;
			z-index: 2;
			width: 3.625rem;
			height: 3.625rem;
			border: solid 0.1875rem var(--face);
			border-radius: 0.5rem;
		}

		> .title {
			display: block;
			padding: 0.5rem 0 0.5rem 5.125rem;

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
			padding: 0 1rem;
			font-size: 0.8em;
			color: var(--fg);
			&.collapsed {
				position: relative;
				max-height: calc(9em + 3.125rem);
				mask: linear-gradient(black calc(100% - 4rem), transparent);
				-webkit-mask: linear-gradient(
					black calc(100% - 4rem),
					transparent
				);
			}
		}
		:deep(.fade) {
			position: relative;
			display: block;
			width: 100%;
			margin-top: -2.5em;
			z-index: 2;
			> span {
				display: inline-block;
				background: var(--panel);
				padding: 0.4em 1em;
				font-size: 0.8em;
				border-radius: 999px;
				box-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 20%);
			}
			&:hover {
				> span {
					background: var(--panelHighlight);
				}
			}
		}
		:deep(.showLess) {
			width: 100%;
			margin-top: 1em;
			position: sticky;
			bottom: var(--stickyBottom);

			> span {
				display: inline-block;
				background: var(--panel);
				padding: 0.375rem 0.625rem;
				font-size: 0.8em;
				border-radius: 999px;
				box-shadow: 0 0 0.4375rem 0.4375rem var(--bg);
			}
		}

		> .fields {
			padding: 0 1rem;
			font-size: 0.8em;
			margin-top: 1em;

			> .field {
				display: flex;
				padding: 0;
				margin: 0;
				align-items: center;

				&:not(:last-child) {
					margin-bottom: 0.5rem;
				}

				:deep(span) {
					white-space: nowrap !important;
				}

				> .name {
					width: 30%;
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
					font-weight: bold;
					text-align: center;
				}

				> .value {
					width: 70%;
					overflow: hidden;
					white-space: nowrap;
					text-overflow: ellipsis;
					margin: 0;
				}
			}
		}

		> .status {
			padding: 0.5rem 1rem;

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
					:global(span) {
						white-space: nowrap;
					}
				}
			}
		}

		> .koudoku-button {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
		}
	}
}
</style>
