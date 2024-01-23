<template>
	<MkModal
		ref="modal"
		:z-priority="'high'"
		:src="src"
		@click="modal.close()"
		@closed="emit('closed')"
	>
		<div class="_popup" :class="$style.root">
			<button
				key="public"
				v-if="!canVisibilitySwitch && forceMode && canFollower"
				class="_button"
				:class="[$style.item, { [$style.active]: v === 'public' }]"
				data-index="1"
				@click="choose('public')"
			>
				<div :class="$style.icon">
					<i class="ph-arrow-arc-left ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.exitDirectMode
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.exitDirectModeDescription
					}}</span>
				</div>
			</button>
			<button
				key="public"
				v-if="canVisibilitySwitch && canPublic && (!$i.blockPostNotLocalPublic || localOnly)"
				class="_button"
				:class="[$style.item, { [$style.active]: v === 'public' }]"
				data-index="1"
				@click="choose('public')"
			>
				<div :class="$style.icon">
					<i class="ph-planet ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.public
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.publicDescription
					}}</span>
				</div>
			</button>
			<button
				key="home"
				v-if="canVisibilitySwitch && canHome"
				class="_button"
				:class="[$style.item, { [$style.active]: v === 'home' }]"
				data-index="2"
				@click="choose('home')"
			>
				<div :class="$style.icon">
					<i class="ph-house ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.home
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.homeDescription
					}}</span>
				</div>
			</button>
			<button
				key="followers"
				v-if="canVisibilitySwitch && canFollower"
				class="_button"
				:class="[$style.item, { [$style.active]: v === 'followers' }]"
				data-index="3"
				@click="choose('followers')"
			>
				<div :class="$style.icon">
					<i class="ph-lock-simple ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.followers
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.followersDescription
					}}</span>
				</div>
			</button>
			<button
				key="specified"
				v-if="(canVisibilitySwitch || forceMode) && canDirect"
				class="_button"
				:class="[$style.item, { [$style.active]: v === 'specified' }]"
				data-index="4"
				@click="choose('specified')"
			>
				<div :class="$style.icon">
					<i class="ph-envelope-simple-open ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.specified
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.specifiedDescription
					}}</span>
				</div>
			</button>
			<div v-if="canVisibilitySwitch && (canPublic || canHome) && (canNotLocal || $i.blockPostNotLocalPublic)" :class="$style.divider"></div>
			<button
			    v-if="canLocalSwitch && canNotLocal"
				key="localOnly"
				:disabled="v === 'specified'"
				class="_button"
				:class="[
					$style.item,
					$style.localOnly,
					{ [$style.active]: localOnly },
				]"
				data-index="5"
				@click="localOnly = !localOnly"
			>
				<div :class="$style.icon">
					<i class="ph-hand-fist ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.localOnly
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.localOnlyDescription
					}}</span>
				</div>
				<div :class="$style.toggle">
					<i
						:class="
							localOnly
								? 'ph-toggle-right ph-bold ph-lg'
								: 'ph-toggle-left ph-bold ph-lg'
						"
					></i>
				</div>
			</button>
			<button
			    v-if="!canLocalSwitch && !forceMode && (canPublic || canHome) && (canNotLocal || $i.blockPostNotLocalPublic)"
				key="localOnly"
				class="_button"
				:class="[
					$style.item,
					$style.localOnly,
					{ [$style.active]: localOnly },
				]"
				data-index="5"
				@click="localOnly = !localOnly"
			>
				<div :class="$style.icon">
					<i class="ph-hand-heart ph-bold ph-lg"></i>
				</div>
				<div :class="$style.body">
					<span :class="$style.itemTitle">{{
						i18n.ts._visibility.localAndFollower
					}}</span>
					<span :class="$style.itemDescription">{{
						i18n.ts._visibility.localAndFollowerDescription
					}}</span>
				</div>
				<div :class="$style.toggle">
					<i
						:class="
							localOnly
								? 'ph-toggle-right ph-bold ph-lg'
								: 'ph-toggle-left ph-bold ph-lg'
						"
					></i>
				</div>
			</button>
		</div>
	</MkModal>
</template>

<script lang="ts" setup>
import { nextTick, watch } from "vue";
import * as misskey from "calckey-js";
import MkModal from "@/components/MkModal.vue";
import { i18n } from "@/i18n";
import { $i } from "@/account";

const modal = $shallowRef<InstanceType<typeof MkModal>>();

const props = withDefaults(
	defineProps<{
		currentVisibility: (typeof misskey.noteVisibilities)[number];
		currentLocalOnly: boolean;
		src?: HTMLElement;
		canLocalSwitch?: boolean;
		canVisibilitySwitch?: boolean;
		forceMode?: boolean;
		canPublic?: boolean;
		canHome?: boolean;
		canFollower?: boolean;
		canNotLocal?: boolean;
		canDirect?: boolean;
	}>(),
	{}
);

const emit = defineEmits<{
	(
		ev: "changeVisibility",
		v: (typeof misskey.noteVisibilities)[number]
	): void;
	(ev: "changeLocalOnly", v: boolean): void;
	(ev: "closed"): void;
}>();

let v = $ref(props.currentVisibility);
let localOnly = $ref(props.currentLocalOnly);
let canLocalSwitch = props.canLocalSwitch || false;
let canVisibilitySwitch = props.canVisibilitySwitch ?? true;
let forceMode = props.forceMode ?? false;
let canPublic = props.canPublic ?? true;
let canHome = props.canHome ?? true;
let canFollower = props.canFollower ?? true;
let canNotLocal = props.canNotLocal ?? true;
let canDirect = props.canDirect ?? true;

watch($$(localOnly), () => {
	emit("changeLocalOnly", localOnly);
});

function choose(visibility: (typeof misskey.noteVisibilities)[number]): void {
	v = visibility;
	emit("changeVisibility", visibility);
	nextTick(() => {
		modal.close();
	});
}
</script>

<style lang="scss" module>
.root {
	width: 240px;
	padding: 8px 0;
}

.divider {
	margin: 8px 0;
	border-top: solid 0.5px var(--divider);
}

.item {
	display: flex;
	padding: 8px 14px;
	font-size: 12px;
	text-align: left;
	width: 100%;
	box-sizing: border-box;

	&:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	&:active {
		background: rgba(0, 0, 0, 0.1);
	}

	&.active {
		color: var(--fgOnAccent);
		background: var(--accent);
	}

	&.localOnly.active {
		color: var(--accent);
		background: inherit;
	}
}

.icon {
	display: flex;
	justify-content: center;
	align-items: center;
	margin-right: 10px;
	width: 16px;
	top: 0;
	bottom: 0;
	margin-top: auto;
	margin-bottom: auto;
}

.body {
	flex: 1 1 auto;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.itemTitle {
	display: block;
	font-weight: bold;
}

.itemDescription {
	opacity: 0.6;
}

.toggle {
	display: flex;
	justify-content: center;
	align-items: center;
	margin-left: 10px;
	width: 16px;
	top: 0;
	bottom: 0;
	margin-top: auto;
	margin-bottom: auto;
}
</style>
