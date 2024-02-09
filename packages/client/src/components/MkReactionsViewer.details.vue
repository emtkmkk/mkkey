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
			height: 25px !important;
			font-size: 60px; // unicodeな絵文字についてはwidthが効かないため
			margin: 0 auto;
		}

		> .bigIcon {
			display: block;
			height: 50px !important;
			font-size: 120px; // unicodeな絵文字についてはwidthが効かないため
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
		border-top: solid 0.5px var(--divider);
		padding-top: 10px;
		margin-top: 10px;
		margin-bottom: 14px;
		text-align: center;

		> .user {
			line-height: 24px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;

			&:not(:last-child) {
				margin-bottom: 3px;
			}

			> .avatar {
				width: 24px;
				height: 24px;
				margin-right: 3px;
			}
		}
	}
}
</style>
