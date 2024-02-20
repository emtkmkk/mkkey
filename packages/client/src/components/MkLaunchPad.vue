<template>
	<MkModal
		ref="modal"
		v-slot="{ type, maxHeight }"
		:prefer-type="preferedModalType"
		:anchor="anchor"
		:transparent-bg="true"
		:src="src"
		@click="modal.close()"
		@closed="emit('closed')"
	>
		<div
			class="szkkfdyq _popup _shadow"
			:class="{ asDrawer: type === 'drawer' }"
			:style="{ maxHeight: maxHeight ? maxHeight + 'px' : '' }"
		>
			<div class="main">
				<template v-for="item in items">
					<button
						v-if="item.action"
						v-click-anime
						class="_button"
						@click="
							($event) => {
								item.action($event);
								close();
							}
						"
					>
						<i class="icon" :class="item.icon"></i>
						<div class="text">{{ item.text }}</div>
						<span v-if="item.indicate" class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</button>
					<MkA
						v-else
						v-click-anime
						:to="item.to"
						@click.passive="close()"
					>
						<i class="icon" :class="item.icon"></i>
						<div class="text">{{ item.text }}</div>
						<span v-if="item.indicate" class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</MkA>
				</template>
			</div>
		</div>
	</MkModal>
</template>

<script lang="ts" setup>
import {} from "vue";
import MkModal from "@/components/MkModal.vue";
import { navbarItemDef } from "@/navbar";
import { instanceName } from "@/config";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { deviceKind } from "@/scripts/device-kind";
import * as os from "@/os";

const props = withDefaults(
	defineProps<{
		src?: HTMLElement;
		anchor?: { x: string; y: string };
	}>(),
	{
		anchor: () => ({ x: "right", y: "center" }),
	}
);

const emit = defineEmits<{
	(ev: "closed"): void;
}>();

const preferedModalType =
	deviceKind === "desktop" && props.src != null
		? "popup"
		: deviceKind === "smartphone"
		? "drawer"
		: "dialog";

const modal = $ref<InstanceType<typeof MkModal>>();

const menu = defaultStore.state.menu;

const items = Object.keys(navbarItemDef)
	.filter((k) => !menu.includes(k))
	.map((k) => navbarItemDef[k])
	.filter((def) => (def.show == null ? true : def.show))
	.map((def) => ({
		type: def.to ? "link" : "button",
		text: i18n.ts[def.title],
		icon: def.icon,
		to: def.to,
		action: def.action,
		indicate: def.indicated,
	}));

function close() {
	modal.close();
}
</script>

<style lang="scss" scoped>
.szkkfdyq {
	max-height: 100%;
	width: min(28.75rem, 100vw);
	padding: 1.5rem;
	box-sizing: border-box;
	overflow: auto;
	overscroll-behavior: contain;
	text-align: left;
	border-radius: 1rem;

	&.asDrawer {
		width: 100%;
		padding: 1rem 1rem calc(env(safe-area-inset-bottom, 0) + 1rem) 1rem;
		border-radius: 1.5rem;
		border-bottom-right-radius: 0;
		border-bottom-left-radius: 0;
		text-align: center;
	}

	> .main,
	> .sub {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.25rem, 1fr));

		> * {
			position: relative;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			vertical-align: bottom;
			height: 6.25rem;
			border-radius: 0.625rem;

			&:hover,
			&:focus-visible {
				color: var(--accent);
				background: var(--accentedBg);
				text-decoration: none;
			}

			> .icon {
				font-size: 1.5rem;
				height: 1.5rem;
			}

			> .text {
				margin-top: 0.75rem;
				font-size: 0.8em;
				line-height: 1.5em;
			}

			> .indicator {
				position: absolute;
				top: 2rem;
				left: 2rem;
				color: var(--indicator);
				font-size: 0.5rem;
				animation: blink 1s infinite;

				@media (max-width: 31.25rem) {
					top: 1rem;
					left: 1rem;
				}
			}
		}
	}

	> .sub {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: solid 0.03125rem var(--divider);
	}
}
</style>
