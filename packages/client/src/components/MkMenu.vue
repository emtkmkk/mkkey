<template>
	<FocusTrap :active="false" ref="focusTrap">
		<div tabindex="-1">
			<div
				ref="itemsEl"
				class="rrevdjwt _popup _shadow"
				:class="{ center: align === 'center', asDrawer }"
				:style="{
					width: width && !asDrawer ? width + 'px' : '',
					maxHeight: maxHeight ? maxHeight + 'px' : '',
				}"
				@contextmenu.self="(e) => e.preventDefault()"
			>
				<template v-for="(item, i) in items2">
					<div v-if="item === null" class="divider"></div>
					<span v-else-if="item.type === 'label'" class="label item">
						<span :style="item.textStyle || ''">{{
							item.text
						}}</span>
					</span>
					<span
						v-else-if="item.type === 'pending'"
						class="pending item"
					>
						<span><MkEllipsis /></span>
					</span>
					<MkA
						v-else-if="item.type === 'link'"
						:to="item.to"
						class="_button item"
						@click="clicked(item.action, $event)"
						@mouseenter.passive="onItemMouseEnter(item)"
						@mouseleave.passive="onItemMouseLeave(item)"
					>
						<i
							v-if="item.icon"
							class="ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span v-else-if="item.icons">
							<i
								v-for="icon in item.icons"
								class="ph-fw ph-lg"
								:class="icon"
							></i>
						</span>
						<MkAvatar
							v-if="item.avatar"
							:user="item.avatar"
							class="avatar"
							disableLink
						/>
						<span :style="item.textStyle || ''">{{
							item.text
						}}</span>
						<span v-if="item.indicate" class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</MkA>
					<a
						v-else-if="item.type === 'a'"
						:href="item.href"
						:target="item.target"
						:download="item.download"
						class="_button item"
						@click="clicked(item.action, $event)"
						@mouseenter.passive="onItemMouseEnter(item)"
						@mouseleave.passive="onItemMouseLeave(item)"
					>
						<i
							v-if="item.icon"
							class="ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span v-else-if="item.icons">
							<i
								v-for="icon in item.icons"
								class="ph-fw ph-lg"
								:class="icon"
							></i>
						</span>
						<span :style="item.textStyle || ''">{{
							item.text
						}}</span>
						<span v-if="item.indicate" class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</a>
					<button
						v-else-if="item.type === 'user' && !items.hidden"
						class="_button item"
						:class="{ active: item.active }"
						:disabled="item.active"
						@click="clicked(item.action, $event)"
						@mouseenter.passive="onItemMouseEnter(item)"
						@mouseleave.passive="onItemMouseLeave(item)"
					>
						<MkAvatar
							:user="item.user"
							class="avatar"
							disableLink
						/><MkUserName :user="item.user" />
						<span v-if="item.indicate" class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</button>
					<span
						v-else-if="item.type === 'switch'"
						class="item"
						@mouseenter.passive="onItemMouseEnter(item)"
						@mouseleave.passive="onItemMouseLeave(item)"
					>
						<FormSwitch
							v-model="item.ref"
							:disabled="item.disabled"
							class="form-switch"
							:style="item.textStyle || ''"
							>{{ item.text }}</FormSwitch
						>
					</span>
					<button
						v-else-if="item.type === 'parent'"
						class="_button item parent"
						:class="{ childShowing: childShowingItem === item }"
						@mouseenter="showChildren(item, $event)"
						@click="showChildren(item, $event)"
					>
						<i
							v-if="item.icon"
							class="ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span v-else-if="item.icons">
							<i
								v-for="icon in item.icons"
								class="ph-fw ph-lg"
								:class="icon"
							></i>
						</span>
						<span :style="item.textStyle || ''">{{
							item.text
						}}</span>
						<span class="caret"
							><i
								class="ph-caret-right ph-bold ph-lg ph-fw ph-lg"
							></i
						></span>
					</button>
					<button
						v-else-if="!item.hidden"
						class="_button item"
						:class="{ danger: item.danger, active: item.active }"
						:disabled="item.active"
						@click="clicked(item.action, $event)"
						@mouseenter.passive="onItemMouseEnter(item)"
						@mouseleave.passive="onItemMouseLeave(item)"
					>
						<i
							v-if="item.icon"
							class="ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span v-else-if="item.icons">
							<i
								v-for="icon in item.icons"
								class="ph-fw ph-lg"
								:class="icon"
							></i>
						</span>
						<MkAvatar
							v-if="item.avatar"
							:user="item.avatar"
							class="avatar"
							disableLink
						/>
						<span :style="item.textStyle || ''">{{
							item.text
						}}</span>
						<span v-if="item.indicate" class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</button>
				</template>
				<span v-if="items2.length === 0" class="none item">
					<span>{{ i18n.ts.none }}</span>
				</span>
			</div>
			<div v-if="childMenu" class="child">
				<XChild
					ref="child"
					:items="childMenu"
					:target-element="childTarget"
					:root-element="itemsEl"
					showing
					@actioned="childActioned"
				/>
			</div>
		</div>
	</FocusTrap>
