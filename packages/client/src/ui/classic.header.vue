<template>
	<div class="azykntjl">
		<div class="body">
			<div class="left">
				<MkA
					v-click-anime
					v-tooltip="i18n.ts.timeline"
					class="item index"
					active-class="active"
					to="/"
					exact
				>
					<i class="ph-house ph-bold ph-lg ph-fw ph-lg"></i>
				</MkA>
				<template v-for="item in menu">
					<div v-if="item === '-'" class="divider"></div>
					<component
						:is="navbarItemDef[item].to ? 'MkA' : 'button'"
						v-else-if="
							navbarItemDef[item] &&
							navbarItemDef[item].show !== false
						"
						v-click-anime
						v-tooltip="$ts[navbarItemDef[item].title]"
						class="item _button"
						:class="item"
						active-class="active"
						:to="navbarItemDef[item].to"
						v-on="
							navbarItemDef[item].action
								? { click: navbarItemDef[item].action }
								: {}
						"
					>
						<i
							class="ph-fw ph-lg"
							:class="navbarItemDef[item].icon"
						></i>
						<span
							v-if="navbarItemDef[item].indicated"
							class="indicator"
							><i class="ph-circle ph-fill"></i
						></span>
					</component>
				</template>
				<div class="divider"></div>
				<MkA
					v-if="$i.isAdmin || $i.isModerator"
					v-click-anime
					v-tooltip="i18n.ts.controlPanel"
					class="item"
					active-class="active"
					to="/admin"
					:behavior="settingsWindowed ? 'modalWindow' : null"
				>
					<i class="ph-door ph-bold ph-lg ph-fw ph-lg"></i>
				</MkA>
				<button v-click-anime class="item _button" @click="more">
					<i
						class="ph-dots-three-outline ph-bold ph-lg ph-fw ph-lg"
					></i>
					<span v-if="otherNavItemIndicated" class="indicator"
						><i class="ph-circle ph-fill"></i
					></span>
				</button>
			</div>
			<div class="right">
				<MkA
					v-click-anime
					v-tooltip="i18n.ts.settings"
					class="item"
					active-class="active"
					to="/settings"
					:behavior="settingsWindowed ? 'modalWindow' : null"
				>
					<i class="ph-gear-six ph-bold ph-lg ph-fw ph-lg"></i>
				</MkA>
				<button
					v-click-anime
					class="item _button account"
					@click="openAccountMenu"
				>
					<MkAvatar :user="$i" class="avatar" /><MkAcct
						class="acct"
						:user="$i"
						disableLink
					/>
				</button>
				<div class="post" @click="post">
					<MkButton class="button" gradate full rounded>
						<i class="ph-pencil ph-bold ph-lg ph-fw ph-lg"></i>
					</MkButton>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineAsyncComponent, defineComponent } from "vue";
import { host } from "@/config";
import { search } from "@/scripts/search";
import * as os from "@/os";
import { navbarItemDef } from "@/navbar";
import { openAccountMenu } from "@/account";
import MkButton from "@/components/MkButton.vue";
import { i18n } from "@/i18n";

export default defineComponent({
	components: {
		MkButton,
	},

	data() {
		return {
			host: host,
			accounts: [],
			connection: null,
			navbarItemDef: navbarItemDef,
			settingsWindowed: false,
			i18n,
		};
	},

	computed: {
		menu(): string[] {
			return this.$store.state.menu;
		},

		otherNavItemIndicated(): boolean {
			for (const def in this.navbarItemDef) {
				if (this.menu.includes(def)) continue;
				if (this.navbarItemDef[def].indicated) return true;
			}
			return false;
		},
	},

	watch: {
		"$store.reactiveState.menuDisplay.value"() {
			this.calcViewState();
		},
	},

	created() {
		window.addEventListener("resize", this.calcViewState);
		this.calcViewState();
	},

	methods: {
		calcViewState() {
			this.settingsWindowed = window.innerWidth > 1400;
		},

		post() {
			os.post();
		},

		search() {
			search();
		},

		more(ev) {
			os.popup(
				defineAsyncComponent(
					() => import("@/components/MkLaunchPad.vue")
				),
				{
					src: ev.currentTarget ?? ev.target,
					anchor: { x: "center", y: "bottom" },
				},
				{},
				"closed"
			);
		},

		openAccountMenu: (ev) => {
			openAccountMenu(
				{
					withExtraOperation: true,
				},
				ev
			);
		},
	},
});
</script>

<style lang="scss" scoped>
.azykntjl {
	$height: 3.75rem;
	$avatar-size: 2rem;
	$avatar-margin: 0.5rem;

	position: sticky;
	top: 0;
	z-index: 1000;
	width: 100%;
	height: $height;
	background-color: var(--bg);

	> .body {
		max-width: 86.25rem;
		margin: 0 auto;
		display: flex;

		> .right,
		> .left {
			> .item {
				position: relative;
				font-size: 0.9em;
				display: inline-block;
				padding: 0 0.75rem;
				line-height: $height;

				> i,
				> .avatar {
					margin-right: 0;
				}

				> i {
					left: 0.625rem;
				}

				> .avatar {
					width: $avatar-size;
					height: $avatar-size;
					vertical-align: middle;
				}

				> .indicator {
					position: absolute;
					top: 0;
					left: 0;
					color: var(--navIndicator);
					font-size: 0.5rem;
					animation: blink 1s infinite;
				}

				&:hover {
					text-decoration: none;
					color: var(--navHoverFg);
				}

				&.active {
					color: var(--navActive);
				}
			}

			> .divider {
				display: inline-block;
				height: 1rem;
				margin: 0 0.625rem;
				border-right: solid 0.03125rem var(--divider);
			}

			> .post {
				display: inline-block;

				> .button {
					width: 2.5rem;
					height: 2.5rem;
					padding: 0;
					min-width: 0;
				}
			}

			> .account {
				display: inline-flex;
				align-items: center;
				vertical-align: top;
				margin-right: 0.5rem;

				> .acct {
					margin-left: 0.5rem;
				}
			}
		}

		> .right {
			margin-left: auto;
		}
	}
}
</style>
