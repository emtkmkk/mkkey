<template>
	<div class="kmwsukvl">
		<div class="body">
			<div v-if="!menu.includes('changeAccount')" class="top">
				<div
					class="banner"
					:user="$i"
					:style="{ backgroundImage: `url(${$i.bannerUrl})` }"
				></div>
				<button
					v-click-anime
					v-tooltip.noDelay.right="
						`${i18n.ts.account}: @${$i.username}`
					"
					class="item _button account"
					@click="openAccountMenu"
				>
					<img
						v-if="$store.state.hiddenHeaderIcon"
						:src="$instance.iconUrl"
						class="icon _ghost"
						alt="icon"
					/>
					<MkAvatar
						v-else
						:user="$i"
						class="icon"
						disableLink
					/><!-- <MkAcct class="text" :user="$i"/> -->
				</button>
			</div>
			<div class="middle">
				<template v-for="item in menu">
					<div v-if="item === '-'" class="divider"></div>
					<component
						:is="navbarItemDef[item].to ? 'MkA' : 'button'"
						v-else-if="
							navbarItemDef[item] &&
							navbarItemDef[item].show !== false &&
							navbarItemDef[item].onlyDesktop !== true &&
							$store.state.mobileThirdButton !== item
						"
						v-click-anime
						class="item _button"
						:class="[item, { active: navbarItemDef[item].active }]"
						active-class="active"
						:to="navbarItemDef[item].to"
						v-on="
							navbarItemDef[item].action
								? { click: navbarItemDef[item].action }
								: {}
						"
					>
						<i
							class="icon ph-fw ph-lg"
							:class="navbarItemDef[item].icon"
						></i
						><span class="text">{{
							i18n.ts[navbarItemDef[item].title]
						}}</span>
						<span
							v-if="navbarItemDef[item].indicated"
							class="indicator"
							><i class="icon ph-circle ph-fill"></i
						></span>
					</component>
				</template>
				<div class="divider"></div>
				<MkA
					v-if="$i.isAdmin || $i.isModerator"
					v-click-anime
					class="item"
					active-class="active"
					to="/admin"
				>
					<i class="icon ph-door ph-bold ph-lg ph-fw ph-lg"></i
					><span class="text">{{ i18n.ts.controlPanel }}</span>
				</MkA>
				<button v-click-anime class="item _button" @click="more">
					<i
						class="icon ph-dots-three-outline ph-bold ph-lg ph-fw ph-lg"
					></i
					><span class="text">{{ i18n.ts.more }}</span>
					<span v-if="otherMenuItemIndicated" class="indicator"
						><i class="icon ph-circle ph-fill"></i
					></span>
				</button>
				<MkA
					v-click-anime
					class="item"
					active-class="active"
					to="/settings"
				>
					<i class="icon ph-gear-six ph-bold ph-lg ph-fw ph-lg"></i
					><span class="text">{{ i18n.ts.settings }}</span>
				</MkA>
			</div>
			<div class="bottom">
				<button
					class="item _button post"
					data-cy-open-post-form
					@click="os.post"
				>
					<i class="icon ph-pencil ph-bold ph-lg ph-fw ph-lg"></i
					><span class="text">{{ i18n.ts.note }}</span>
				</button>
				<pwa-install />
				<button
					v-tooltip.noDelay.right="i18n.ts.help"
					class="item _button help"
					@click="openHelpMenu"
				>
					<i class="help icon ph-info ph-bold ph-xl ph-fw"></i>
				</button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {
	computed,
	defineAsyncComponent,
	defineComponent,
	ref,
	toRef,
	watch,
} from "vue";
import * as os from "@/os";
import { navbarItemDef } from "@/navbar";
import { openAccountMenu as openAccountMenu_ } from "@/account";
import { openHelpMenu_ } from "@/scripts/helpMenu";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import "@khmyznikov/pwa-install";

const menu = toRef(defaultStore.state, "menu");
const otherMenuItemIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (menu.value.includes(def)) continue;
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

function openAccountMenu(ev: MouseEvent) {
	openAccountMenu_(
		{
			withExtraOperation: true,
		},
		ev
	);
}

function openHelpMenu(ev: MouseEvent) {
	openHelpMenu_(ev);
}

