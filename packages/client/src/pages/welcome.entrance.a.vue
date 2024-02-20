<template>
	<div v-if="meta" class="rsqzvsbo">
		<div class="top">
			<MkFeaturedPhotos class="bg" />
			<XTimeline class="tl" />
			<div class="shape1"></div>
			<div class="shape2"></div>
			<img src="/client-assets/misskey.svg" class="misskey" />
			<div class="emojis">
				<MkEmoji :normal="true" :no-style="true" emoji="⭐" />
				<MkEmoji :normal="true" :no-style="true" emoji="❤️" />
				<MkEmoji :normal="true" :no-style="true" emoji="😆" />
				<MkEmoji :normal="true" :no-style="true" emoji="🤔" />
				<MkEmoji :normal="true" :no-style="true" emoji="😮" />
				<MkEmoji :normal="true" :no-style="true" emoji="🎉" />
				<MkEmoji :normal="true" :no-style="true" emoji="💢" />
				<MkEmoji :normal="true" :no-style="true" emoji="😥" />
				<MkEmoji :normal="true" :no-style="true" emoji="😇" />
				<MkEmoji :normal="true" :no-style="true" emoji="🥴" />
				<MkEmoji :normal="true" :no-style="true" emoji="🍮" />
			</div>
			<div class="main">
				<img
					:src="
						$instance.faviconUrl ||
						$instance.iconUrl ||
						'/favicon.ico'
					"
					alt=""
					class="icon"
				/>
				<button class="_button _acrylic menu" @click="showMenu">
					<i class="ph-dots-three-outline ph-bold ph-lg"></i>
				</button>
				<div class="fg">
					<h1>
						<img
							class="logo"
							v-if="meta.logoImageUrl"
							:src="meta.logoImageUrl"
							alt="logo"
						/>
						<span v-else class="text">{{ instanceName }}</span>
					</h1>
					<div class="about">
						<div
							class="desc"
							style="white-space: pre-line"
							v-html="meta.description || i18n.ts.headlineMisskey"
						></div>
					</div>
					<div class="action">
						<MkButton
							inline
							rounded
							gradate
							data-cy-signup
							style="margin-right: 0.75rem"
							@click="signup()"
							>{{ i18n.ts.signup }}</MkButton
						>
						<MkButton
							inline
							rounded
							data-cy-signin
							@click="signin()"
							>{{ i18n.ts.login }}</MkButton
						>
						<MkButton
							inline
							rounded
							style="margin-left: 0.75rem; margin-top: 0.75rem"
							onclick="window.location.href='/explore'"
							>覗いてみる</MkButton
						>
					</div>
				</div>
			</div>
			<div v-if="instances" class="federation">
				<MarqueeText :duration="40">
					<MkA
						v-for="instance in instances"
						:key="instance.id"
						:class="$style.federationInstance"
						@click="signup()"
					>
						<img
							v-if="instance.iconUrl"
							class="icon"
							:src="instance.iconUrl"
							alt=""
						/>
						<span class="name _monospace">{{ instance.host }}</span>
					</MkA>
				</MarqueeText>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";
import { toUnicode } from "punycode/";
import XTimeline from "./welcome.timeline.vue";
import MarqueeText from "@/components/MkMarquee.vue";
import XSigninDialog from "@/components/MkSigninDialog.vue";
import XSignupDialog from "@/components/MkSignupDialog.vue";
import MkButton from "@/components/MkButton.vue";
import XNote from "@/components/MkNote.vue";
import MkFeaturedPhotos from "@/components/MkFeaturedPhotos.vue";
import { host, instanceName } from "@/config";
import * as os from "@/os";
import number from "@/filters/number";
import { i18n } from "@/i18n";

let meta = $ref();
let stats = $ref();
let tags = $ref();
let onlineUsersCount = $ref();
let instances = $ref();

os.api("meta", { detail: true }).then((_meta) => {
	meta = _meta;
});

os.api("stats").then((_stats) => {
	stats = _stats;
});

os.api("get-online-users-count").then((res) => {
	onlineUsersCount = res.count;
});

os.api("hashtags/list", {
	sort: "+mentionedLocalUsers",
	limit: 8,
}).then((_tags) => {
	tags = _tags;
});

os.api("federation/instances", {
	sort: "+pubSub",
	limit: 20,
}).then((_instances) => {
	instances = _instances;
});

function signin() {
	os.popup(
		XSigninDialog,
		{
			autoSet: true,
		},
		{},
		"closed"
	);
}

function signup() {
	os.popup(
		XSignupDialog,
		{
			autoSet: true,
		},
		{},
		"closed"
	);
}

