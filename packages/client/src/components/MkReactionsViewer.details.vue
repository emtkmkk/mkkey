<template>
	<MkTooltip
		ref="tooltip"
		:target-element="targetElement"
		:max-width="340"
		@closed="emit('closed')"
	>
		<div class="bqxuuuey">
			<div class="reaction">
				<XReactionIcon
					:reaction="reaction"
					:custom-emojis="emojis"
					:class="{
						icon: !defaultStore.state.reactionShowBig,
						bigIcon: defaultStore.state.reactionShowBig,
					}"
					:no-style="true"
				/>
				<div class="name">
					{{ reaction?.replace(/@[\w:\.\-]+:$/, ":") }}
				</div>
				<div
					class="name"
					v-if="reaction.includes('@') && !reaction?.endsWith('@.:')"
				>
					{{
						`画像元 : ${
							/@([\w:\.\-]+):$/.exec(reaction)?.[1] ?? "???"
						}`
					}}
				</div>
			</div>
			<div class="users">
				<div v-for="u in users" :key="u.id" class="user">
					<MkAvatar class="avatar" :user="u" />
					<MkUserName
						v-if="!$store.state.reactionShowUsername"
						class="name"
						:user="u"
						:maxlength="$store.state.reactionShowShort ? 8 : 0"
						:nowrap="true"
						:hostIcon="
							u.instance?.faviconUrl ||
							u.instance?.iconUrl ||
							u.host
						"
						:altIcon="u.instance?.iconUrl"
					/>
					<MkAcct
						v-if="$store.state.reactionShowUsername"
						class="name"
						:user="u"
						:maxlength="$store.state.reactionShowShort ? 8 : 0"
					/>
				</div>
				<div v-if="count - users.length > 0" class="omitted">
					+{{ count - users.length }}
				</div>
			</div>
		</div>
	</MkTooltip>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { defaultStore } from "@/store";
import MkTooltip from "./MkTooltip.vue";
import XReactionIcon from "@/components/MkReactionIcon.vue";

const props = defineProps<{
	reaction: string;
	users: any[]; // TODO
	count: number;
	emojis: any[]; // TODO
	targetElement: HTMLElement;
}>();

const emit = defineEmits<{
	(ev: "closed"): void;
}>();
</script>

<style lang="scss" scoped>
.bqxuuuey {
	display: flex;
	flex-direction: column;

	> .reaction {
		max-width: 100%;
		text-align: center;

		> .icon {
			display: block;
			height: 1.5625rem !important;
			font-size: 3.75rem; // unicodeな絵文字についてはwidthが効かないため
			margin: 0 auto;
		}

		> .bigIcon {
			display: block;
			height: 3.125rem !important;
			font-size: 7.5rem; // unicodeな絵文字についてはwidthが効かないため
			margin: 0 auto;
		}
		> .name {
			font-size: 1em;
		}
	}

	> .users {
		flex: 1;
		min-width: 0;
		font-size: 0.95em;
		border-top: solid 0.03125rem var(--divider);
		padding-top: 0.625rem;
		margin-top: 0.625rem;
		margin-bottom: 0.875rem;
		text-align: center;

		> .user {
			line-height: 1.5rem;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;

			&:not(:last-child) {
				margin-bottom: 0.1875rem;
			}

			> .avatar {
				width: 1.5rem;
				height: 1.5rem;
				margin-right: 0.1875rem;
			}
		}
	}
}
</style>