function more() {
	os.popup(
		defineAsyncComponent(() => import("@/components/MkLaunchPad.vue")),
		{},
		{},
		"closed"
	);
}
</script>

<style lang="scss" scoped>
.kmwsukvl {
	> .body {
		display: flex;
		flex-direction: column;

		> .top {
			position: sticky;
			top: 0;
			z-index: 1;
			padding: 2rem 0;
			background: var(--X14);
			-webkit-backdrop-filter: var(--blur, blur(8px));
			backdrop-filter: var(--blur, blur(8px));

			> .banner {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background-size: cover;
				background-position: center center;
				-webkit-mask-image: linear-gradient(
					0deg,
					rgba(0, 0, 0, 0) 15%,
					rgba(0, 0, 0, 0.75) 100%
				);
				mask-image: linear-gradient(
					0deg,
					rgba(0, 0, 0, 0) 15%,
					rgba(0, 0, 0, 0.75) 100%
				);
			}

			> .account {
				position: relative;
				display: block;
				text-align: center;
				width: 100%;

				> .icon {
					display: inline-block;
					width: 3.4375rem;
					aspect-ratio: 1;
				}
			}
		}

		> .bottom {
			position: sticky;
			bottom: 0;
			padding: 1.25rem 0;
			background: var(--X14);
			-webkit-backdrop-filter: var(--blur, blur(8px));
			backdrop-filter: var(--blur, blur(8px));

			> .post {
				position: relative;
				display: flex;
				align-items: center;
				width: 100%;
				height: 2.5rem;
				color: var(--fgOnAccent);
				font-weight: bold;
				text-align: left;

				&:before {
					content: "";
					display: block;
					width: calc(100% - 2.375rem);
					height: 100%;
					margin: auto;
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					border-radius: 999px;
					background: linear-gradient(
						90deg,
						var(--buttonGradateA),
						var(--buttonGradateB)
					);
				}

				&:hover,
				&.active {
					&:before {
						background: var(--accentLighten);
					}
				}

				> .icon {
					position: relative;
					margin-left: 1.875rem;
					margin-right: 0.5rem;
					width: 2rem;
				}

				> .text {
					position: relative;
				}
			}

			> .help {
				position: relative;
				display: block;
				text-align: center;
				width: 100%;
				margin-top: 1rem;
				color: var(--navFg);

				> .icon {
					display: inline-block;
					width: 2.375rem;
					aspect-ratio: 1;
				}
			}

			> .instance {
				position: relative;
				display: flex;
				align-items: center;
				padding-left: 1.875rem;
				text-overflow: ellipsis;
				overflow: hidden;
				white-space: nowrap;
				width: 100%;
				text-align: left;
				box-sizing: border-box;
				margin-top: 1rem;

				> .icon {
					position: relative;
					width: 2rem;
					aspect-ratio: 1;
					transform: translateX(-100%);
					left: 50%;
				}
			}
		}

		> .middle {
			flex: 0.1;

			> .divider {
				margin: 1rem 1rem;
				border-top: solid 0.0.3125rem var(--divider);
			}

			> .item {
				position: relative;
				display: block;
				padding-left: 1.5rem;
				line-height: 2.85rem;
				text-overflow: ellipsis;
				overflow: hidden;
				white-space: nowrap;
				width: 100%;
				text-align: left;
				box-sizing: border-box;
				color: var(--navFg);

				> .icon {
					position: relative;
					width: 2rem;
					margin-right: 0.5rem;
				}

				> .indicator {
					position: absolute;
					top: 0;
					left: 1.25rem;
					color: var(--navIndicator);
					font-size: 0.5rem;
					animation: blink 1s infinite;
				}

				> .text {
					position: relative;
					font-size: 0.9em;
				}

				&:hover {
					text-decoration: none;
					color: var(--navHoverFg);
				}

				&.active {
					color: var(--navActive);
				}

				&:hover,
				&.active {
					&:before {
						content: "";
						display: block;
						width: calc(100% - 1.5rem);
						height: 100%;
						margin: auto;
						position: absolute;
						top: 0;
						left: 0;
						right: 0;
						bottom: 0;
						border-radius: 999px;
						background: var(--accentedBg);
					}
				}
			}
		}
	}
}
</style>