function showMenu(ev) {
	os.popupMenu(
		[
			{
				text: i18n.ts.instanceInfo,
				icon: "ph-info ph-bold ph-lg",
				action: () => {
					os.pageWindow("/about");
				},
			},
			{
				text: i18n.ts.aboutMisskey,
				icon: "ph-info ph-bold ph-lg",
				action: () => {
					os.pageWindow("/about-calckey");
				},
			},
		],
		ev.currentTarget ?? ev.target
	);
}
</script>

<style lang="scss" scoped>
.rsqzvsbo {
	> .top {
		display: flex;
		text-align: center;
		min-height: 100vh;
		box-sizing: border-box;
		padding: 1rem;

		> .bg {
			position: absolute;
			top: 0;
			right: 0;
			width: 80%; // 100%からshapeの幅を引いている
			height: 100%;
		}

		> .tl {
			position: absolute;
			top: 0;
			bottom: 0;
			right: 4rem;
			margin: auto;
			width: 31.25rem;
			height: calc(100% - 8rem);
			overflow: hidden;
			-webkit-mask-image: linear-gradient(
				0deg,
				rgba(0, 0, 0, 0) 0%,
				rgba(0, 0, 0, 1) 8rem,
				rgba(0, 0, 0, 1) calc(100% - 8rem),
				rgba(0, 0, 0, 0) 100%
			);
			mask-image: linear-gradient(
				0deg,
				rgba(0, 0, 0, 0) 0%,
				rgba(0, 0, 0, 1) 8rem,
				rgba(0, 0, 0, 1) calc(100% - 8rem),
				rgba(0, 0, 0, 0) 100%
			);

			@media (max-width: 75rem) {
				display: none;
			}
		}

		> .shape1 {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: var(--accent);
			clip-path: polygon(0% 0%, 45% 0%, 20% 100%, 0% 100%);
		}
		> .shape2 {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: var(--accent);
			clip-path: polygon(0% 0%, 25% 0%, 35% 100%, 0% 100%);
			opacity: 0.5;
		}

		> .misskey {
			position: absolute;
			top: 2.625rem;
			left: 2.625rem;
			width: 8.75rem;

			@media (max-width: 28.125rem) {
				width: 8.125rem;
			}
		}

		> .emojis {
			position: absolute;
			bottom: 2rem;
			left: 7.1875rem;
			transform: scale(1.5);

			> * {
				margin-right: 0.5rem;
			}

			@media (max-width: 75rem) {
				display: none;
			}
		}

		> .main {
			position: relative;
			width: min(30rem, 100%);
			margin: auto auto auto 8rem;
			background: var(--panel);
			border-radius: var(--radius);
			box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 25%);

			@media (max-width: 75rem) {
				margin: auto;
			}

			> .icon {
				width: 5.3125rem;
				margin-top: -2.9375rem;
				border-radius: 100%;
				vertical-align: bottom;
			}

			> .menu {
				position: absolute;
				top: 1rem;
				right: 1rem;
				width: 2rem;
				height: 2rem;
				border-radius: 0.5rem;
				font-size: 1.125rem;
				z-index: 2;
			}

			> .fg {
				position: relative;
				z-index: 1;

				> h1 {
					display: block;
					margin: 0;
					padding: 1rem 2rem 1.5rem 2rem;
					font-size: 1.4em;

					> .logo {
						vertical-align: bottom;
						max-height: 7.5rem;
						max-width: min(100%, 18.75rem);
					}
				}

				> .about {
					padding: 0 2rem;
				}

				> .action {
					padding: 2rem;
					padding-top: 1.375rem;

					> * {
						line-height: 1.75rem;
					}
				}
			}
		}

		> .federation {
			position: absolute;
			bottom: 1rem;
			left: 0;
			right: 0;
			margin: auto;
			background: var(--acrylicPanel);
			-webkit-backdrop-filter: var(--blur, blur(15px));
			backdrop-filter: var(--blur, blur(15px));
			border-radius: 999px;
			overflow: clip;
			width: 35%;
			left: 50%;
			padding: 0.5rem 0;

			@media (max-width: 56.25rem) {
				display: none;
			}
		}
	}
}
</style>

<style lang="scss" module>
.federationInstance {
	display: inline-flex;
	align-items: center;
	vertical-align: bottom;
	padding: 0.375rem 0.75rem 0.375rem 0.375rem;
	margin: 0 0.625rem 0 0;
	background: var(--panel);
	border-radius: 999px;

	> :global(.icon) {
		display: inline-block;
		width: 1.25rem;
		height: 1.25rem;
		margin-right: 0.3125rem;
		border-radius: 999px;
	}
}
</style>