</template>

<script lang="ts" setup>
import {
	computed,
	menu,
	defineAsyncComponent,
	nextTick,
	onBeforeUnmount,
	onMounted,
	onUnmounted,
	Ref,
	ref,
	watch,
} from "vue";
import { focusPrev, focusNext } from "@/scripts/focus";
import FormSwitch from "@/components/form/switch.vue";
import { MenuItem, InnerMenuItem, MenuPending, MenuAction } from "@/types/menu";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { FocusTrap } from "focus-trap-vue";

const XChild = defineAsyncComponent(() => import("./MkMenu.child.vue"));
const focusTrap = ref();

const props = defineProps<{
	items: MenuItem[];
	viaKeyboard?: boolean;
	asDrawer?: boolean;
	align?: "center" | string;
	width?: number;
	maxHeight?: number;
}>();

const emit = defineEmits<{
	(ev: "close", actioned?: boolean): void;
}>();

let itemsEl = $ref<HTMLDivElement>();

let items2: InnerMenuItem[] = $ref([]);

let child = $ref<InstanceType<typeof XChild>>();

let childShowingItem = $ref<MenuItem | null>();

watch(
	() => props.items,
	() => {
		const items: (MenuItem | MenuPending)[] = [...props.items].filter(
			(item) => item !== undefined
		);

		for (let i = 0; i < items.length; i++) {
			const item = items[i];

			if (item && "then" in item) {
				// if item is Promise
				items[i] = { type: "pending" };
				item.then((actualItem) => {
					items2[i] = actualItem;
				});
			}
		}

		items2 = items as InnerMenuItem[];
	},
	{
		immediate: true,
	}
);

let childMenu = $ref<MenuItem[] | null>();
let childTarget = $ref<HTMLElement | null>();

function closeChild() {
	childMenu = null;
	childShowingItem = null;
}

function childActioned() {
	closeChild();
	close(true);
}

function onGlobalMousedown(event: MouseEvent) {
	if (
		childTarget &&
		(event.target === childTarget || childTarget.contains(event.target))
	)
		return;
	if (child && child.checkHit(event)) return;
	closeChild();
}

let childCloseTimer: null | number = null;
function onItemMouseEnter(item) {
	childCloseTimer = window.setTimeout(() => {
		closeChild();
	}, 300);
}
function onItemMouseLeave(item) {
	if (childCloseTimer) window.clearTimeout(childCloseTimer);
}

async function showChildren(item: MenuItem, ev: MouseEvent) {
	if (props.asDrawer) {
		os.popupMenu(item.children, ev.currentTarget ?? ev.target);
		close();
	} else {
		childTarget = ev.currentTarget ?? ev.target;
		childMenu = item.children;
		childShowingItem = item;
	}
}

function clicked(fn: MenuAction | undefined, ev: MouseEvent) {
	if (fn) {
		fn(ev);
	}
	close(true);
}

