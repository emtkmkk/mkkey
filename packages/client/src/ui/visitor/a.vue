<template>
	<div class="mk-app">
		<div
			v-if="mainRouter.currentRoute?.name === 'index'"
			class="banner"
			:style="{ backgroundImage: `url(${$instance.bannerUrl})` }"
		>
			<div>
				<h1 v-if="meta">
					<img
						v-if="meta.logoImageUrl"
						class="logo"
						:src="meta.logoImageUrl"
					/><span v-else class="text">{{ instanceName }}</span>
				</h1>
				<div v-if="meta" class="about">
					<div
						class="desc"
						v-html="meta.description || i18n.ts.introMisskey"
					></div>
				</div>
				<div class="action">
					<button class="_button primary" @click="signup()">
						{{ i18n.ts.signup }}
					</button>
					<button class="_button" @click="signin()">
						{{ i18n.ts.login }}
					</button>
				</div>
			</div>
		</div>
		<div
			v-else
			class="banner-mini"
			:style="{ backgroundImage: `url(${$instance.bannerUrl})` }"
		>
			<div>
				<h1 v-if="meta">
					<img
						v-if="meta.logoImageUrl"
						class="logo"
						:src="meta.logoImageUrl"
					/><span v-else class="text">{{ instanceName }}</span>
				</h1>
			</div>
		</div>

		<div class="main">
			<div ref="contents" class="contents" :class="{ wallpaper }">
				<header
					v-show="mainRouter.currentRoute?.name !== 'index'"
					ref="header"
					class="header"
				>
					<XHeader :info="pageInfo" />
				</header>
				<main ref="main">
					<RouterView />
				</main>
				<div class="powered-by">
					<b
						><MkA to="/">{{ host }}</MkA></b
					>
					<!-- <small
						>Powered by
						<a href="https://calckey.org/" target="_blank"
							>Calckey</a
						></small
					> -->
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from "vue";
import XHeader from "./header.vue";
import { host, instanceName } from "@/config";
import { search } from "@/scripts/search";
import * as os from "@/os";
import MkPagination from "@/components/MkPagination.vue";
import MkButton from "@/components/MkButton.vue";
import { ColdDeviceStorage } from "@/store";
import { mainRouter } from "@/router";
import { i18n } from "@/i18n";

const DESKTOP_THRESHOLD = 1100;

export default defineComponent({
	components: {
		XHeader,
		MkPagination,
		MkButton,
	},

	data() {
		return {
			host,
			instanceName,
			pageInfo: null,
			meta: null,
			narrow: window.innerWidth < 1280,
			announcements: {
				endpoint: "announcements",
				limit: 10,
			},
			mainRouter,
			isDesktop: window.innerWidth >= DESKTOP_THRESHOLD,
			i18n,
		};
	},

	computed: {
		keymap(): any {
			return {
				d: () => {
					if (ColdDeviceStorage.get("syncDeviceDarkMode")) return;
					this.$store.set("darkMode", !this.$store.state.darkMode);
				},
				s: search,
				"h|/": this.help,
			};
		},
	},

	created() {
		document.documentElement.style.overflowY = "scroll";

		os.api("meta", { detail: true }).then((meta) => {
			this.meta = meta;
		});
	},

	mounted() {
		if (!this.isDesktop) {
			window.addEventListener(
				"resize",
				() => {
					if (window.innerWidth >= DESKTOP_THRESHOLD)
						this.isDesktop = true;
				},
				{ passive: true }
			);
		}
	},

	methods: {
		// @ThatOneCalculator: Are these methods even used?
		// I can't find references to them anywhere else in the code...

		// setParallax(el) {
		// 	new simpleParallax(el);
		// },

		changePage(page) {
			if (page == null) return;

			if (page[symbols.PAGE_INFO]) {
				this.pageInfo = page[symbols.PAGE_INFO];
			}
		},

		top() {
			window.scroll({ top: 0, behavior: "smooth" });
		},

		help() {
			// TODO(thatonecalculator): popup with keybinds
			// window.open('https://misskey-hub.net/docs/keyboard-shortcut.md', '_blank');
			console.log("d = dark/light mode, s = search, p = post :3");
		},
	},
});
</script>

<style lang="scss" scoped>
.mk-app {
	min-height: 100vh;

	> .banner {
		position: relative;
		width: 100%;
		text-align: center;
		background-position: center;
		background-size: cover;

		> div {
			height: 100%;
			background: rgba(0, 0, 0, 0.3);

			* {
				color: #fff;
			}

			> h1 {
				margin: 0;
				padding: 0 2rem 0 2rem;
				text-shadow: 0 0 0.5rem black;

				> .logo {
					vertical-align: bottom;
					max-height: 0;
				}
			}

			> .about {
				padding: 2rem;
				max-width: 36.25rem;
				margin: 0 auto;
				box-sizing: border-box;
				text-shadow: 0 0 0.5rem black;
			}

			> .action {
				padding-bottom: 4rem;

				> button {
					display: inline-block;
					padding: 0.625rem 1.25rem;
					box-sizing: border-box;
					text-align: center;
					border-radius: 999px;
					background: var(--panel);
					color: var(--fg);

					&.primary {
						background: var(--accent);
						color: #fff;
					}

					&:first-child {
						margin-right: 1rem;
					}
				}
			}
		}
	}

	> .banner-mini {
		position: relative;
		width: 100%;
		text-align: center;
		background-position: center;
		background-size: cover;

		> div {
			position: relative;
			z-index: 1;
			height: 100%;
			background: rgba(0, 0, 0, 0.3);

			* {
				color: #fff !important;
			}

			> header {
			}

			> h1 {
				margin: 0;
				padding: 1rem;
				text-shadow: 0 0 0.5rem black;

				> .logo {
					vertical-align: bottom;
					max-height: 3rem;
				}
			}
		}
	}

	> .main {
		> .contents {
			position: relative;
			z-index: 1;

			> .header {
				position: sticky;
				top: 0;
				left: 0;
				z-index: 1000;
			}

			> .powered-by {
				padding: 1.75rem;
				font-size: 0.875rem;
				text-align: center;
				border-top: 0.0625rem solid var(--divider);

				> small {
					display: block;
					margin-top: 0.5rem;
					opacity: 0.5;
				}
			}
		}
	}
}
</style>

<style lang="scss"></style>
