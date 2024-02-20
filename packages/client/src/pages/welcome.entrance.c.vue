<template>
	<div v-if="meta" class="rsqzvsbo">
		<div class="top">
			<MkFeaturedPhotos class="bg" />
			<div class="fade"></div>
			<div class="emojis">
				<MkEmoji :normal="true" :no-style="true" emoji="👍" />
				<MkEmoji :normal="true" :no-style="true" emoji="❤" />
				<MkEmoji :normal="true" :no-style="true" emoji="😆" />
				<MkEmoji :normal="true" :no-style="true" emoji="🎉" />
				<MkEmoji :normal="true" :no-style="true" emoji="🍮" />
			</div>
			<div class="main">
				<img src="/client-assets/misskey.svg" class="misskey" />
				<div class="form _panel">
					<div class="bg">
						<div class="fade"></div>
					</div>
					<div class="fg">
						<h1>
							<img
								v-if="meta.logoImageUrl"
								class="logo"
								:src="meta.logoImageUrl"
							/><span v-else class="text">{{
								instanceName
							}}</span>
						</h1>
						<div class="about">
							<div
								class="desc"
								style="white-space: pre-line"
								v-html="
									meta.description || i18n.ts.headlineMisskey
								"
							></div>
						</div>
						<div class="action">
							<MkButton inline gradate @click="signup()">{{
								i18n.ts.signup
							}}</MkButton>
							<MkButton inline @click="signin()">{{
								i18n.ts.login
							}}</MkButton>
						</div>
						<div v-if="onlineUsersCount && stats" class="status">
							<div>
								<I18n
									:src="i18n.ts.nUsers"
									text-tag="span"
									class="users"
								>
									<template #n
										><b>{{
											number(stats.originalUsersCount)
										}}</b></template
									>
								</I18n>
								<I18n
									:src="i18n.ts.nNotes"
									text-tag="span"
									class="notes"
								>
									<template #n
										><b>{{
											number(stats.originalNotesCount)
										}}</b></template
									>
								</I18n>
							</div>
							<I18n
								:src="i18n.ts.onlineUsersCount"
								text-tag="span"
								class="online"
							>
								<template #n
									><b>{{ onlineUsersCount }}</b></template
								>
							</I18n>
						</div>
						<button class="_button _acrylic menu" @click="showMenu">
							<i class="ph-dots-three-outline ph-bold ph-lg"></i>
						</button>
					</div>
				</div>
				<nav class="nav">
					<MkA to="/announcements">{{ i18n.ts.announcements }}</MkA>
					<MkA to="/explore">{{ i18n.ts.explore }}</MkA>
					<MkA to="/channels">{{ i18n.ts.channel }}</MkA>
					<MkA to="/featured">{{ i18n.ts.featured }}</MkA>
				</nav>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { toUnicode } from "punycode/";
import XTimeline from "./welcome.timeline.vue";
import XSigninDialog from "@/components/MkSigninDialog.vue";
import XSignupDialog from "@/components/MkSignupDialog.vue";
import MkButton from "@/components/MkButton.vue";
import XNote from "@/components/MkNote.vue";
import MkFeaturedPhotos from "@/components/MkFeaturedPhotos.vue";
import { host, instanceName } from "@/config";
import * as os from "@/os";
import number from "@/filters/number";
import { i18n } from "@/i18n";

export default defineComponent({
	components: {
		MkButton,
		XNote,
		MkFeaturedPhotos,
		XTimeline,
	},

	data() {
		return {
			host: toUnicode(host),
			instanceName,
			meta: null,
			stats: null,
			tags: [],
			onlineUsersCount: null,
			i18n,
		};
	},

	created() {
		os.api("meta", { detail: true }).then((meta) => {
			this.meta = meta;
		});

		os.api("stats").then((stats) => {
			this.stats = stats;
		});

		os.api("get-online-users-count").then((res) => {
			this.onlineUsersCount = res.count;
		});

		os.api("hashtags/list", {
			sort: "+mentionedLocalUsers",
			limit: 8,
		}).then((tags) => {
			this.tags = tags;
		});
	},

	methods: {
		signin() {
			os.popup(
				XSigninDialog,
				{
					autoSet: true,
				},
				{},
				"closed"
			);
		},

		signup() {
			os.popup(
				XSignupDialog,
				{
					autoSet: true,
				},
				{},
				"closed"
			);
		},

		showMenu(ev) {
			os.popupMenu(
				[
					{
						text: i18n.t("aboutX", { x: instanceName }),
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
		},
		number,
	},
});
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
			left: 0;
			width: 100%;
			height: 100%;
		}

		> .fade {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.25);
		}

		> .emojis {
			position: absolute;
			bottom: 2rem;
			left: 2.1875rem;

			> * {
				margin-right: 0.5rem;
			}

			@media (max-width: 75rem) {
				display: none;
			}
		}

		> .main {
			position: relative;
			width: min(28.75rem, 100%);
			margin: auto;

			> .misskey {
				width: 9.375rem;
				margin-bottom: 1rem;

				@media (max-width: 28.125rem) {
					width: 8.125rem;
				}
			}

			> .form {
				position: relative;
				box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 25%);

				> .bg {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 8rem;
					background-position: center;
					background-size: cover;
					opacity: 0.75;

					> .fade {
						position: absolute;
						bottom: 0;
						left: 0;
						width: 100%;
						height: 8rem;
						background: linear-gradient(
							0deg,
							var(--panel),
							var(--X15)
						);
					}
				}

				> .fg {
					position: relative;
					z-index: 1;

					> h1 {
						display: block;
						margin: 0;
						padding: 2rem 2rem 1.5rem 2rem;

						> .logo {
							vertical-align: bottom;
							max-height: 7.5rem;
						}
					}

					> .about {
						padding: 0 2rem;
					}

					> .action {
						padding: 2rem;

						> * {
							line-height: 1.75rem;
						}
					}

					> .status {
						border-top: solid 0.0.3125rem var(--divider);
						padding: 2rem;
						font-size: 90%;

						> div {
							> span:not(:last-child) {
								padding-right: 1em;
								margin-right: 1em;
								border-right: solid 0.0.3125rem var(--divider);
							}
						}

						> .online {
							::v-deep(b) {
								color: #41b781;
							}

							::v-deep(span) {
								opacity: 0.7;
							}
						}
					}

					> .menu {
						position: absolute;
						top: 1rem;
						right: 1rem;
						width: 2rem;
						height: 2rem;
						border-radius: 0.5rem;
					}
				}
			}

			> .nav {
				position: relative;
				z-index: 2;
				margin-top: 1.25rem;
				color: #fff;
				text-shadow: 0 0 0.5rem black;
				font-size: 0.9em;

				> *:not(:last-child) {
					margin-right: 1.5em;
				}
			}
		}
	}
}
</style>