function close(actioned = false) {
	if (actioned) {
	}
	emit("close", actioned);
}

function focusUp() {
	focusPrev(document.activeElement);
}

function focusDown() {
	focusNext(document.activeElement);
}

onMounted(() => {
	focusTrap.value.activate();

	if (props.viaKeyboard) {
		nextTick(() => {
			focusNext(itemsEl.children[0], true, false);
		});
	}

	document.addEventListener("mousedown", onGlobalMousedown, {
		passive: true,
	});
});

onBeforeUnmount(() => {
	document.removeEventListener("mousedown", onGlobalMousedown);
});
</script>

<style lang="scss" scoped>
.rrevdjwt {
	padding: 0.5rem 0;
	box-sizing: border-box;
	min-width: 12.5rem;
	overflow: auto;
	overscroll-behavior: contain;

	&.center {
		> .item {
			text-align: center;
		}
	}

	> .item {
		display: block;
		position: relative;
		padding: 0.375rem 1rem;
		width: 100%;
		box-sizing: border-box;
		white-space: nowrap;
		font-size: 0.9em;
		line-height: 1.25rem;
		text-align: left;
		outline: none;

		&:before {
			content: "";
			display: block;
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			margin: auto;
			width: calc(100% - 1rem);
			margin-bottom: 0.2rem;
			height: 100%;
			border-radius: 0.375rem;
		}

		> * {
			position: relative;
		}

		> &.icon {
			transform: translateY(0em);
		}

		&:not(:disabled):hover,
		&:focus-visible {
			color: var(--accent);
			text-decoration: none;

			&:before {
				background: var(--accentedBg);
			}
		}
		&:focus-visible:before {
			outline: auto;
		}

		&.danger {
			color: #eb6f92;

			&:hover {
				color: #e0def4;

				&:before {
					background: #eb6f92;
				}
			}

			&:active {
				color: #e0def4;

				&:before {
					background: #b4637a;
				}
			}
		}

		&.active {
			color: var(--fgOnAccent);
			opacity: 1;

			&:before {
				background: var(--accent);
			}
		}

		&:not(:active):focus-visible {
			box-shadow: 0 0 0 0.125rem var(--focus) inset;
		}

		&.label {
			pointer-events: none;
			font-size: 0.7em;
			padding-bottom: 0.25rem;

			> span {
				opacity: 0.7;
			}
		}

		&.pending {
			pointer-events: none;
			opacity: 0.7;
		}

		&.none {
			pointer-events: none;
			opacity: 0.7;
		}

		&.parent {
			display: flex;
			align-items: center;
			cursor: default;

			> .caret {
				margin-left: auto;
			}

			&.childShowing {
				color: var(--accent);
				text-decoration: none;

				&:before {
					background: var(--accentedBg);
				}
			}
		}

		> i {
			margin-right: 0.3125rem;
			width: 1.25rem;
		}

		> .avatar {
			margin-right: 0.3125rem;
			width: 1.25rem;
			height: 1.25rem;
		}

		> .indicator {
			position: absolute;
			top: 0.3125rem;
			left: 0.8125rem;
			color: var(--indicator);
			font-size: 0.75rem;
			animation: blink 1s infinite;
		}
	}

	> .divider {
		margin: 0.5rem 0;
		border-top: solid 0.03125rem var(--divider);
	}

	&.asDrawer {
		padding: 0.75rem 0 calc(env(safe-area-inset-bottom, 0) + 0.75rem) 0;
		width: 100%;
		border-radius: 1.5rem;
		border-bottom-right-radius: 0;
		border-bottom-left-radius: 0;

		> .item {
			font-size: 1em;
			padding: 0.75rem 1.5rem;

			&:before {
				width: calc(100% - 1.5rem);
				border-radius: 0.75rem;
			}

			> i {
				margin-right: 0.875rem;
				width: 1.5rem;
			}
		}

		> .divider {
			margin: 0.75rem 0;
		}
	}
}
</style>
